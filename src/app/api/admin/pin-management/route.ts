import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

export async function POST(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'admin' && auth.role !== 'management') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  const supabase = auth.supabase

  const { management_id, pin } = await req.json()

  if (!management_id) {
    return NextResponse.json({ error: 'management_id verplicht' }, { status: 400 })
  }
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN moet exact 4 cijfers zijn' }, { status: 400 })
  }

  const { error } = await supabase.rpc('set_management_pin', {
    p_management_id: management_id,
    p_pin: pin,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
