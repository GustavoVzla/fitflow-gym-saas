import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1]
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(\S+)/)[1]

const supabase = createClient(url, key)

// Test 1: Anon client puede ver la tabla gyms (aunque 0 filas por RLS)
const { data, error } = await supabase.from('gyms').select('count')

if (error) {
  console.error('ERROR:', error.message)
  process.exit(1)
}

console.log('Connection Supabase OK')
console.log('  URL:', url)
console.log('  Query response:', JSON.stringify(data))
console.log('  (0 filas es correcto - anon user no tiene acceso a ningun gym por RLS)')
