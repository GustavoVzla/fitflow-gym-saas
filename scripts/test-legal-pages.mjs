#!/usr/bin/env node
/**
 * E2E smoke test — 5 páginas legales.
 * Valida: status 200, content-type text/html, contenido específico presente.
 *
 * Uso:
 *   BASE_URL=https://panel.example.com node scripts/test-legal-pages.mjs
 *   node scripts/test-legal-pages.mjs  (usa http://localhost:3000)
 *   (Compat 7d: app.example.com también funciona durante ventana dual-domain)
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const LEGAL_PAGES = [
  { path: '/aviso-legal', contains: ['DEMO COMPANY', 'Aviso Legal'] },
  { path: '/terminos', contains: ['DEMO COMPANY', 'Términos'] },
  { path: '/privacidad', contains: ['privacidad@example.com', 'AEPD'] },
  { path: '/cookies', contains: ['cookies', 'consentimiento'] },
  { path: '/disclaimer', contains: ['responsabilidad', 'DEMO COMPANY'] },
]

let failures = 0

for (const page of LEGAL_PAGES) {
  const url = `${BASE_URL}${page.path}`
  try {
    const res = await fetch(url, { redirect: 'manual' })
    const status = res.status
    const contentType = res.headers.get('content-type') ?? ''
    const body = await res.text()

    const statusOk = status === 200
    const htmlOk = contentType.includes('text/html')
    const contentMatches = page.contains.every((s) =>
      body.toLowerCase().includes(s.toLowerCase())
    )

    const ok = statusOk && htmlOk && contentMatches
    const icon = ok ? '✅' : '❌'
    console.log(`${icon} ${page.path} — status=${status} ct=${contentType.slice(0, 30)} contains=${contentMatches}`)
    if (!ok) {
      failures++
      if (!contentMatches) {
        const missing = page.contains.filter(
          (s) => !body.toLowerCase().includes(s.toLowerCase())
        )
        console.log(`   Missing: ${missing.join(', ')}`)
      }
    }
  } catch (err) {
    console.log(`❌ ${page.path} — error: ${err instanceof Error ? err.message : err}`)
    failures++
  }
}

if (failures > 0) {
  console.error(`\n${failures} page(s) failed`)
  process.exit(1)
}
console.log(`\n✅ All ${LEGAL_PAGES.length} legal pages OK`)
