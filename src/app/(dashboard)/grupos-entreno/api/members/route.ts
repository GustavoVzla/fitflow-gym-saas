import { NextRequest, NextResponse } from 'next/server'
import { getGroupMembers } from '../../data'

export async function GET(req: NextRequest) {
  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const members = await getGroupMembers(groupId)
  return NextResponse.json({ members })
}
