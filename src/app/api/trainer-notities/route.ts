import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

type TrainerRow = {
  id: string
  voornaam: string | null
  achternaam: string | null
  naam: string | null
}

type LidRow = {
  id: string
  voornaam: string | null
  achternaam: string | null
}

type BerichtRow = {
  id: string
  trainer_id: string
  auteur_id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  tekst: string
  aangemaakt_op: string
  gelezen_door_management: boolean
  lid_id: string | null
}

type BerichtItem = {
  id: string
  trainer_id: string
  trainer_naam: string
  auteur_id: string
  tekst: string
  aangemaakt_op: string
  gelezen_door_management: boolean
  lid_id: string | null
  lid_naam: string | null
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
}

export async function GET() {
  const supabase = await getSupabaseServer()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return jsonError('Niet ingelogd', 401)

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'management' && role !== 'admin') {
    return jsonError('Geen toegang', 403)
  }

  const { data: berichtenRaw, error: berichtenError } = await supabase
    .from('trainer_notities')
    .select('id, trainer_id, auteur_id, auteur_type, tekst, aangemaakt_op, gelezen_door_management, lid_id')
    .eq('verwijderd', false)
    .eq('auteur_type', 'trainer')
    .order('gelezen_door_management', { ascending: true })
    .order('aangemaakt_op', { ascending: false })

  if (berichtenError) return jsonError(berichtenError.message, 500)

  const rows = (berichtenRaw ?? []) as BerichtRow[]

  const trainerIds = [...new Set(rows.map(r => r.trainer_id))]
  const lidIds = [
    ...new Set(rows.map(r => r.lid_id).filter((id): id is string => !!id)),
  ]

  const [trainersResult, ledenResult] = await Promise.all([
    trainerIds.length
      ? supabase.from('trainers').select('id, voornaam, achternaam, naam').in('id', trainerIds)
      : Promise.resolve({ data: [], error: null }),
    lidIds.length
      ? supabase.from('leden').select('id, voornaam, achternaam').in('id', lidIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (trainersResult.error) return jsonError(trainersResult.error.message, 500)
  if (ledenResult.error) return jsonError(ledenResult.error.message, 500)

  const trainerMap = new Map<string, TrainerRow>(
    ((trainersResult.data ?? []) as TrainerRow[]).map(t => [t.id, t])
  )
  const lidMap = new Map<string, LidRow>(
    ((ledenResult.data ?? []) as LidRow[]).map(l => [l.id, l])
  )

  const berichten: BerichtItem[] = rows.map(r => {
    const trainer = trainerMap.get(r.trainer_id)
    const trainerNaam = trainer
      ? (trainer.naam ?? `${trainer.voornaam ?? ''} ${trainer.achternaam ?? ''}`.trim())
      : 'Onbekende trainer'

    const lid = r.lid_id ? lidMap.get(r.lid_id) : null
    const lidNaamRaw = lid
      ? `${lid.voornaam ?? ''} ${lid.achternaam ?? ''}`.trim()
      : ''
    const lidNaam = lidNaamRaw ? lidNaamRaw : null

    return {
      id: r.id,
      trainer_id: r.trainer_id,
      trainer_naam: trainerNaam,
      auteur_id: r.auteur_id,
      tekst: r.tekst,
      aangemaakt_op: r.aangemaakt_op,
      gelezen_door_management: r.gelezen_door_management,
      lid_id: r.lid_id,
      lid_naam: lidNaam,
    }
  })

  return NextResponse.json({ berichten })
}
