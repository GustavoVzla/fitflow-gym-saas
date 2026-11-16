import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { GroupRow, GroupMemberRow, ClassOption, MemberOption } from './types'

export type { GroupRow, GroupMemberRow, ClassOption, MemberOption } from './types'

export const getGroups = cache(async (): Promise<GroupRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('training_groups')
    .select(`
      id, name, description, default_class_id, color, is_active, created_at,
      default_class:default_class_id (name),
      members:training_group_members(member_id)
    `)
    .order('name', { ascending: true })

  if (error) {
    console.error('[getGroups] error:', error)
    return []
  }

  return (data ?? []).map((g): GroupRow => {
    const cls = Array.isArray(g.default_class) ? g.default_class[0] : g.default_class
    const members = Array.isArray(g.members) ? g.members : []
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      defaultClassId: g.default_class_id,
      defaultClassName: cls?.name ?? null,
      color: g.color ?? '#0B4B8C',
      isActive: g.is_active,
      memberCount: members.length,
      createdAt: g.created_at,
    }
  })
})

export async function getGroupMembers(groupId: string): Promise<GroupMemberRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('training_group_members')
    .select(`
      member_id, added_at,
      member:member_id (first_name, last_name, email)
    `)
    .eq('group_id', groupId)

  return (data ?? []).map((r): GroupMemberRow => {
    const m = Array.isArray(r.member) ? r.member[0] : r.member
    return {
      memberId: r.member_id,
      name: m ? `${m.first_name} ${m.last_name}`.trim() : 'Socio eliminado',
      email: m?.email ?? null,
      addedAt: r.added_at,
    }
  })
}

export const getClasses = cache(async (): Promise<ClassOption[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (data ?? []).map((c) => ({ id: c.id, name: c.name }))
})

export const getAssignableMembers = cache(async (): Promise<MemberOption[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('members')
    .select('id, first_name, last_name, email')
    .eq('status', 'active')
    .order('last_name', { ascending: true })
    .limit(500)

  return (data ?? []).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`.trim(),
    email: m.email,
  }))
})
