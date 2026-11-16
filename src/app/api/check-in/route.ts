import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/check-in — instructor clock-in (RD-ley 8/2019)
 *
 * Body opcional: { lat?: number, lng?: number, source?: 'webapp'|'pwa'|'manual' }
 * Default source: 'pwa'.
 *
 * Auth: requiere sesión autenticada del instructor (cookie Supabase Auth).
 * El RPC `instructor_check_in` busca el instructor.user_id = auth.uid() y
 * cierra cualquier sesión abierta antes de crear la nueva.
 *
 * Pendiente: migración 0066 apply (cron-triggered self-prompt rejected,
 * PM aplica via MCP propio). Hasta entonces el endpoint devuelve 503.
 */
export async function POST(req: Request) {
  let body: { lat?: number; lng?: number; source?: 'webapp' | 'pwa' | 'manual' } = {}
  try {
    body = await req.json()
  } catch {
    // body opcional
  }

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb.rpc('instructor_check_in', {
    p_location_lat: typeof body.lat === 'number' ? body.lat : undefined,
    p_location_lng: typeof body.lng === 'number' ? body.lng : undefined,
    p_source: body.source ?? 'pwa',
  })

  if (error) {
    if (error.code === '42P01' || String(error.message ?? '').includes('does not exist')) {
      return NextResponse.json(
        { ok: false, error: 'instructor_check_ins schema pendiente apply (migración 0066)' },
        { status: 503 }
      )
    }
    if (error.code === '42501') {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, checkIn: data })
}

/**
 * DELETE /api/check-in — instructor clock-out (cierra sesión abierta)
 */
export async function DELETE() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb.rpc('instructor_check_out')

  if (error) {
    if (error.code === '42P01' || String(error.message ?? '').includes('does not exist')) {
      return NextResponse.json(
        { ok: false, error: 'instructor_check_ins schema pendiente apply (migración 0066)' },
        { status: 503 }
      )
    }
    if (error.code === '42501') {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, checkOut: data })
}
