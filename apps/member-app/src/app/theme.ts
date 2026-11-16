/**
 * Demo Studio branding constants.
 *
 * App PWA usa brand FitFlow `#3b8bea` (Panel-aligned, Decision multi-tenant).
 * Sprint 30d: leer de gym_settings.branding JSONB cuando lleguen future tenants y
 * otros clientes (multi-tenant dynamic theming).
 *
 * Los semánticos (success/danger/warning/info) son universales — NO son brand.
 */
export const studioBrand = {
  name: 'Demo Studio',
  shortName: 'Demo Studio',
  description: 'Tu entrenamiento personal — Demo Studio Madrid',
  themeColor: '#0d0d1a',
  backgroundColor: '#0d0d1a',
  colors: {
    bgDeep: '#0d0d1a',
    bgPrimary: '#1a1a2e',
    bgCard: 'rgba(255,255,255,0.04)',
    glass: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.08)',
    brand: '#3b8bea',
    brandLight: '#5da0ef',
    brandDark: '#2a6fc7',
    brandDim: 'rgba(59,139,234,0.15)',
    brandGlow: 'rgba(59,139,234,0.3)',
    textPrimary: '#f0f0f5',
    textSecondary: 'rgba(240,240,245,0.6)',
    textMuted: 'rgba(240,240,245,0.35)',
    success: '#34d399',
    danger: '#f87171',
    info: '#60a5fa',
  },
  fonts: {
    display: '"Sora", -apple-system, BlinkMacSystemFont, sans-serif',
    body: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  // Set en /admin/gyms/[id] panel cuando owner suba logo final.
  // Placeholder day-1: texto-only header.
  logoUrl: null as string | null,
} as const

export type StudioBrand = typeof studioBrand
