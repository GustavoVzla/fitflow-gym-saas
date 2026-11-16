export type ProspectStatus = 'new' | 'contacted' | 'scheduled_visit' | 'converted' | 'lost'

export interface ProspectRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: string | null
  interest: string | null
  status: ProspectStatus
  notes: string | null
  lastContactAt: string | null
  conversionMemberId: string | null
  lostReason: string | null
  createdAt: string
  updatedAt: string
}

export interface TariffOption {
  id: string
  name: string
  price: number
}

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  scheduled_visit: 'Visita agendada',
  converted: 'Convertido',
  lost: 'Perdido',
}

export const STATUS_COLOR: Record<ProspectStatus, string> = {
  new: 'bg-sky-100 text-sky-800',
  contacted: 'bg-amber-100 text-amber-800',
  scheduled_visit: 'bg-violet-100 text-violet-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-slate-100 text-slate-600',
}

export const STATUS_ORDER: ProspectStatus[] = [
  'new',
  'contacted',
  'scheduled_visit',
  'converted',
  'lost',
]
