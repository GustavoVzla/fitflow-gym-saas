'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateStripeSecretKey, type StripeAccountValidation } from '@/lib/stripe/gym-stripe'
import { z } from 'zod'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

export type ConfigActionState = {
  error?: string
  success?: string
}

export type StripeConnectResult =
  | {
      ok: true
      account: Extract<StripeAccountValidation, { ok: true }>
    }
  | { ok: false; error: string }

async function resolveActiveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

export async function updateGymProfileAction(
  _prev: ConfigActionState,
  formData: FormData
): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const website = String(formData.get('website') ?? '').trim() || null
  const address = String(formData.get('address') ?? '').trim() || null
  const city = String(formData.get('city') ?? '').trim() || null
  const postalCode = String(formData.get('postalCode') ?? '').trim() || null
  const taxId = String(formData.get('taxId') ?? '').trim() || null
  const timezone = String(formData.get('timezone') ?? 'Europe/Madrid').trim()

  // Bloqueo morosos: campo opcional. Vacio = NULL (feature inactiva). Int 1..90.
  const blockMorososRaw = String(formData.get('blockMorososAfterDays') ?? '').trim()
  let blockMorososAfterDays: number | null = null
  if (blockMorososRaw !== '') {
    const n = Number(blockMorososRaw)
    if (!Number.isInteger(n) || n < 1 || n > 90) {
      return { error: 'Dias para bloqueo morosos inválidos (1-90 o vacío para desactivar)' }
    }
    blockMorososAfterDays = n
  }

  if (!name) return { error: 'El nombre del centro es obligatorio' }
  if (name.length > 100) return { error: 'El nombre no puede exceder 100 caracteres' }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gyms')
    .update({
      name,
      email,
      phone,
      website,
      address,
      city,
      postal_code: postalCode,
      tax_id: taxId,
      timezone,
      block_morosos_after_days: blockMorososAfterDays,
    })
    .eq('id', gymId)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/configuracion')
  revalidatePath('/', 'layout') // topbar/sidebar muestran el nombre del gym
  revalidatePath('/pagos') // banner morosos depende de esta setting
  return { success: 'Perfil actualizado correctamente' }
}

export async function updateGymSettingsAction(
  _prev: ConfigActionState,
  formData: FormData
): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const bookingAdvanceStr = String(formData.get('bookingAdvanceDays') ?? '7')
  const bookingCancelStr = String(formData.get('bookingCancelHours') ?? '2')
  const waitlistEnabled = formData.get('waitlistEnabled') === 'true'
  const brandColor = String(formData.get('brandColor') ?? '#3b8bea').trim()

  const bookingAdvanceDays = Number(bookingAdvanceStr)
  const bookingCancelHours = Number(bookingCancelStr)

  if (!Number.isInteger(bookingAdvanceDays) || bookingAdvanceDays < 0 || bookingAdvanceDays > 90) {
    return { error: 'Dias de antelacion invalidos (0-90)' }
  }
  if (!Number.isInteger(bookingCancelHours) || bookingCancelHours < 0 || bookingCancelHours > 72) {
    return { error: 'Horas de cancelacion invalidas (0-72)' }
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    return { error: 'Color de marca invalido (formato #RRGGBB)' }
  }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gym_settings')
    .update({
      booking_advance_days: bookingAdvanceDays,
      booking_cancel_hours: bookingCancelHours,
      waitlist_enabled: waitlistEnabled,
      brand_color: brandColor,
    })
    .eq('gym_id', gymId)

  if (error) return { error: sanitizeServerError(error) }

  // Sync branding color a gyms.brand_color (fuente de verdad para sidebar/favicon)
  // Fallback silencioso si falla — gym_settings es el source backup.
  await supabase.from('gyms').update({ brand_color: brandColor }).eq('id', gymId)

  revalidatePath('/configuracion')
  return { success: 'Configuracion guardada' }
}

/**
 * Conecta Stripe a un gym en modo direct_keys.
 * 1. Valida las keys contra Stripe (stripe.accounts.retrieve)
 * 2. Si OK, cifra la secret key via RPC set_gym_stripe_keys (Supabase Vault)
 * 3. Devuelve info de la cuenta para UI de confirmacion
 */
export async function connectStripeKeysAction(
  publishableKey: string,
  secretKey: string,
  webhookSecret?: string
): Promise<StripeConnectResult> {
  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const pub = publishableKey.trim()
  const sec = secretKey.trim()
  const whs = webhookSecret?.trim() || undefined

  if (!pub.startsWith('pk_test_') && !pub.startsWith('pk_live_')) {
    return { ok: false, error: 'Publishable key invalida (debe empezar por pk_test_ o pk_live_)' }
  }

  // 1. Validar contra Stripe
  const validation = await validateStripeSecretKey(sec)
  if (!validation.ok) return { ok: false, error: validation.error }

  // Sanity check: pub y sec deben ser del mismo modo (ambas test o ambas live)
  const pubIsLive = pub.startsWith('pk_live_')
  if (pubIsLive !== validation.isLiveMode) {
    return {
      ok: false,
      error:
        'Desajuste entre publishable y secret key: una es test y la otra live. Usa ambas del mismo modo.',
    }
  }

  // 2. Resolver gym activo
  const gymId = await resolveActiveGymId()
  if (!gymId) return { ok: false, error: 'No hay gym activo en la sesion' }

  // 3. Guardar via RPC (Vault)
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_gym_stripe_keys', {
    p_gym_id: gymId,
    p_publishable_key: pub,
    p_secret_key: sec,
    p_webhook_secret: whs ?? undefined,
  })
  if (error) return { ok: false, error: sanitizeServerError(error) }

  revalidatePath('/configuracion')
  return { ok: true, account: validation }
}

