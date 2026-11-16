import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

export interface ShopProduct {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  category: string | null
  sku: string | null
  isActive: boolean
  imageUrl: string | null
  taxRate: number
  // 0074 extensions
  costPriceCents: number | null
  stockMin: number | null
  barcode: string | null
  attributes: Record<string, string | number | boolean>
  // Helpers
  isLowStock: boolean
  marginEuros: number | null // price - cost (en €)
}

export type ShopOrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'

export interface ShopOrder {
  id: string
  orderNumber: string
  memberId: string | null
  memberName: string | null
  total: number
  subtotal: number
  taxAmount: number
  status: ShopOrderStatus
  itemsCount: number
  createdAt: string
}

export const getProducts = cache(async (): Promise<ShopProduct[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('[getProducts] error:', error)
    return []
  }

  return ((data ?? []) as Record<string, unknown>[]).map((p): ShopProduct => {
    const price = Number(p.price)
    const costCents = (p.cost_price_cents as number | null) ?? null
    const costEuros = costCents != null ? costCents / 100 : null
    const marginEuros = costEuros != null ? price - costEuros : null
    const stock = (p.stock as number | null) ?? 0
    const stockMin = (p.stock_min as number | null) ?? null
    const attrs = (typeof p.attributes === 'object' && p.attributes !== null && !Array.isArray(p.attributes))
      ? (p.attributes as Record<string, string | number | boolean>)
      : {}
    return {
      id: p.id as string,
      name: p.name as string,
      description: (p.description as string | null) ?? null,
      price,
      stock,
      category: (p.category as string | null) ?? null,
      sku: (p.sku as string | null) ?? null,
      isActive: (p.is_active as boolean) ?? true,
      imageUrl: (p.image_url as string | null) ?? null,
      taxRate: Number(p.tax_rate ?? 0),
      costPriceCents: costCents,
      stockMin,
      barcode: (p.barcode as string | null) ?? null,
      attributes: attrs,
      isLowStock: stockMin != null && stock <= stockMin,
      marginEuros,
    }
  })
})

export const getOrders = cache(async (): Promise<ShopOrder[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('shop_orders')
    .select(`
      id, order_number, member_id, subtotal, tax_amount, total, status, items, created_at,
      member:member_id (first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[getOrders] error:', error)
    return []
  }

  return (data ?? []).map((o): ShopOrder => {
    const m = Array.isArray(o.member) ? o.member[0] : o.member
    const items = Array.isArray(o.items) ? o.items : []
    return {
      id: o.id,
      orderNumber: o.order_number,
      memberId: o.member_id,
      memberName: m ? `${m.first_name} ${m.last_name}`.trim() : null,
      subtotal: Number(o.subtotal ?? 0),
      taxAmount: Number(o.tax_amount ?? 0),
      total: Number(o.total),
      status: o.status as ShopOrderStatus,
      itemsCount: items.length,
      createdAt: o.created_at,
    }
  })
})

export const getCategories = cache(async (): Promise<string[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shop_products')
    .select('category')
    .not('category', 'is', null)

  const set = new Set<string>()
  ;(data ?? []).forEach((r) => {
    if (r.category) set.add(r.category)
  })
  return Array.from(set).sort()
})
