import { NextRequest, NextResponse } from 'next/server'
import { canAccessTrainer, getServerAuthContext } from '@/lib/serverAuth'
import { fetchTrainerDashboardData } from '@/lib/trainerData'

type RouteParams = {
  params: Promise<{ trainer_id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { trainer_id } = await params
  const auth = await getServerAuthContext(req)

  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!canAccessTrainer(auth, trainer_id)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  return NextResponse.json(await fetchTrainerDashboardData(auth.supabase, trainer_id))
}
