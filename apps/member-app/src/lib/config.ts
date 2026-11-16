/**
 * App URL helper. Para magic link redirects + share links.
 * Prioridad: env explícita → Vercel auto → localhost dev.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
  }
  return 'http://localhost:3001'
}
