import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'
import { getLatestContactDatum } from '@/lib/stoplight'

type LidRow = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  actief: boolean
  status: string | null
  trainer_id: string
}

type ContactRow = {
  lid_id: string
  datum: string | null
}

type EvaluatieRow = {
  lid_id: string
  datum: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
  cyclus: number
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const supabase = auth.supabase

  const [
    { data: trainers },
    { data: leden },
    { data: acties },
  ] = await Promise.all([
    supabase.from('trainers').select('id, voornaam, achternaam, naam, email, actief').order('achternaam'),
    supabase.from('leden').select('id, lid_id, voornaam, achternaam, actief, status, trainer_id').order('achternaam'),
    supabase.from('acties').select('id, trainer_id, lid_id').eq('status', 'open'),
  ])

  const ledenRows = (leden ?? []) as LidRow[]
  const lidIds = ledenRows.map(lid => lid.id).filter(Boolean)

  const [{ data: contacten }, { data: evaluaties }] = lidIds.length > 0
    ? await Promise.all([
        supabase.from('contact_momenten').select('lid_id, datum').in('lid_id', lidIds).order('datum', { ascending: false }),
        supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').in('lid_id', lidIds).order('datum', { ascending: false }),
      ])
    : [{ data: [] as ContactRow[] }, { data: [] as EvaluatieRow[] }]

  const latestContactByLid = new Map<string, string | null>()
  for (const contact of (contacten ?? []) as ContactRow[]) {
    if (!latestContactByLid.has(contact.lid_id)) {
      latestContactByLid.set(contact.lid_id, contact.datum)
    }
  }

  const latestEvaluatieByLid = new Map<string, EvaluatieRow>()
  for (const evaluatie of (evaluaties ?? []) as EvaluatieRow[]) {
    if (!latestEvaluatieByLid.has(evaluatie.lid_id)) {
      latestEvaluatieByLid.set(evaluatie.lid_id, evaluatie)
    }
  }

  const enrichedLeden = ledenRows.map(lid => {
    const lastContact = latestContactByLid.get(lid.id) ?? null
    const lastEval = latestEvaluatieByLid.get(lid.id)
    return {
      ...lid,
      gestopt_op: null,
      laatste_contact: getLatestContactDatum(lastContact, lastEval?.datum),
      laatste_evaluatie: lastEval?.datum ?? null,
      slaap: lastEval?.slaap ?? null,
      energie: lastEval?.energie ?? null,
      stress: lastEval?.stress ?? null,
    }
  })

  return NextResponse.json({
    trainers:   trainers   ?? [],
    leden:      enrichedLeden,
    acties:     acties     ?? [],
  })
}
