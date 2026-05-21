import type { SupabaseClient } from '@supabase/supabase-js'
import { isActieOpen } from '@/lib/actieUrgency'
import { getLatestContactDatum } from '@/lib/stoplight'

type LidBase = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  email?: string | null
  telefoon?: string | null
  geboortedatum?: string | null
  geslacht?: string | null
  startdatum?: string
  status?: string | null
  actief?: boolean
}

type ContactRow = { lid_id: string; datum: string | null }
type EvaluatieRow = {
  id?: string
  lid_id: string
  datum: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
  cyclus?: number | null
}
type ActieRow = {
  id: string
  lid_id: string | null
  omschrijving?: string
  aangemaakt?: string
  deadline?: string | null
  status?: 'open' | 'afgerond' | 'overdue'
  bron?: string | null
  afgerond?: boolean | null
}

const todayIsoDate = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export async function fetchTrainerDashboardData(supabase: SupabaseClient, trainerId: string) {
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, naam')
    .eq('id', trainerId)
    .single()

  const { data: ledenData } = await supabase
    .from('leden')
    .select('id, lid_id, voornaam, achternaam')
    .eq('trainer_id', trainerId)
    .eq('actief', true)
    .order('voornaam')

  const ledenBase = (ledenData ?? []) as LidBase[]
  const lidIds = ledenBase.map(l => l.id)

  if (lidIds.length === 0) {
    return {
      trainer,
      ledenDropdown: [],
      leden: [],
      acties: [],
      momentum: { gesprekken: 0, actiesAfgerond: 0 },
      meldingen: [],
    }
  }

  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = todayIsoDate()

  const [
    { data: contacten },
    { data: evaluaties },
    { data: actiesData },
    { data: trainerActies },
    { data: evalsMaand },
    { data: actiesAfgerondData },
    { data: meldingenData },
  ] = await Promise.all([
    supabase.from('contact_momenten').select('lid_id, datum').in('lid_id', lidIds).order('datum', { ascending: false }),
    supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').in('lid_id', lidIds).order('cyclus', { ascending: false }),
    supabase.from('acties').select('id, lid_id, omschrijving, aangemaakt, deadline, status, bron, afgerond').in('lid_id', lidIds).eq('status', 'open').order('aangemaakt', { ascending: true }),
    supabase.from('acties').select('id, lid_id, omschrijving, aangemaakt, deadline, status, bron, afgerond').eq('trainer_id', trainerId).is('lid_id', null).eq('status', 'open').order('aangemaakt', { ascending: true }),
    supabase.from('evaluaties').select('id').in('lid_id', lidIds).gte('datum', firstOfMonth).lte('datum', today),
    supabase.from('acties').select('id').in('lid_id', lidIds).eq('status', 'afgerond').gte('afgerond_op', firstOfMonth),
    supabase
      .from('notities')
      .select('id, lid_id, tekst, auteur_id, auteur_type, aangemaakt_op')
      .in('lid_id', lidIds)
      .eq('toon_aan_trainer', true)
      .eq('gezien', false)
      .eq('verwijderd', false)
      .order('aangemaakt_op', { ascending: false }),
  ])

  const openActiesPerLid: Record<string, number> = {}
  for (const a of (actiesData ?? []) as ActieRow[]) {
    const bron = a.bron ?? 'trainer'
    const afgerond = a.afgerond ?? a.status === 'afgerond'
    if (a.lid_id && isActieOpen(a.deadline ?? null, bron, afgerond)) {
      openActiesPerLid[a.lid_id] = (openActiesPerLid[a.lid_id] ?? 0) + 1
    }
  }

  const contacts = (contacten ?? []) as ContactRow[]
  const evalRows = (evaluaties ?? []) as EvaluatieRow[]
  const leden = ledenBase.map(l => {
    const lastContact = contacts.find(c => c.lid_id === l.id)
    const lastEval = evalRows.find(e => e.lid_id === l.id)
    return {
      id: l.id,
      lid_id: l.lid_id,
      voornaam: l.voornaam,
      achternaam: l.achternaam,
      laatste_contact: getLatestContactDatum(lastContact?.datum ?? null, lastEval?.datum ?? null),
      laatste_evaluatie: lastEval?.datum ?? null,
      slaap: lastEval?.slaap ?? null,
      energie: lastEval?.energie ?? null,
      stress: lastEval?.stress ?? null,
      open_acties: openActiesPerLid[l.id] ?? 0,
    }
  })

  const memberActies = ((actiesData ?? []) as ActieRow[]).map(a => {
    const lid = ledenBase.find(l => l.id === a.lid_id)
    return {
      id: a.id,
      lid_uuid: a.lid_id,
      lid_id: lid?.lid_id ?? '-',
      voornaam: lid?.voornaam ?? '-',
      achternaam: lid?.achternaam ?? '',
      omschrijving: a.omschrijving ?? '',
      aangemaakt: a.aangemaakt ?? '',
      deadline: a.deadline ?? null,
      status: a.status ?? 'open',
      bron: a.bron ?? 'trainer',
      afgerond: a.afgerond ?? false,
      is_management: (a.bron ?? 'trainer') === 'management',
    }
  })

  const mgmtActies = ((trainerActies ?? []) as ActieRow[]).map(a => ({
    id: a.id,
    lid_uuid: null,
    lid_id: '',
    voornaam: 'Management',
    achternaam: '',
    omschrijving: a.omschrijving ?? '',
    aangemaakt: a.aangemaakt ?? '',
    deadline: a.deadline ?? null,
    status: a.status ?? 'open',
    bron: a.bron ?? 'management',
    afgerond: a.afgerond ?? false,
    is_management: true,
  }))

  const meldingen = ((meldingenData ?? []) as {
    id: string
    lid_id: string
    tekst: string
    auteur_id: string
    auteur_type: string
    aangemaakt_op: string
  }[]).map(melding => {
    const lid = ledenBase.find(l => l.id === melding.lid_id)
    return {
      id: melding.id,
      lid_id: melding.lid_id,
      lid_naam: lid ? `${lid.voornaam} ${lid.achternaam}` : '-',
      tekst: melding.tekst,
      auteur_naam: 'Management',
      aangemaakt_op: melding.aangemaakt_op,
    }
  })

  return {
    trainer,
    ledenDropdown: ledenBase,
    leden,
    acties: [...mgmtActies, ...memberActies],
    momentum: {
      gesprekken: evalsMaand?.length ?? 0,
      actiesAfgerond: actiesAfgerondData?.length ?? 0,
    },
    meldingen,
  }
}

