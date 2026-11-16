#!/usr/bin/env node
/**
 * Smoke test — /auth/callback handler ambos flows.
 *
 * Valida:
 *   1. Sin params → redirect /login?error=invalid_link (regresión anterior)
 *   2. Con code ficticio → redirect /login?error=<msg> (OAuth flow detectado, falla intercambio esperado)
 *   3. Con token_hash+type ficticios → redirect /login?error=<msg> (OTP flow detectado, falla verify esperado)
 *
 * Lo importante: que NO devuelva invalid_link en casos 2 y 3 (eso confirma
 * que el handler detectó el flow correcto y llegó a llamar Supabase Auth).
 *
 * Uso: BASE_URL=https://panel.example.com node scripts/test-oauth-callback.mjs
 * (Compat 7d: app.example.com también funciona durante ventana dual-domain)
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

const TESTS = [
  {
    name: 'No params → invalid_link',
    url: '/auth/callback',
    expectLocationContains: 'error=invalid_link',
    expectStatus: 307,
  },
  {
    name: 'OAuth code → NOT invalid_link (OAuth flow detected)',
    url: '/auth/callback?code=fake_oauth_code_abc123',
    expectLocationContains: 'error=', // error some other (bad code), NOT invalid_link
    expectLocationNotContains: 'error=invalid_link',
    expectStatus: 307,
  },
  {
    name: 'OTP token_hash+type → NOT invalid_link (OTP flow detected)',
    url: '/auth/callback?token_hash=fake_token_abc123&type=email',
    expectLocationContains: 'error=',
    expectLocationNotContains: 'error=invalid_link',
    expectStatus: 307,
  },
]

let failures = 0

for (const t of TESTS) {
  const url = `${BASE_URL}${t.url}`
  try {
    const res = await fetch(url, { redirect: 'manual' })
    const location = res.headers.get('location') ?? ''
    const statusOk = res.status === t.expectStatus
    const contains = !t.expectLocationContains || location.includes(t.expectLocationContains)
    const notContains = !t.expectLocationNotContains || !location.includes(t.expectLocationNotContains)
    const ok = statusOk && contains && notContains
    const icon = ok ? '✅' : '❌'
    console.log(`${icon} ${t.name}`)
    console.log(`   status=${res.status} location=${location}`)
    if (!ok) {
      failures++
      if (!statusOk) console.log(`   Expected status ${t.expectStatus}, got ${res.status}`)
      if (!contains) console.log(`   Expected location to contain "${t.expectLocationContains}"`)
      if (!notContains) console.log(`   Expected location NOT to contain "${t.expectLocationNotContains}"`)
    }
  } catch (err) {
    console.log(`❌ ${t.name} — fetch error: ${err instanceof Error ? err.message : err}`)
    failures++
  }
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`)
  process.exit(1)
}
console.log(`\n✅ All ${TESTS.length} callback tests OK`)
