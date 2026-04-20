import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Geen token' }, { status: 400 })

  const supabase = getServiceClient()
  const { data } = await supabase.rpc('validate_console_token', { p_token: token })

  if (!data) return NextResponse.json({ error: 'Ongeldig token' }, { status: 401 })

  // Touch token — update laatst_gebruikt
  await supabase.rpc('touch_console_token', { p_token: token })

  // Set cookie so device doesn't need URL again
  const res = NextResponse.json({ ok: true })
  res.cookies.set('console_token', token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })
  return res
}