// =============================================================================
// Datos fiscales emisor (RD 1619/2012 ES) — separados del perfil comercial
// =============================================================================

// NIF/CIF ES: letra inicial (empresas) o DNI (autonomos). Permisivo para
// extranjeros (NIE, VAT intracomunitario). No re-validamos check digit aqui.
const TAX_ID_RE = /^[A-Z0-9]{4,20}$/i

const fiscalSchema = z.object({
  legalName: z.string().trim().min(1, 'La razon social es obligatoria').max(200),
  taxId: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => TAX_ID_RE.test(v), 'CIF/NIF invalido (4-20 caracteres alfanumericos)'),
  fiscalAddressLine1: z.string().trim().min(1, 'El domicilio fiscal es obligatorio').max(200),
  fiscalAddressPostalCode: z.string().trim().min(3, 'Codigo postal invalido').max(10),
  fiscalAddressCity: z.string().trim().min(1, 'La ciudad es obligatoria').max(100),
  fiscalCountryCode: z
    .string()
    .trim()
    .length(2, 'Codigo pais debe ser 2 letras')
    .transform((v) => v.toUpperCase()),
})

export async function updateGymFiscalDataAction(
  _prev: ConfigActionState,
  formData: FormData
): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = fiscalSchema.safeParse({
    legalName: formData.get('legalName') ?? '',
    taxId: formData.get('taxId') ?? '',
    fiscalAddressLine1: formData.get('fiscalAddressLine1') ?? '',
    fiscalAddressPostalCode: formData.get('fiscalAddressPostalCode') ?? '',
    fiscalAddressCity: formData.get('fiscalAddressCity') ?? '',
    fiscalCountryCode: formData.get('fiscalCountryCode') ?? 'ES',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos fiscales invalidos' }
  }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gyms')
    .update({
      legal_name: parsed.data.legalName,
      tax_id: parsed.data.taxId,
      fiscal_address_line1: parsed.data.fiscalAddressLine1,
      fiscal_address_postal_code: parsed.data.fiscalAddressPostalCode,
      fiscal_address_city: parsed.data.fiscalAddressCity,
      fiscal_country_code: parsed.data.fiscalCountryCode,
    })
    .eq('id', gymId)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/configuracion')
  return { success: 'Datos fiscales guardados. Se aplicaran a las proximas facturas.' }
}

export async function revokeStripeKeysAction(): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('clear_gym_stripe_keys', { p_gym_id: gymId })
  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/configuracion')
  return { success: 'Credenciales Stripe revocadas' }
}

/**
 * Fetch info de la cuenta Stripe usando las keys ya configuradas del gym.
 * Se usa al cargar /configuracion tab Pagos si stripeOnboardedAt != null.
 */
export async function fetchConnectedStripeAccountAction(): Promise<StripeConnectResult> {
  const rl = await rateLimit('api')
  if (!rl.success) return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { ok: false, error: 'No hay gym activo en la sesion' }

  const supabase = await createClient()
  const { data: secret, error } = await supabase.rpc('get_gym_stripe_secret', {
    p_gym_id: gymId,
  })
  if (error) return { ok: false, error: sanitizeServerError(error) }
  if (!secret) return { ok: false, error: 'Gym no tiene Stripe configurado' }

  const validation = await validateStripeSecretKey(secret)
  if (!validation.ok) return { ok: false, error: validation.error }
  return { ok: true, account: validation }
}

// ─────────────────────────────────────────────────────────────────────────
// Branding: logo + color + web hero + web gallery
// Migración gym_assets_bucket_and_web_image_cols (PM) ya aplicada en prod.
// Paths obligatorios `{gymId}/logo|web-hero|web-gallery/...` (validados por RLS).
// ─────────────────────────────────────────────────────────────────────────

export async function updateGymLogoAction(url: string | null): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  if (url !== null && url !== '' && !/^https?:\/\//.test(url)) {
    return { error: 'URL inválida' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gyms')
    .update({ logo_url: url })
    .eq('id', gymId)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/configuracion')
  revalidatePath('/', 'layout')
  return { success: url ? 'Logo actualizado' : 'Logo eliminado' }
}

export async function updateGymBrandColorAction(hex: string): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  if (!/^#[0-9a-f]{6}$/i.test(hex)) return { error: 'Hex inválido (formato #RRGGBB)' }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const supabase = await createClient()

  const { error: e1 } = await supabase
    .from('gyms')
    .update({ brand_color: hex })
    .eq('id', gymId)

  if (e1) return { error: sanitizeServerError(e1) }

  await supabase
    .from('gym_settings')
    .update({ brand_color: hex })
    .eq('gym_id', gymId)

  revalidatePath('/configuracion')
  revalidatePath('/', 'layout')
  return { success: 'Color actualizado' }
}

export async function updateGymWebHeroAction(url: string | null): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  if (url !== null && url !== '' && !/^https?:\/\//.test(url)) {
    return { error: 'URL inválida' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gyms')
    .update({ web_hero_url: url })
    .eq('id', gymId)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/configuracion')
  return { success: url ? 'Imagen hero actualizada' : 'Imagen hero eliminada' }
}

export async function updateGymWebGalleryAction(urls: string[]): Promise<ConfigActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  if (!Array.isArray(urls)) return { error: 'Array requerido' }
  if (urls.length > 12) return { error: 'Máximo 12 imágenes en galería' }
  for (const u of urls) {
    if (typeof u !== 'string' || !/^https?:\/\//.test(u)) {
      return { error: 'URL inválida en la galería' }
    }
  }

  const gymId = await resolveActiveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('gyms')
    .update({ web_gallery_urls: urls })
    .eq('id', gymId)

  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/configuracion')
  return { success: `Galería actualizada (${urls.length} imágenes)` }
}
