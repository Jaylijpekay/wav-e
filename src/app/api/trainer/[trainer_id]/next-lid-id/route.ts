import { NextRequest, NextResponse } from 'next/server'
import { canAccessTrainer, getServerAuthContext } from '@/lib/serverAuth'

type RouteParams = {
  params: Promise<{ trainer_id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { trainer_id } = await params
  const auth = await getServerAuthContext(req)

  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!canAccessTrainer(auth, trainer_id)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  const { data, error } = await auth.supabase.rpc('get_next_lid_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ nextLidId: data ?? 'WE-001' })
}
