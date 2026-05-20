import { NextRequest, NextResponse } from 'next/server'
import { canAccessLid, getServerAuthContext } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const lidId = req.nextUrl.searchParams.get('lid_id')
  if (!lidId) return NextResponse.json({ error: 'lid_id is verplicht' }, { status: 400 })

  if (!(await canAccessLid(auth, lidId))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('acties')
    .select('id, omschrijving, status, aangemaakt, deadline')
    .eq('lid_id', lidId)
    .eq('status', 'open')
    .order('aangemaakt', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ acties: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'trainer' && auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  let body: { lid_id?: unknown; trainer_id?: unknown; omschrijving?: unknown; deadline?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 }) }

  const lidId       = typeof body.lid_id      === 'string' && body.lid_id      ? body.lid_id      : null
  const bodyTrainer = typeof body.trainer_id  === 'string' && body.trainer_id  ? body.trainer_id  : null
  const omschrijving = typeof body.omschrijving === 'string' ? body.omschrijving.trim() : ''
  const deadline    = typeof body.deadline    === 'string' && body.deadline    ? body.deadline    : null

  if (!omschrijving) return NextResponse.json({ error: 'omschrijving is verplicht' }, { status: 400 })

  // Lid-less actie: management/admin assigning a task directly to a trainer
  if (!lidId) {
    if (auth.role === 'trainer') {
      return NextResponse.json({ error: 'Trainers moeten een lid selecteren' }, { status: 400 })
    }
    if (!bodyTrainer) {
      return NextResponse.json({ error: 'trainer_id is verplicht wanneer geen lid is opgegeven' }, { status: 400 })
    }

    const { data: trainerExists } = await auth.supabase
      .from('trainers')
      .select('id')
      .eq('id', bodyTrainer)
      .single()
    if (!trainerExists) {
      return NextResponse.json({ error: 'trainer niet gevonden' }, { status: 404 })
    }

    const { data, error } = await auth.supabase
      .from('acties')
      .insert({
        lid_id:          null,
        trainer_id:      bodyTrainer,
        omschrijving,
        deadline,
        status:          'open',
        type:            'custom',
        bron:            'management',
        afgerond:        false,
        aangemaakt_door: auth.personId,
      })
      .select('id, omschrijving, status, aangemaakt, deadline')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ actie: data }, { status: 201 })
  }

  // Lid-tied actie
  const { data: lid, error: lidError } = await auth.supabase
    .from('leden')
    .select('id, trainer_id')
    .eq('id', lidId)
    .eq('actief', true)
    .maybeSingle()

  if (lidError) return NextResponse.json({ error: lidError.message }, { status: 500 })
  if (!lid) return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })

  if (auth.role === 'trainer' && auth.trainerId !== lid.trainer_id) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('acties')
    .insert({
      lid_id:          lidId,
      trainer_id:      lid.trainer_id,
      omschrijving,
      deadline,
      status:          'open',
      type:            'custom',
      bron:            auth.role === 'trainer' ? 'trainer' : 'management',
      afgerond:        false,
      aangemaakt_door: auth.personId,
    })
    .select('id, omschrijving, status, aangemaakt, deadline')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ actie: data }, { status: 201 })
}
