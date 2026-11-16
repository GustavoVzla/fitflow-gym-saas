'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

export type NewGymResult =
  | { ok: true; userId: string; gymId: string; email: string; tempPassword: string; loginUrl: string }
  | { ok: false; error: string }

export type GymPlan = 'base' | 'smart' | 'pro' | 'premium' | 'app_pro' | 'enterprise'

export type PaymentMode = 'manual' | 'direct_keys' | 'connect_express' | 'connect_standard' | 'managed'

const GYM_PLANS = ['base', 'smart', 'pro', 'premium', 'app_pro', 'enterprise'] as const
const PAYMENT_MODES = ['manual', 'direct_keys', 'connect_express', 'connect_standard', 'managed'] as const

const createGymSchema = z.object({
  clientEmail: z.string().trim().toLowerCase().email('Email cliente inválido').max(200),
  gymName: z.string().trim().min(1, 'Nombre del gym requerido').max(200),
  gymSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/, 'Slug inválido (a-z, 0-9, guiones; 1-50 chars)')
    .or(z.literal('')),
  plan: z.string().refine(
    (v) => (GYM_PLANS as readonly string[]).includes(v),
    'Plan inválido'
  ),
  paymentMode: z.string().refine(
    (v) => (PAYMENT_MODES as readonly string[]).includes(v),
    'Modo de pago inválido'
  ),
  gymPhone: z.string().trim().max(30).optional().or(z.literal('')),
  gymEmail: z.string().trim().email('Email gym inválido').max(200).optional().or(z.literal('')),
  tempPassword: z.string().min(8, 'Password mínimo 8 caracteres').max(128).optional().or(z.literal('')),
})

interface Input {
  clientEmail: string
  gymName: string
  gymSlug: string
  plan: GymPlan
  paymentMode: PaymentMode
  gymPhone?: string
  gymEmail?: string
  tempPassword?: string
}

function randomPassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return 'http://localhost:3000'
}

export async function createGymAsAdmin(input: Input): Promise<NewGymResult> {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = createGymSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const clientEmail = parsed.data.clientEmail
  const gymName = parsed.data.gymName
  const gymSlug = parsed.data.gymSlug.trim() || slugify(gymName)
  const plan = parsed.data.plan as GymPlan
  const gymPhone = parsed.data.gymPhone?.trim() || undefined
  const gymEmail = parsed.data.gymEmail?.trim() || clientEmail
  const tempPassword =
    parsed.data.tempPassword && parsed.data.tempPassword.length >= 8
      ? parsed.data.tempPassword
      : randomPassword(14)

  if (!/^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/.test(gymSlug)) {
    return { ok: false, error: 'Slug inválido (a-z, 0-9, guiones; 1-50 chars)' }
  }

  // Fase 1 (Decision #102): solo admitimos manual y direct_keys en la UI.
  // Los modos connect_* y managed quedan visibles como disabled en el selector
  // pero si alguien bypass la UI y envía otro valor, lo forzamos a manual.
  const allowedPaymentModes: PaymentMode[] = ['manual', 'direct_keys']
  const requestedMode = parsed.data.paymentMode as PaymentMode
  const paymentMode: PaymentMode = allowedPaymentModes.includes(requestedMode)
    ? requestedMode
    : 'manual'

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_create_gym_with_owner', {
    p_client_email: clientEmail,
    p_temp_password: tempPassword,
    p_gym_name: gymName,
    p_gym_slug: gymSlug,
    p_plan: plan,
    p_gym_phone: gymPhone,
    p_gym_email: gymEmail,
    p_payment_mode: paymentMode,
  })

  if (error) return { ok: false, error: sanitizeServerError(error) }
  if (!data || data.length === 0) return { ok: false, error: 'No se recibió respuesta de la DB' }

  const row = data[0]
  return {
    ok: true,
    userId: row.out_user_id,
    gymId: row.out_gym_id,
    email: clientEmail,
    tempPassword,
    loginUrl: `${siteOrigin()}/login`,
  }
}
