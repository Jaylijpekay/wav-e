import { NextRequest, NextResponse } from 'next/server'
import { createConsoleSession, verifyConsoleSession } from '@/lib/consoleSession'

export async function POST(req: NextRequest) {
  const session = await verifyConsoleSession(req.cookies.get('console_session')?.value)
  if (!session) {
    return NextResponse.json({ error: 'Sessie verlopen' }, { status: 401 })
  }

  const maxAge = 60 * 60 * 12
  const res = NextResponse.json({ ok: true })
  res.cookies.set('console_session', await createConsoleSession(session.type, session.id, maxAge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  })
  return res
}
