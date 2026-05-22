import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerAuthContext, getServiceRoleClient } from '@/lib/serverAuth'

type AuteurType = 'trainer' | 'management' | 'admin'
type Role = AuteurType

type NotitieRow = {
  id: string
  lid_id: string
  evaluatie_id: string | null
  auteur_id: string
  auteur_type: AuteurType
  tekst: string
  aangemaakt_op: string
  toon_aan_trainer: boolean
  gezien: boolean
}

type NotitieResponse = NotitieRow & {
  auteur_naam: string
}

type RouteParams = {
  params: Promise<{ lid_id: string }>
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

async function canAccessLid(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  role: Role | null,
  trainerId: string | null,
  lidId: string
) {
  if (role === 'admin' || role === 'management') return true
  if (role !== 'trainer' || !trainerId) return false

  const { data: lid, error } = await supabase
    .from('leden')
    .select('id')
    .eq('id', lidId)
    .eq('trainer_id', trainerId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return Boolean(lid)
}

async function resolveAuteurNamen(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  notities: NotitieRow[]
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

  return notities.map<NotitieResponse>((notitie) => {
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
    const { lid_id } = await params
    const { supabase, user, role, trainerId } = await getAuthContext(req)

    if (!user) {
      return jsonError('Niet ingelogd', 401)
    }

    if (!role || !(await canAccessLid(supabase, role, trainerId, lid_id))) {
      return jsonError('Geen toegang', 403)
    }

    const evaluatieId = req.nextUrl.searchParams.get('evaluatie_id')
    let query = supabase
      .from('notities')
      .select(
        'id, lid_id, evaluatie_id, auteur_id, auteur_type, tekst, aangemaakt_op, toon_aan_trainer, gezien'
      )
      .eq('lid_id', lid_id)
      .eq('verwijderd', false)
      .order('aangemaakt_op', { ascending: false })

    if (evaluatieId) {
      query = query.eq('evaluatie_id', evaluatieId)
    }

    const { data, error: notitiesError } = await query

    if (notitiesError) {
      return jsonError(notitiesError.message, 500)
    }

    const notities = await resolveAuteurNamen(
      supabase,
      (data ?? []) as NotitieRow[]
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
    const { lid_id } = await params
    const { supabase, user, role, trainerId } = await getAuthContext(req)

    if (!user) {
      return jsonError('Niet ingelogd', 401)
    }

    if (!role || !(await canAccessLid(supabase, role, trainerId, lid_id))) {
      return jsonError('Geen toegang', 403)
    }

    const db = getServiceRoleClient()

    let body: {
      tekst?: unknown
      evaluatie_id?: unknown
      toon_aan_trainer?: unknown
    }

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

    const evaluatieId =
      typeof body.evaluatie_id === 'string' && body.evaluatie_id
        ? body.evaluatie_id
        : null

    if (body.evaluatie_id !== undefined && body.evaluatie_id !== null) {
      if (typeof body.evaluatie_id !== 'string' || !body.evaluatie_id) {
        return jsonError('Ongeldige evaluatie', 400)
      }

      const { data: evaluatie, error: evaluatieError } = await db
        .from('evaluaties')
        .select('id')
        .eq('id', body.evaluatie_id)
        .eq('lid_id', lid_id)
        .maybeSingle()

      if (evaluatieError) {
        return jsonError(evaluatieError.message, 500)
      }

      if (!evaluatie) {
        return jsonError('Evaluatie niet gevonden', 400)
      }
    }

    const toonAanTrainer =
      typeof body.toon_aan_trainer === 'boolean'
        ? body.toon_aan_trainer
        : false

    const { data, error: insertError } = await db
      .from('notities')
      .insert({
        lid_id,
        evaluatie_id: evaluatieId,
        auteur_id: user.id,
        auteur_type: role,
        tekst,
        toon_aan_trainer: toonAanTrainer,
      })
      .select(
        'id, lid_id, evaluatie_id, auteur_id, auteur_type, tekst, aangemaakt_op, toon_aan_trainer, gezien'
      )

    if (insertError) {
      return jsonError(insertError.message, 500)
    }

    if (!data?.length) {
      return jsonError('Insert mislukt', 500)
    }

    const [notitie] = await resolveAuteurNamen(
      db,
      data as NotitieRow[]
    )

    return NextResponse.json(notitie, { status: 201 })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Onbekende fout',
      500
    )
  }
}
