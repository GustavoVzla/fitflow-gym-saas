import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { FamilyRow, FamilyMemberRow, MemberOption } from './types'

export type { FamilyRow, FamilyMemberRow, MemberOption } from './types'

export const getFamilies = cache(async (): Promise<FamilyRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('families')
    .select(`
      id, name, primary_payer_member_id, billing_email, billing_phone,
      billing_tax_id, billing_address, billing_city, billing_postal_code,
      notes, created_at,
      payer:primary_payer_member_id (first_name, last_name),
      members:family_members(member_id)
    `)
    .order('name', { ascending: true })

  if (error) {
    console.error('[getFamilies] error:', error)
    return []
  }

  return (data ?? []).map((f): FamilyRow => {
    const payer = Array.isArray(f.payer) ? f.payer[0] : f.payer
    const members = Array.isArray(f.members) ? f.members : []
    return {
      id: f.id,
      name: f.name,
      primaryPayerMemberId: f.primary_payer_member_id,
      primaryPayerName: payer
        ? `${payer.first_name} ${payer.last_name}`.trim()
        : null,
      billingEmail: f.billing_email,
      billingPhone: f.billing_phone,
      billingTaxId: f.billing_tax_id,
      billingAddress: f.billing_address,
      billingCity: f.billing_city,
      billingPostalCode: f.billing_postal_code,
      notes: f.notes,
      memberCount: members.length,
      createdAt: f.created_at,
    }
  })
})

export async function getFamilyMembers(familyId: string): Promise<FamilyMemberRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('family_members')
    .select(`
      member_id, added_at,
      member:member_id (first_name, last_name, email, phone)
    `)
    .eq('family_id', familyId)

  return (data ?? []).map((r): FamilyMemberRow => {
    const m = Array.isArray(r.member) ? r.member[0] : r.member
    return {
      memberId: r.member_id,
      name: m ? `${m.first_name} ${m.last_name}`.trim() : 'Socio eliminado',
      email: m?.email ?? null,
      phone: m?.phone ?? null,
      addedAt: r.added_at,
    }
  })
}

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
