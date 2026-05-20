import { NextRequest, NextResponse } from 'next/server'
import { canAccessTrainer, getServerAuthContext } from '@/lib/serverAuth'
import { fetchTrainerLedenData } from '@/lib/trainerData'

type RouteParams = {
  params: Promise<{ trainer_id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { trainer_id } = await params
  const auth = await getServerAuthContext(req)

  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!canAccessTrainer(auth, trainer_id)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  return NextResponse.json(await fetchTrainerLedenData(auth.supabase, trainer_id))
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { trainer_id } = await params
  const auth = await getServerAuthContext(req)

  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!canAccessTrainer(auth, trainer_id)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  const body = await req.json()
  if (typeof body.lid_id !== 'string' || !body.lid_id.trim()) {
    return NextResponse.json({ error: 'Lid-ID is verplicht' }, { status: 400 })
  }
  if (typeof body.voornaam !== 'string' || !body.voornaam.trim()) {
    return NextResponse.json({ error: 'Voornaam is verplicht' }, { status: 400 })
  }
  if (typeof body.achternaam !== 'string' || !body.achternaam.trim()) {
    return NextResponse.json({ error: 'Achternaam is verplicht' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('leden')
    .insert({
      lid_id: body.lid_id.trim().toUpperCase(),
      voornaam: body.voornaam.trim(),
      achternaam: body.achternaam.trim(),
      email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null,
      telefoon: typeof body.telefoon === 'string' && body.telefoon.trim() ? body.telefoon.trim() : null,
      trainer_id,
      startdatum: typeof body.startdatum === 'string' && body.startdatum ? body.startdatum : new Date().toISOString().slice(0, 10),
      source: 'manual',
      actief: true,
      status: 'Actief',
    })
    .select('id')

  if (error) {
    return NextResponse.json(
      { error: error.message.includes('unique') ? `Lid-ID "${body.lid_id}" bestaat al` : error.message },
      { status: 500 }
    )
  }
  if (!data?.length) return NextResponse.json({ error: 'Lid aanmaken mislukt' }, { status: 500 })

  return NextResponse.json({ success: true, id: data[0].id }, { status: 201 })
}
