'use server'

import { z } from 'zod'
import { rateLimit } from '@/lib/ratelimit'
import { sanitizeServerError } from '@/lib/errors'
import { getReportDetail, type ReportKey } from './data'

const VALID_REPORT_KEYS = [
  'active-members',
  'new-members',
  'cancelled-members',
  'class-attendance',
  'class-popularity',
  'instructor-load',
  'sales-summary',
  'sales-by-day',
  'sales-by-tariff',
  'cohorts',
  'retention',
  'member-booking-avg',
  'late-cancellations',
  'penalties',
  'class-hours',
  'class-ratings',
  'instructor-hours',
  'cash-report',
  'balance',
  'cancelled-payments',
  // Paridad 38
  'daily-attendance',
  'cancellation-reasons',
  'class-attendance-ranking',
  'instructor-comparative',
  'age-distribution',
  'member-tenure',
  'families-revenue',
  'avisos-sent',
  'tasks-completion',
] as const satisfies readonly ReportKey[]

const reportKeySchema = z.string().refine(
  (v) => (VALID_REPORT_KEYS as readonly string[]).includes(v),
  'Informe inválido'
)

export async function loadReportAction(key: ReportKey) {
  const rl = await rateLimit('api')
  if (!rl.success) {
    return { error: `Demasiados intentos. Reintenta en ${rl.retryAfter}s.` }
  }

  const parsed = reportKeySchema.safeParse(key)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Informe inválido' }
  }

  try {
    const detail = await getReportDetail(parsed.data as ReportKey)
    return { detail }
  } catch (e) {
    return { error: sanitizeServerError(e, 'Error al cargar informe') }
  }
}
