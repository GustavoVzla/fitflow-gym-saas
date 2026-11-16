#!/usr/bin/env node
/**
 * Run pgTAP RLS tests against Supabase project.
 *
 * Requires DATABASE_URL in env. In local dev, use the Supabase connection string
 * from Project Settings → Database (direct connection, not pooler).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/run-rls-tests.mjs
 *   npm run test:rls
 *
 * Exit 0 if all tests pass, 1 otherwise.
 */
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TESTS_DIR = join(__dirname, '..', 'supabase', 'tests')

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL env var required.\n' +
      'Get it from Supabase Dashboard → Project Settings → Database → Connection string → Direct.\n' +
      'Example: export DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@HOST.supabase.co:5432/postgres"'
  )
  process.exit(1)
}

const files = (await readdir(TESTS_DIR)).filter((f) => f.startsWith('rls_') && f.endsWith('.sql')).sort()

const client = new pg.Client({ connectionString: url })
await client.connect()

let totalOk = 0
let totalFail = 0
const failures = []

for (const file of files) {
  console.log(`\n=== ${file} ===`)
  const sql = await readFile(join(TESTS_DIR, file), 'utf8')
  try {
    const res = await client.query(sql)
    // Each test file ends with SELECT step, result FROM test_results — grab that
    const lastResult = Array.isArray(res) ? res[res.length - 1] : res
    const rows = lastResult?.rows ?? []
    for (const row of rows) {
      const ok = row.result?.startsWith('ok')
      if (ok) totalOk++
      else {
        totalFail++
        failures.push(`${file}: ${row.result}`)
      }
      console.log(`  ${row.result}`)
    }
  } catch (e) {
    totalFail++
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${file}: ${msg}`)
    console.error(`  FAIL: ${msg}`)
  }
}

await client.end()

console.log(`\n=== Summary ===`)
console.log(`  passed: ${totalOk}`)
console.log(`  failed: ${totalFail}`)
if (failures.length > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
process.exit(0)
