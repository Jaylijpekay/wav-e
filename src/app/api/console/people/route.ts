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
  const supabase = getServiceClient()
  const token = req.nextUrl.searchParams.get('token') ?? req.cookies.get('console_token')?.value

  if (!token) return NextResponse.json({ error: 'Geen token' }, { status: 401 })

  const { data: tokenValid } = await supabase.rpc('validate_console_token', { p_token: token })
  if (!tokenValid) return NextResponse.json({ error: 'Ongeldig token' }, { status: 401 })

  const [{ data: trainers }, { data: management }] = await Promise.all([
    supabase
      .from('trainers')
      .select('id, voornaam, achternaam, pin_hash')
      .eq('actief', true)
      .order('voornaam'),
    supabase
      .from('management_gebruikers')
      .select('id, voornaam, achternaam, pin_hash')
      .eq('actief', true)
      .order('voornaam'),
  ])

  return NextResponse.json({
    trainers: (trainers ?? []).map(t => ({
      id: t.id,
      naam: `${t.voornaam} ${t.achternaam}`,
      voornaam: t.voornaam,
      has_pin: !!t.pin_hash,
    })),
    management: (management ?? []).map(m => ({
      id: m.id,
      naam: `${m.voornaam} ${m.achternaam}`,
      voornaam: m.voornaam,
      has_pin: !!m.pin_hash,
    })),
  })
}
