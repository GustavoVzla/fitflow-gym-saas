// Tipos compartidos server/client. Sin imports server-only.

export interface KpiSummary {
  activeMembers: number
  newMembersThisMonth: number
  cancelledThisMonth: number
  revenueThisMonth: number
  bookingsLast30: number
  attendanceRate: number // 0..100
}

export interface ReportMeta {
  key: string
  name: string
  description: string
  available: 'v1' | 'v2' // v1 = disponible ahora, v2 = premium roadmap
}

export interface ReportCategory {
  title: string
  reports: ReportMeta[]
}

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: 'Clientes',
    reports: [
      { key: 'active-members', name: 'Clientes activos', description: 'Socios con tarifa vigente y actividad', available: 'v1' },
      { key: 'new-members', name: 'Nuevos clientes', description: 'Altas por mes', available: 'v1' },
      { key: 'cancelled-members', name: 'Bajas / cancelaciones', description: 'Socios dados de baja en el periodo', available: 'v1' },
      { key: 'cohorts', name: 'Análisis de cohortes', description: 'Permanencia de nuevos clientes en el tiempo', available: 'v1' },
      { key: 'retention', name: 'Retención de clientes', description: 'Permanencia media de clientes', available: 'v1' },
      { key: 'member-booking-avg', name: 'Media semanal de reservas', description: 'Media de reservas por cliente', available: 'v1' },
      { key: 'late-cancellations', name: 'Cancelaciones tardías', description: 'Cancelaciones fuera de plazo (<6h)', available: 'v1' },
      { key: 'penalties', name: 'Penalizaciones', description: 'No-shows + cancelaciones tardías por socio', available: 'v1' },
      { key: 'age-distribution', name: 'Edad media socios', description: 'Distribución por tramos <25 / 25-35 / 35-45 / 45-55 / >55', available: 'v1' },
      { key: 'member-tenure', name: 'Antigüedad socios', description: 'Cohorte por mes de alta', available: 'v1' },
      { key: 'cancellation-reasons', name: 'Bajas por motivo', description: 'Top motivos cancelación (lost_reason + notas)', available: 'v1' },
    ],
  },
  {
    title: 'Clases',
    reports: [
      { key: 'class-attendance', name: 'Asistencia por clase', description: 'Reservas, asistencias y no-shows', available: 'v1' },
      { key: 'class-popularity', name: 'Popularidad por clase', description: '% ocupación por clase', available: 'v1' },
      { key: 'class-hours', name: 'Popularidad por hora', description: '% ocupación por franja horaria', available: 'v1' },
      { key: 'daily-attendance', name: 'Asistencia diaria', description: 'Heatmap día × franja horaria (top 30 días)', available: 'v1' },
      { key: 'class-attendance-ranking', name: 'Ranking clases por asistencia media', description: 'Top clases ordenadas por media de asistentes', available: 'v1' },
      { key: 'class-ratings', name: 'Valoración de clases', description: 'Pendiente activar módulo de ratings', available: 'v2' },
    ],
  },
  {
    title: 'Instructores',
    reports: [
      { key: 'instructor-load', name: 'Rendimiento por instructor', description: 'Clases impartidas y asistencias', available: 'v1' },
      { key: 'instructor-hours', name: 'Horas por instructor', description: 'Total de horas impartidas por instructor', available: 'v1' },
      { key: 'instructor-comparative', name: 'Comparativa instructores', description: 'Clases impartidas vs asistencia media + ratio', available: 'v1' },
    ],
  },
  {
    title: 'Ventas',
    reports: [
      { key: 'sales-summary', name: 'Informe de ventas', description: 'Ingresos por cliente y método', available: 'v1' },
      { key: 'sales-by-day', name: 'Ventas por día', description: 'Total de ventas por día', available: 'v1' },
      { key: 'sales-by-tariff', name: 'Ingresos por tarifa', description: 'Ingresos agrupados por tarifa', available: 'v1' },
      { key: 'cash-report', name: 'Informe de caja', description: 'Ingresos completados agrupados por método', available: 'v1' },
      { key: 'balance', name: 'Balance de ingresos', description: 'Gastos, ingresos y balance del mes', available: 'v1' },
      { key: 'cancelled-payments', name: 'Pagos cancelados', description: 'Pagos cancelados del periodo', available: 'v1' },
      { key: 'families-revenue', name: 'Familias e ingresos', description: 'Familias activas + ingresos agregados por familia', available: 'v1' },
    ],
  },
  {
    title: 'Operaciones',
    reports: [
      { key: 'avisos-sent', name: 'Avisos enviados (30d)', description: 'Conteo por trigger_type en dispatch_queue', available: 'v1' },
      { key: 'tasks-completion', name: 'Tareas completadas vs pendientes', description: '% completadas por staff asignado', available: 'v1' },
    ],
  },
]

export interface ReportRow {
  [key: string]: string | number | null
}

export interface ReportDetail {
  columns: Array<{ key: string; label: string; type?: 'text' | 'number' | 'currency' | 'date' }>
  rows: ReportRow[]
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

export function rowsToCsv(detail: ReportDetail, filename: string): { filename: string; content: string } {
  const header = detail.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',')
  const lines = detail.rows.map((row) =>
    detail.columns
      .map((c) => {
        const v = row[c.key]
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return `"${s}"`
      })
      .join(',')
  )
  return { filename, content: [header, ...lines].join('\n') }
}
