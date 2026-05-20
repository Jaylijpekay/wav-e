import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

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
    { data: contacten },
    { data: evaluaties },
    { data: acties },
  ] = await Promise.all([
    supabase.from('trainers').select('id, voornaam, achternaam, naam, email, actief').order('achternaam'),
    supabase.from('leden').select('id, lid_id, voornaam, achternaam, actief, status, trainer_id').order('achternaam'),
    supabase.from('contact_momenten').select('lid_id, datum').order('datum', { ascending: false }),
    supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').order('cyclus', { ascending: false }),
    supabase.from('acties').select('id, trainer_id, lid_id').eq('status', 'open'),
  ])

  return NextResponse.json({
    trainers:   trainers   ?? [],
    leden:      leden      ?? [],
    contacten:  contacten  ?? [],
    evaluaties: evaluaties ?? [],
    acties:     acties     ?? [],
  })
}
