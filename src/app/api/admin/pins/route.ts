import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const supabase = auth.supabase

  const [{ data: trainerData, error: trainerError }, { data: mgmtData, error: mgmtError }] = await Promise.all([
    supabase.from('trainers').select('id, voornaam, achternaam, pin_hash').eq('actief', true).order('achternaam'),
    supabase.from('management_gebruikers').select('id, voornaam, achternaam, email, pin_hash').eq('actief', true).order('achternaam'),
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

  // Console sessions: match by person UUID; Supabase sessions: match by email
  let currentPerson = null
  if (auth.authMode === 'console') {
    currentPerson = (mgmtData ?? []).find(m => m.id === auth.personId) ?? null
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    currentPerson = user
      ? (mgmtData ?? []).find(m => m.email?.toLowerCase() === user.email?.toLowerCase()) ?? null
      : null
  }

  return NextResponse.json({
    trainers,
    current_person: currentPerson
      ? {
        trainer_id: currentPerson.id,
        naam:       `${currentPerson.voornaam} ${currentPerson.achternaam}`,
        has_pin:    currentPerson.pin_hash !== null,
        type:       'management' as const,
      }
      : null,
  })
}
