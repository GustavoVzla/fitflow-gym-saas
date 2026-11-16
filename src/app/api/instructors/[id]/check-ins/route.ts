import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/instructors/[id]/check-ins?month=YYYY-MM
 *
 * Devuelve check-ins del instructor para el mes indicado (default: mes actual).
 * Auth requerido. RLS controla quién puede ver qué (staff del gym + el propio instructor).
 *
 * Pendiente: migración 0066 apply (PM via MCP).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const monthParam = url.searchParams.get('month')

  let monthStart: string
  let monthEnd: string

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split('-').map(Number)
    monthStart = new Date(Date.UTC(y, m - 1, 1)).toISOString()
    monthEnd = new Date(Date.UTC(y, m, 1)).toISOString()
  } else {
    const now = new Date()
    monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('instructor_check_ins')
    .select('id, checked_in_at, checked_out_at, duration_minutes, source, cancelled')
    .eq('instructor_id', id)
    .eq('cancelled', false)
    .gte('checked_in_at', monthStart)
    .lt('checked_in_at', monthEnd)
    .order('checked_in_at', { ascending: false })
    .limit(100)

  if (error) {
    if (error.code === '42P01' || String(error.message ?? '').includes('does not exist')) {
      return NextResponse.json({ ok: true, entries: [] })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = (data ?? []).map((r: any) => ({
    id: r.id,
    checkedInAt: r.checked_in_at,
    checkedOutAt: r.checked_out_at,
    durationMinutes: r.duration_minutes,
    source: r.source,
    cancelled: r.cancelled,
  }))

  return NextResponse.json({ ok: true, entries })
}
