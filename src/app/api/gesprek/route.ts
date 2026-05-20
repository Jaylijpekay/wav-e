import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerAuthContext } from '@/lib/serverAuth'

type Role = 'trainer' | 'management' | 'admin'

type GesprekPayload = {
  lid_id?: unknown
  datum?: unknown
  slaap?: unknown
  energie?: unknown
  stress?: unknown
  motivatie?: unknown
  tevredenheid?: unknown
  notities?: unknown
}

const ALLOWED_ROLES: Role[] = ['trainer', 'management', 'admin']

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function asScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

async function getSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) {
    return jsonError('Niet ingelogd', 401)
  }
  const { supabase, role, trainerId: ownTrainerId } = auth
  if (!ALLOWED_ROLES.includes(role as Role)) {
    return jsonError('Geen toegang', 403)
  }

  let body: GesprekPayload
  try {
    body = await req.json()
  } catch {
    return jsonError('Ongeldige JSON', 400)
  }

  if (typeof body.lid_id !== 'string' || !body.lid_id) {
    return jsonError('Selecteer een lid.', 400)
  }
  if (typeof body.datum !== 'string' || !body.datum) {
    return jsonError('Datum is verplicht', 400)
  }

  const { data: lid, error: lidError } = await supabase
    .from('leden')
    .select('id, trainer_id')
    .eq('id', body.lid_id)
    .eq('actief', true)
    .maybeSingle()

  if (lidError) return jsonError(lidError.message, 500)
  if (!lid) return jsonError('Lid niet gevonden', 404)

  if (role === 'trainer' && ownTrainerId !== lid.trainer_id) {
    return jsonError('Geen toegang', 403)
  }

  const { count, error: countError } = await supabase
    .from('evaluaties')
    .select('id', { count: 'exact', head: true })
    .eq('lid_id', body.lid_id)

  if (countError) return jsonError(countError.message, 500)

  const { data, error: insertError } = await supabase
    .from('evaluaties')
    .insert({
      lid_id: body.lid_id,
      trainer_id: lid.trainer_id,
      cyclus: (count ?? 0) + 1,
      datum: body.datum,
      slaap: asScore(body.slaap),
      energie: asScore(body.energie),
      stress: asScore(body.stress),
      motivatie: asScore(body.motivatie),
      tevredenheid: asScore(body.tevredenheid),
      notities: typeof body.notities === 'string' && body.notities.trim()
        ? body.notities.trim()
        : null,
    })
    .select('id')

  if (insertError) return jsonError(insertError.message, 500)
  if (!data?.length) return jsonError('Gesprek opslaan mislukt', 500)

  return NextResponse.json({ success: true, id: data[0].id }, { status: 201 })
}
