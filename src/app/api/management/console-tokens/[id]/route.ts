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
  const { actief } = await req.json()
  if (typeof actief !== 'boolean') {
    return NextResponse.json({ error: 'actief (boolean) is verplicht' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('console_tokens')
    .update({ actief })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { id } = await params

  const { error } = await auth.supabase
    .from('console_tokens')
    .delete()
    .eq('id', id)
    .eq('actief', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
