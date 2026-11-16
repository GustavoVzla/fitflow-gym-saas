export interface FamilyRow {
  id: string
  name: string
  primaryPayerMemberId: string | null
  primaryPayerName: string | null
  billingEmail: string | null
  billingPhone: string | null
  billingTaxId: string | null
  billingAddress: string | null
  billingCity: string | null
  billingPostalCode: string | null
  notes: string | null
  memberCount: number
  createdAt: string
}

export interface FamilyMemberRow {
  memberId: string
  name: string
  email: string | null
  phone: string | null
  addedAt: string
}

export interface MemberOption {
  id: string
  name: string
  email: string | null
}
