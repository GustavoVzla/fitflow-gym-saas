import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import CajaDiariaPrintable from './CajaDiariaPrintable'
import PrintButton from '../facturacion/[id]/PrintButton'

export const metadata = {
  title: 'Caja diaria · FitFlow',
}

type Props = {
  searchParams: Promise<{ date?: string }>
}

type PaymentRow = {
  id: string
  memberName: string
  description: string
  amount: number
  method: string
  paidAt: string
  externalReference: string | null
}

async function getDayPayments(date: string): Promise<PaymentRow[]> {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return []
  const gymId = gyms[0].gym_id

  // Rango UTC del día en zona del gym (simplificado: usa el offset del propio Postgres server.
  // El filtro por date::text bastaría, pero preferimos timestamp para incluir paid_at con hora).
  const start = `${date}T00:00:00`
  const end = `${date}T23:59:59.999`

  const { data, error } = await supabase
    .from('payments')
    .select(
      `id, description, amount, method, paid_at, external_reference,
       member:member_id (first_name, last_name)`
    )
    .eq('gym_id', gymId)
    .eq('status', 'completed')
    .gte('paid_at', start)
    .lte('paid_at', end)
    .order('paid_at', { ascending: true })
    .limit(500)

  if (error || !data) return []

  return data.map((p): PaymentRow => {
    const m = Array.isArray(p.member) ? p.member[0] : p.member
    const memberName = m
      ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Socio sin nombre'
      : 'Socio eliminado'
    return {
      id: p.id,
      memberName,
      description: p.description,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paid_at ?? '',
      externalReference: p.external_reference,
    }
  })
}

async function getGymProfile() {
  const supabase = await createClient()
  const { data: gyms } = await supabase.rpc('current_user_gyms')
  if (!gyms || gyms.length === 0) return null
  const { data } = await supabase
    .from('gyms')
    .select('name, legal_name, tax_id, fiscal_address_line1, fiscal_address_postal_code, fiscal_address_city')
    .eq('id', gyms[0].gym_id)
    .single()
  return data
}

export default async function CajaDiariaPage({ searchParams }: Props) {
  const { date } = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const target = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today

  const [payments, gym] = await Promise.all([getDayPayments(target), getGymProfile()])

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/pagos"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Pagos
        </Link>
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-2 text-xs">
            <label htmlFor="date" className="text-slate-500">
              Fecha:
            </label>
            <input
              id="date"
              type="date"
              name="date"
              defaultValue={target}
              className="h-8 rounded-md border border-slate-200 px-2 text-[12px] focus:border-[#3b8bea] focus:ring-1 focus:ring-[#3b8bea]/20 focus:outline-none"
            />
            <button
              type="submit"
              className="h-8 rounded-md bg-slate-100 px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-200"
            >
              Ver
            </button>
          </form>
          <PrintButton />
        </div>
      </div>

      <CajaDiariaPrintable date={target} payments={payments} gymName={gym?.name ?? 'Centro'} legalName={gym?.legal_name ?? null} />
    </div>
  )
}
