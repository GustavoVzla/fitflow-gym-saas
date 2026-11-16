import { NextRequest, NextResponse } from 'next/server'
import { getMessages } from '../../data'

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  const messages = await getMessages(conversationId)
  return NextResponse.json({ messages })
}
