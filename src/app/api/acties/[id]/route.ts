import { NextRequest, NextResponse } from 'next/server'
import { canAccessLid, getServerAuthContext } from '@/lib/serverAuth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { id } = await params

  const { data: actie, error: actieError } = await auth.supabase
    .from('acties')
    .select('id, lid_id, trainer_id')
    .eq('id', id)
    .maybeSingle()

  if (actieError) return NextResponse.json({ error: actieError.message }, { status: 500 })
  if (!actie) return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 })

  if (auth.role === 'trainer') {
    if (actie.lid_id) {
      if (!(await canAccessLid(auth, actie.lid_id))) {
        return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
      }
    } else if (actie.trainer_id !== auth.trainerId) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }
  }

  const { error } = await auth.supabase
    .from('acties')
    .update({ status: 'afgerond', afgerond: true, afgerond_op: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
