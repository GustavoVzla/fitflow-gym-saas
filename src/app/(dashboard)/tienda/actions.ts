'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'

type ActionState = { error?: string; success?: string; id?: string }

async function resolveGymId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('current_user_gyms')
  return data && data.length > 0 ? data[0].gym_id : null
}

const createProductSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.string().trim().max(2000).or(z.literal('')).optional(),
  price: z.string().refine(
    (v) => {
      const n = Number(v.replace(',', '.'))
      return Number.isFinite(n) && n >= 0 && n <= 100000
    },
    'Precio inválido'
  ),
  stock: z.string().refine(
    (v) => {
      const n = parseInt(v)
      return Number.isInteger(n) && n >= 0 && n <= 1_000_000
    },
    'Stock inválido'
  ),
  category: z.string().trim().max(80).or(z.literal('')).optional(),
  sku: z.string().trim().max(60).or(z.literal('')).optional(),
  // 0074 extensions (todas opcionales)
  costPrice: z.string().refine(
    (v) => {
      if (!v || v.trim() === '') return true
      const n = Number(v.replace(',', '.'))
      return Number.isFinite(n) && n >= 0 && n <= 100000
    },
    'Precio de compra inválido'
  ).or(z.literal('')).optional(),
  stockMin: z.string().refine(
    (v) => {
      if (!v || v.trim() === '') return true
      const n = parseInt(v)
      return Number.isInteger(n) && n >= 0 && n <= 1_000_000
    },
    'Stock mínimo inválido'
  ).or(z.literal('')).optional(),
  barcode: z.string().trim().max(32).or(z.literal('')).optional(),
  imageUrl: z.string().trim().url().or(z.literal('')).optional(),
  attributes: z.string().or(z.literal('')).optional(), // JSON serializado opcional
})

const VALID_ORDER_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'] as const
type ShopOrderStatus = (typeof VALID_ORDER_STATUSES)[number]

const uuidSchema = z.string().trim().uuid('ID inválido')

export async function createProductAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = createProductSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const gymId = await resolveGymId()
  if (!gymId) return { error: 'No hay gym activo' }

  // Parse extensions 0074
  const costPriceStr = parsed.data.costPrice ?? ''
  const costPriceCents =
    costPriceStr && costPriceStr.trim() !== ''
      ? Math.round(Number(costPriceStr.replace(',', '.')) * 100)
      : null
  const stockMinStr = parsed.data.stockMin ?? ''
  const stockMin = stockMinStr && stockMinStr.trim() !== '' ? parseInt(stockMinStr) : null
  const barcode = parsed.data.barcode?.trim() || null
  const imageUrl = parsed.data.imageUrl?.trim() || null

  // Parse attributes JSON (silent-ignore si inválido)
  let attributes: Record<string, unknown> = {}
  if (parsed.data.attributes && parsed.data.attributes.trim() !== '') {
    try {
      const obj = JSON.parse(parsed.data.attributes)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        attributes = obj as Record<string, unknown>
      }
    } catch {
      // invalid JSON → silent ignore (UI valida client-side)
    }
  }

  // Columnas 0074 no están en tipos generados aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('shop_products') as any)
    .insert({
      gym_id: gymId,
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
      price: Number(parsed.data.price.replace(',', '.')),
      stock: parseInt(parsed.data.stock),
      category: parsed.data.category?.trim() || null,
      sku: parsed.data.sku?.trim() || null,
      image_url: imageUrl,
      cost_price_cents: costPriceCents,
      stock_min: stockMin,
      barcode,
      attributes,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) return { error: sanitizeServerError(error, 'Error al crear producto') }

  revalidatePath('/tienda')
  return { success: 'Producto creado', id: data.id }
}

// Update order status (pending → paid → fulfilled, o cancelled/refunded)
export async function updateOrderStatusAction(
  id: string,
  newStatus: ShopOrderStatus
): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: 'ID inválido' }

  if (!VALID_ORDER_STATUSES.includes(newStatus)) {
    return { error: 'Estado inválido' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('shop_orders')
    .update({ status: newStatus })
    .eq('id', parsed.data)

  if (error) return { error: sanitizeServerError(error) }

  revalidatePath('/tienda')
  const labels: Record<ShopOrderStatus, string> = {
    pending: 'Marcada pendiente',
    paid: 'Pago registrado',
    fulfilled: 'Entregada al socio',
    cancelled: 'Pedido cancelado',
    refunded: 'Reembolso emitido',
  }
  return { success: labels[newStatus] }
}

export async function toggleProductAction(id: string, isActive: boolean): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('shop_products')
    .update({ is_active: isActive })
    .eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/tienda')
  return { success: isActive ? 'Producto activado' : 'Producto desactivado' }
}

export async function deleteProductAction(id: string): Promise<ActionState> {
  const rl = await rateLimit('api')
  if (!rl.success) return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }

  const parsed = uuidSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'ID requerido' }

  const supabase = await createClient()
  const { error } = await supabase.from('shop_products').delete().eq('id', parsed.data)
  if (error) return { error: sanitizeServerError(error) }
  revalidatePath('/tienda')
  return { success: 'Producto eliminado' }
}
