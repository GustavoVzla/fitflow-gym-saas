export interface GroupRow {
  id: string
  name: string
  description: string | null
  defaultClassId: string | null
  defaultClassName: string | null
  color: string
  isActive: boolean
  memberCount: number
  createdAt: string
}

export interface GroupMemberRow {
  memberId: string
  name: string
  email: string | null
  addedAt: string
}

export interface ClassOption {
  id: string
  name: string
}

export interface MemberOption {
  id: string
  name: string
  email: string | null
}
