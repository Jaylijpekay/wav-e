import { createServerClient } from '@supabase/ssr'
import { type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerAuthContext, getServiceRoleClient } from '@/lib/serverAuth'

type AuteurType = 'trainer' | 'management' | 'admin'
type Role = AuteurType

type TrainerNotitieRow = {
  id: string
  trainer_id: string
  lid_id: string | null
  auteur_id: string
  auteur_type: AuteurType
  tekst: string
  aangemaakt_op: string
}

type TrainerNotitieResponse = TrainerNotitieRow & {
  auteur_naam: string
}

type RouteParams = {
  params: Promise<{ trainer_id: string }>
}

const ALLOWED_ROLES: Role[] = ['trainer', 'management', 'admin']

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

async function getSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
}

async function getAuthContext(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) {
    const supabase = await getSupabase()
    return { supabase, user: null, role: null, trainerId: null, error: null }
  }

  return {
    supabase: auth.supabase,
    user: { id: auth.personId },
    role: ALLOWED_ROLES.includes(auth.role as Role) ? (auth.role as Role) : null,
    trainerId: auth.trainerId,
    error: null,
  }
}

function isAllowed(role: Role | null, ownTrainerId: string | null, trainerId: string) {
  if (role === 'admin' || role === 'management') return true
  return role === 'trainer' && ownTrainerId === trainerId
}

async function resolveAuteurNamen(
  supabase: SupabaseClient,
  notities: TrainerNotitieRow[]
) {
  const trainerIds = [
    ...new Set(
      notities
        .filter((notitie) => notitie.auteur_type === 'trainer')
        .map((notitie) => notitie.auteur_id)
    ),
  ]
  const managementIds = [
    ...new Set(
      notities
        .filter((notitie) => notitie.auteur_type === 'management')
        .map((notitie) => notitie.auteur_id)
    ),
  ]

  const [trainersResult, managementResult] = await Promise.all([
    trainerIds.length
      ? supabase.from('trainers').select('id, naam').in('id', trainerIds)
      : Promise.resolve({ data: [], error: null }),
    managementIds.length
      ? supabase
          .from('management_gebruikers')
          .select('id, voornaam, achternaam')
          .in('id', managementIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (trainersResult.error) {
    throw new Error(trainersResult.error.message)
  }

  if (managementResult.error) {
    throw new Error(managementResult.error.message)
  }

  const trainerNamen = new Map<string, string>(
    (trainersResult.data ?? []).map((trainer) => [
      trainer.id,
      trainer.naam ?? 'Onbekende trainer',
    ])
  )
  const managementNamen = new Map<string, string>(
    (managementResult.data ?? []).map((management) => [
      management.id,
      [management.voornaam, management.achternaam].filter(Boolean).join(' ') ||
        'Onbekende gebruiker',
    ])
  )

  return notities.map<TrainerNotitieResponse>((notitie) => {
    let auteur_naam = 'Admin'

    if (notitie.auteur_type === 'trainer') {
      auteur_naam = trainerNamen.get(notitie.auteur_id) ?? 'Onbekende trainer'
    }

    if (notitie.auteur_type === 'management') {
      auteur_naam =
        managementNamen.get(notitie.auteur_id) ?? 'Onbekende gebruiker'
    }

    return {
      ...notitie,
      auteur_naam,
    }
  })
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { trainer_id } = await params
    const { user, role, trainerId } = await getAuthContext(req)

    if (!user) {
      return jsonError('Niet ingelogd', 401)
    }

    if (!isAllowed(role, trainerId, trainer_id)) {
      return jsonError('Geen toegang', 403)
    }

    const db = getServiceRoleClient()

    const { data, error: notitiesError } = await db
      .from('trainer_notities')
      .select('id, trainer_id, lid_id, auteur_id, auteur_type, tekst, aangemaakt_op')
      .eq('trainer_id', trainer_id)
      .eq('verwijderd', false)
      .order('aangemaakt_op', { ascending: true })

    if (notitiesError) {
      return jsonError(notitiesError.message, 500)
    }

    const notities = await resolveAuteurNamen(
      db,
      (data ?? []) as TrainerNotitieRow[]
    )

    return NextResponse.json({ notities })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Onbekende fout',
      500
    )
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { trainer_id } = await params
    const { user, role, trainerId } = await getAuthContext(req)

    if (!user) {
      return jsonError('Niet ingelogd', 401)
    }

    if (!isAllowed(role, trainerId, trainer_id) || !role) {
      return jsonError('Geen toegang', 403)
    }

    let body: { tekst?: unknown; lid_id?: unknown }

    try {
      body = await req.json()
    } catch {
      return jsonError('Ongeldige JSON', 400)
    }

    if (typeof body.tekst !== 'string' || !body.tekst.trim()) {
      return jsonError('Tekst is verplicht', 400)
    }

    const tekst = body.tekst.trim()

    if (tekst.length > 1000) {
      return jsonError('Tekst mag maximaal 1000 tekens zijn', 400)
    }

    const lidId =
      typeof body.lid_id === 'string' && body.lid_id.trim()
        ? body.lid_id.trim()
        : null

    // Service-role client bypasses RLS — required because the SSR client from
    // getServerAuthContext leaks the caller's JWT into the Authorization header
    // and re-enables RLS at PostgREST, causing "permission denied for table users"
    // when management replies.
    const db = getServiceRoleClient()

    const { data, error: insertError } = await db
      .from('trainer_notities')
      .insert({
        trainer_id,
        lid_id: lidId,
        auteur_id: user.id,
        auteur_type: role,
        tekst,
      })
      .select('id, trainer_id, lid_id, auteur_id, auteur_type, tekst, aangemaakt_op')

    if (insertError) {
      return jsonError(insertError.message, 500)
    }

    if (!data?.length) {
      return jsonError('Insert mislukt', 500)
    }

    const [notitie] = await resolveAuteurNamen(
      db,
      data as TrainerNotitieRow[]
    )

    return NextResponse.json(notitie, { status: 201 })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Onbekende fout',
      500
    )
  }
}
