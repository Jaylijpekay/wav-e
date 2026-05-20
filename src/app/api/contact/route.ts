import { NextRequest, NextResponse } from 'next/server'
import { canAccessLid, getServerAuthContext } from '@/lib/serverAuth'

const ALLOWED_TYPES = ['gesprek', 'training', 'whatsapp', 'telefoon', 'overig'] as const

export async function POST(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  let body: { lid_id?: unknown; trainer_id?: unknown; datum?: unknown; type?: unknown; notities?: unknown; contact_door?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 }) }

  const lidId     = typeof body.lid_id     === 'string' ? body.lid_id     : null
  const trainerId = typeof body.trainer_id === 'string' ? body.trainer_id : null
  const datum     = typeof body.datum      === 'string' ? body.datum      : null
  const type      = typeof body.type       === 'string' ? body.type       : null

  if (!lidId)     return NextResponse.json({ error: 'lid_id is verplicht' },     { status: 400 })
  if (!trainerId) return NextResponse.json({ error: 'trainer_id is verplicht' }, { status: 400 })
  if (!datum)     return NextResponse.json({ error: 'datum is verplicht' },      { status: 400 })
  if (!type)      return NextResponse.json({ error: 'type is verplicht' },       { status: 400 })
  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: `type moet een van de volgende waarden zijn: ${ALLOWED_TYPES.join(', ')}` }, { status: 400 })
  }

  if (!(await canAccessLid(auth, lidId))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const notities    = typeof body.notities    === 'string' && body.notities.trim()    ? body.notities.trim()    : null
  const contactDoor = typeof body.contact_door === 'string' && body.contact_door.trim() ? body.contact_door.trim() : null

  const { error } = await auth.supabase.from('contact_momenten').insert({
    lid_id:       lidId,
    trainer_id:   trainerId,
    datum,
    type,
    notities,
    contact_door: contactDoor,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
