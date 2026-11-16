import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { ClauseRow } from './types'

export type { ClauseRow } from './types'

export const getClauses = cache(async (): Promise<ClauseRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gym_clause_templates')
    .select('id, code, title, body, is_required, is_active, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getClauses] error:', error)
    return []
  }

  return (data ?? []).map((c): ClauseRow => ({
    id: c.id,
    code: c.code,
    title: c.title,
    body: c.body,
    isRequired: c.is_required,
    isActive: c.is_active,
    sortOrder: c.sort_order ?? 0,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))
})
