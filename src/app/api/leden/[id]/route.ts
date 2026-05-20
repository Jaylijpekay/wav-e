import { NextRequest, NextResponse } from 'next/server'
import { canAccessLid, getServerAuthContext } from '@/lib/serverAuth'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { id } = await params

  if (!(await canAccessLid(auth, id))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const [
    { data: lid },
    { data: evaluaties },
    { data: contacten },
  ] = await Promise.all([
    auth.supabase
      .from('leden')
      .select('id, lid_id, voornaam, achternaam, email, telefoon, geboortedatum, startdatum, actief, trainer_id')
      .eq('id', id)
      .maybeSingle(),
    auth.supabase
      .from('evaluaties')
      .select('id, cyclus, datum, slaap, energie, stress, voeding, beweging, tevredenheid, motivatie, gewicht_kg, vetpercentage, spiermassa_kg, visceraal_vet, buikomvang_cm, doelen_behaald, notities, trainer:trainer_id(voornaam, achternaam)')
      .eq('lid_id', id)
      .order('cyclus', { ascending: false }),
    auth.supabase
      .from('contact_momenten')
      .select('id, datum, type, notities, contact_door')
      .eq('lid_id', id)
      .order('datum', { ascending: false }),
  ])

  if (!lid) return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })

  return NextResponse.json({
    lid,
    evaluaties: evaluaties ?? [],
    contacten:  contacten  ?? [],
  })
}
