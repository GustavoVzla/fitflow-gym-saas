import { NextRequest, NextResponse } from 'next/server'
import { getFamilyMembers } from '../../data'

export async function GET(req: NextRequest) {
  const familyId = req.nextUrl.searchParams.get('familyId')
  if (!familyId) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const members = await getFamilyMembers(familyId)
  return NextResponse.json({ members })
}
