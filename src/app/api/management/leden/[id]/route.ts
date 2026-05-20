import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

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

    const { error } = await auth.supabase
      .from('leden')
      .update(update)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.trainer_id) {
    if (typeof body.trainer_id !== 'string') {
      return NextResponse.json({ error: 'trainer_id must be a string' }, { status: 400 })
    }

    const { data: trainer } = await auth.supabase
      .from('trainers')
      .select('id')
      .eq('id', body.trainer_id)
      .eq('actief', true)
      .single()

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer niet gevonden' }, { status: 404 })
    }

    const { error } = await auth.supabase
      .from('leden')
      .update({ trainer_id: body.trainer_id })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
