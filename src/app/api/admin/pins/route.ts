import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET(_req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getServiceClient()

  const [{ data: trainerData, error: trainerError }, { data: mgmtData, error: mgmtError }] = await Promise.all([
    supabase.from('trainers').select('id, voornaam, achternaam, pin_hash').eq('actief', true).order('achternaam'),
    supabase.from('management_gebruikers').select('id, voornaam, achternaam, pin_hash').eq('actief', true).order('achternaam'),
  ])

  if (trainerError) return NextResponse.json({ error: trainerError.message }, { status: 500 })
  if (mgmtError)    return NextResponse.json({ error: mgmtError.message   }, { status: 500 })

  const trainers = [
    ...(trainerData ?? []).map(t => ({
      trainer_id: t.id,
      naam:       `${t.voornaam} ${t.achternaam}`,
      has_pin:    t.pin_hash !== null,
      type:       'trainer' as const,
    })),
    ...(mgmtData ?? []).map(m => ({
      trainer_id: m.id,
      naam:       `${m.voornaam} ${m.achternaam}`,
      has_pin:    m.pin_hash !== null,
      type:       'management' as const,
    })),
  ]

  return NextResponse.json({ trainers })
}
