/**
 * Plan tiers + feature gating matrix.
 *
 * Mapping confirmed (24-abr-2026): Base = paridad funcional TOTAL con LegacyGym
 * (según auditoría en internal docs, not included).
 * Ofertas + Competiciones existen en LegacyGym → Base (antes Pro por error).
 * Pro añade solo los 3 diferenciadores reales que LegacyGym NO tiene:
 *   chatbot-ia, automatizaciones (IA), analiticas-ia.
 *
 * Tiers superiores (Premium, App Pro, Enterprise) heredan todo de Pro + extras
 * fuera de la matriz base (ej. app móvil custom, white-label, soporte dedicado).
 */

export type PlanTier =
  | 'base'
  | 'smart'
  | 'pro'
  | 'premium'
  | 'app_pro'
  | 'enterprise'

export const PLAN_RANK: Record<PlanTier, number> = {
  base: 1,
  smart: 2,
  pro: 3,
  premium: 4,
  app_pro: 5,
  enterprise: 6,
}

export type FeatureKey =
  // Base features (paridad LegacyGym)
  | 'dashboard'
  | 'reservas'
  | 'horario'
  | 'socios'
  | 'pagos'
  | 'clases-tarifas'
  | 'citas'
  | 'tareas'
  | 'mensajes'
  | 'fidelizacion'
  | 'publicaciones'
  | 'entrenamientos'
  | 'tienda'
  | 'informes'
  | 'configuracion'
  | 'mejoras'
  // Base — también existen en LegacyGym (paridad)
  | 'competiciones'
  | 'ofertas'
  // Base — CRM paridad LegacyGym sub-menú Miembros (PE bloque 0054-0056)
  | 'familias'
  | 'grupos-entreno'
  | 'potenciales'
  | 'instructores'
  // Pro — diferenciadoras FitFlow (LegacyGym NO tiene)
  | 'chatbot-ia'
  | 'automatizaciones'
  | 'analiticas-ia'

export const FEATURE_MIN_PLAN: Record<FeatureKey, PlanTier> = {
  // Base — everything LegacyGym has
  dashboard: 'base',
  reservas: 'base',
  horario: 'base',
  socios: 'base',
  pagos: 'base',
  'clases-tarifas': 'base',
  citas: 'base',
  tareas: 'base',
  mensajes: 'base',
  fidelizacion: 'base',
  publicaciones: 'base',
  entrenamientos: 'pro', // F2 Clases 1.3: placeholder post-firma, Pro-only en Base gate
  tienda: 'base',
  informes: 'base',
  configuracion: 'base',
  mejoras: 'base',
  competiciones: 'base',
  ofertas: 'base',
  familias: 'base',
  'grupos-entreno': 'base',
  potenciales: 'base',
  instructores: 'base',
  // Pro — what LegacyGym doesn't have
  'chatbot-ia': 'pro',
  automatizaciones: 'pro',
  'analiticas-ia': 'pro',
}

export function isFeatureAvailable(
  currentPlan: PlanTier,
  feature: FeatureKey
): boolean {
  return PLAN_RANK[currentPlan] >= PLAN_RANK[FEATURE_MIN_PLAN[feature]]
}

export const PLAN_LABEL: Record<PlanTier, string> = {
  base: 'BASE',
  smart: 'SMART',
  pro: 'PRO',
  premium: 'PREMIUM',
  app_pro: 'APP PRO',
  enterprise: 'ENTERPRISE',
}

/**
 * Style classes for the badge shown next to locked features in the sidebar.
 * Keys are the minimum required plan to unlock.
 */
export const PLAN_BADGE_STYLES: Record<PlanTier, string> = {
  base: 'bg-slate-100 text-slate-600 ring-slate-200',
  smart: 'bg-violet-100 text-violet-700 ring-violet-200',
  pro: 'bg-blue-100 text-blue-700 ring-blue-200',
  premium: 'bg-amber-100 text-amber-700 ring-amber-200',
  app_pro: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  enterprise: 'bg-purple-100 text-purple-700 ring-purple-200',
}
