import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})

/**
 * Security headers — FASE 2 SECURITY_CHECKLIST.
 *
 * CSP unsafe-inline justificada para PWA Next.js + service worker Serwist + 
 * Stripe Checkout iframe + Supabase OAuth redirects + tailwind v4 inline styles.
 * 
 * frame-ancestors none = clickjacking proof.
 * connect-src whitelist = Supabase + Stripe + Vercel (prod + preview).
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com https://accounts.google.com https://*.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: ",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://accounts.google.com https://*.vercel.app https://*.vercel-insights.com",
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
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  transpilePackages: [],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSerwist(nextConfig)
