import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

/**
 * Security headers — FASE 2 SECURITY_CHECKLIST regla #14.
 *
 * Panel FitFlow (panel.example.com). Patrón copiado de App PWA PR #65
 * + `*.ingest.sentry.io` en connect-src (Panel SÍ usa Sentry SDK).
 *
 * CSP unsafe-inline/eval justificada: Next.js App Router + Tailwind v4
 * + Stripe Checkout iframe + Supabase OAuth redirect + Google OAuth button
 * + Sentry browser SDK.
 *
 * frame-ancestors none = clickjacking proof (admin panel sensible).
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")',
  },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://accounts.google.com https://*.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://accounts.google.com https://*.vercel.app https://*.vercel-insights.com https://*.ingest.sentry.io",
      "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://accounts.google.com",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
      "base-uri 'self'",
      "object-src 'none'",
      "manifest-src 'self'",
      "worker-src 'self' blob:",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? 'your-sentry-org',
  project: process.env.SENTRY_PROJECT ?? 'fitflow',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
})
