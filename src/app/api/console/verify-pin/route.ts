import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createConsoleSession } from '@/lib/consoleSession'

const pinAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 6
const WINDOW_MS = 5 * 60 * 1000

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { type, id, pin } = await req.json()

  if (!type || !id || !pin) {
    return NextResponse.json({ error: 'Ontbrekende velden' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const token = req.cookies.get('console_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Geen console token' }, { status: 401 })
  }

  const { data: tokenValid } = await supabase.rpc('validate_console_token', { p_token: token })
  if (!tokenValid) {
    return NextResponse.json({ error: 'Ongeldig console token' }, { status: 401 })
  }

  const attemptKey = `${token}:${type}:${id}`
  const now = Date.now()
  const attempts = pinAttempts.get(attemptKey)
  if (attempts && attempts.resetAt > now && attempts.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Te veel pogingen. Probeer later opnieuw.' }, { status: 429 })
  }

  let valid = false
  if (type === 'trainer') {
    const { data } = await supabase.rpc('verify_trainer_pin', { p_trainer_id: id, p_pin: pin })
    valid = !!data
  } else if (type === 'management') {
    const { data } = await supabase.rpc('verify_management_pin', { p_management_id: id, p_pin: pin })
    valid = !!data
  } else {
    return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 })
  }

  if (!valid) {
    const current = attempts && attempts.resetAt > now
      ? attempts
      : { count: 0, resetAt: now + WINDOW_MS }
    pinAttempts.set(attemptKey, { ...current, count: current.count + 1 })
    return NextResponse.json({ error: 'Onjuiste PIN' }, { status: 401 })
  }

  pinAttempts.delete(attemptKey)

  const maxAge = 60 * 60 * 12
  const res = NextResponse.json({ ok: true })
  res.cookies.set('console_session', await createConsoleSession(type, id, maxAge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  })
  return res
}
