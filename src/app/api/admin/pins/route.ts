import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

type TrainerRow = { id: string; voornaam: string; achternaam: string; pin_hash: string | null }
type MgmtRow = {
  id: string
  voornaam: string
  achternaam: string
  email: string | null
  pin_hash: string | null
  supabase_user_id: string | null
}
type MgmtFallbackRow = Omit<MgmtRow, 'supabase_user_id'>

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const supabase = auth.supabase

  const [trainerResult, managementResult] = await Promise.all([
    supabase.from('trainers').select('id, voornaam, achternaam, pin_hash').eq('actief', true).order('achternaam'),
    supabase
      .from('management_gebruikers')
      .select('id, voornaam, achternaam, email, pin_hash, supabase_user_id')
      .eq('actief', true)
      .order('achternaam'),
  ])

  let mgmtData = managementResult.data as MgmtRow[] | null
  let mgmtError = managementResult.error

  if (mgmtError) {
    const fallback = await supabase
      .from('management_gebruikers')
      .select('id, voornaam, achternaam, email, pin_hash')
      .eq('actief', true)
      .order('achternaam')

    mgmtData = fallback.data
      ? (fallback.data as MgmtFallbackRow[]).map(row => ({ ...row, supabase_user_id: null }))
      : null
    mgmtError = fallback.error
  }

  const { data: trainerData, error: trainerError } = trainerResult

  if (trainerError) return NextResponse.json({ error: trainerError.message }, { status: 500 })
  if (mgmtError)    return NextResponse.json({ error: mgmtError.message   }, { status: 500 })

  const trainers = [
    ...(trainerData as TrainerRow[] ?? []).map(t => ({
      trainer_id: t.id,
      naam:       `${t.voornaam} ${t.achternaam}`,
      has_pin:    t.pin_hash !== null,
      type:       'trainer' as const,
    })),
    ...(mgmtData as MgmtRow[] ?? []).map(m => ({
      trainer_id: m.id,
      naam:       `${m.voornaam} ${m.achternaam}`,
      has_pin:    m.pin_hash !== null,
      type:       'management' as const,
    })),
  ]

  // Console sessions match by person UUID. Browser sessions should match by
  // auth UUID, with email as a fallback for older management rows.
  let currentPerson = null
  if (auth.authMode === 'console') {
    currentPerson = (mgmtData as MgmtRow[] ?? []).find(m => m.id === auth.personId) ?? null
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const managementRows = (mgmtData as MgmtRow[] ?? [])
      currentPerson =
        managementRows.find(m => m.supabase_user_id === user.id) ??
        managementRows.find(m => m.id === user.id) ??
        managementRows.find(m => m.email?.toLowerCase() === user.email?.toLowerCase()) ??
        null

      if (currentPerson && currentPerson.supabase_user_id !== user.id) {
        await supabase
          .from('management_gebruikers')
          .update({ supabase_user_id: user.id })
          .eq('id', currentPerson.id)
      }
    }
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
