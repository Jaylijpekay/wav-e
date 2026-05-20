import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('console_session', '', { maxAge: 0, path: '/' })
  res.cookies.set('console_token', '', { maxAge: 0, path: '/' })
  return res
}
