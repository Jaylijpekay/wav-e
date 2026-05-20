import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

export async function GET(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  let query = auth.supabase
    .from('leden')
    .select('id, lid_id, voornaam, achternaam, trainer_id')
    .eq('actief', true)
    .order('achternaam')

  if (auth.role === 'trainer') {
    if (!auth.trainerId) return NextResponse.json({ leden: [] })
    query = query.eq('trainer_id', auth.trainerId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leden: data ?? [] })
}
