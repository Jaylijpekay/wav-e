import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext, getServiceRoleClient } from '@/lib/serverAuth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { id } = await params

  let body: { actief?: unknown; status?: unknown; trainer_id?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 }) }

  if (typeof body.actief === 'boolean') {
    const update: Record<string, unknown> = { actief: body.actief }
    if (typeof body.status === 'string') update.status = body.status

    const db = getServiceRoleClient()
    const { error } = await db
      .from('leden')
      .update(update)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.trainer_id) {
    if (typeof body.trainer_id !== 'string') {
      return NextResponse.json({ error: 'trainer_id must be a string' }, { status: 400 })
    }

    const db = getServiceRoleClient()
    const { data: trainer } = await db
      .from('trainers')
      .select('id')
      .eq('id', body.trainer_id)
      .eq('actief', true)
      .single()

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer niet gevonden' }, { status: 404 })
    }

    const { error } = await db
      .from('leden')
      .update({ trainer_id: body.trainer_id })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { id } = await params
  const db = getServiceRoleClient()

  const { data: lid, error: readError } = await db
    .from('leden')
    .select('id, actief')
    .eq('id', id)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!lid) return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })
  if (lid.actief) {
    return NextResponse.json(
      { error: 'Deactiveer het lid eerst voordat je het permanent verwijdert' },
      { status: 409 }
    )
  }

  // Cascade-delete in child-before-parent order. notities/acties may also
  // reference evaluaties; clearing them by lid_id first leaves nothing
  // pointing at this lid's evaluaties when those go.
  const childTables = [
    'notities',
    'acties',
    'contact_momenten',
    'trainer_notities',
    'evaluaties',
  ] as const

  for (const table of childTables) {
    const { error } = await db.from(table).delete().eq('lid_id', id)
    if (error) {
      return NextResponse.json(
        { error: `Verwijderen mislukt bij ${table}: ${error.message}` },
        { status: 500 }
      )
    }
  }

  const { error: lidError } = await db.from('leden').delete().eq('id', id)
  if (lidError) return NextResponse.json({ error: lidError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
