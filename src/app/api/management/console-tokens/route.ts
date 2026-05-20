import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { data, error } = await auth.supabase
    .from('console_tokens')
    .select('id, token, naam, actief, aangemaakt_op, laatst_gebruikt')
    .order('aangemaakt_op', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tokens: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { naam } = await req.json()
  if (!naam?.trim()) return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('console_tokens')
    .insert({ naam: naam.trim(), trainer_id: null, aangemaakt_door: auth.personId })
    .select('id, token, naam, actief, aangemaakt_op, laatst_gebruikt')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: data }, { status: 201 })
}
