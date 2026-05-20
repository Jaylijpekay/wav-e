import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ role: null })

  return NextResponse.json({
    role: auth.role,
    authMode: auth.authMode,
    trainerId: auth.trainerId,
  })
}