export async function fetchTrainerLedenData(supabase: SupabaseClient, trainerId: string) {
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, naam')
    .eq('id', trainerId)
    .single()

  const { data: ledenData } = await supabase
    .from('leden')
    .select('id, lid_id, voornaam, achternaam, email, telefoon, geboortedatum, geslacht, startdatum, status, actief')
    .eq('trainer_id', trainerId)
    .order('voornaam')

  const ledenBase = (ledenData ?? []) as LidBase[]
  const lidIds = ledenBase.map(l => l.id)

  if (lidIds.length === 0) return { trainer, leden: [] }

  const [{ data: contacten }, { data: evaluaties }, { data: actiesData }] = await Promise.all([
    supabase.from('contact_momenten').select('lid_id, datum').in('lid_id', lidIds).order('datum', { ascending: false }),
    supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').in('lid_id', lidIds).order('cyclus', { ascending: false }),
    supabase.from('acties').select('id, lid_id, deadline, bron, afgerond, status').in('lid_id', lidIds).eq('status', 'open'),
  ])

  const openActiesPerLid: Record<string, number> = {}
  for (const a of (actiesData ?? []) as ActieRow[]) {
    const bron = a.bron ?? 'trainer'
    const afgerond = a.afgerond ?? a.status === 'afgerond'
    if (a.lid_id && isActieOpen(a.deadline ?? null, bron, afgerond)) {
      openActiesPerLid[a.lid_id] = (openActiesPerLid[a.lid_id] ?? 0) + 1
    }
  }

  const contacts = (contacten ?? []) as ContactRow[]
  const evalRows = (evaluaties ?? []) as EvaluatieRow[]

  return {
    trainer,
    leden: ledenBase.map(l => {
      const lastContact = contacts.find(c => c.lid_id === l.id)
      const lastEval = evalRows.find(e => e.lid_id === l.id)
      return {
        ...l,
        laatste_contact: getLatestContactDatum(lastContact?.datum ?? null, lastEval?.datum ?? null),
        laatste_evaluatie: lastEval?.datum ?? null,
        slaap: lastEval?.slaap ?? null,
        energie: lastEval?.energie ?? null,
        stress: lastEval?.stress ?? null,
        open_acties: openActiesPerLid[l.id] ?? 0,
      }
    }),
  }
}
