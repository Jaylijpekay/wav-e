import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

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
  lid_id: string | null
}

type BerichtItem = {
  id: string
  trainer_id: string
  trainer_naam: string
  auteur_id: string
  auteur_type: string
  tekst: string
  aangemaakt_op: string
  lid_id: string | null
  lid_naam: string | null
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return jsonError('Niet ingelogd', 401)
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return jsonError('Geen toegang', 403)
  }
  const supabase = auth.supabase

  const { data: berichtenRaw, error: berichtenError } = await supabase
    .from('trainer_notities')
    .select('id, trainer_id, auteur_id, auteur_type, tekst, aangemaakt_op, lid_id')
    .eq('verwijderd', false)
    .eq('auteur_type', 'trainer')
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
      auteur_type: r.auteur_type,
      tekst: r.tekst,
      aangemaakt_op: r.aangemaakt_op,
      lid_id: r.lid_id,
      lid_naam: lidNaam,
    }
  })

  return NextResponse.json({ berichten })
}
