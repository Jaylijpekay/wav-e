import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerAuthContext } from '@/lib/serverAuth'

type Role = 'trainer' | 'management' | 'admin'

type RouteParams = {
  params: Promise<{
    trainer_id: string
    notitie_id: string
  }>
}

type TrainerNotitieRow = {
  id: string
  trainer_id: string
  auteur_id: string
  auteur_type: Role
  verwijderd: boolean
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

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { trainer_id, notitie_id } = await params
    const { supabase, user, role, trainerId } = await getAuthContext(req)

    if (!user) {
      return jsonError('Niet ingelogd', 401)
    }

    if (!isAllowed(role, trainerId, trainer_id)) {
      return jsonError('Geen toegang', 403)
    }

    const { data: existing, error: readError } = await supabase
      .from('trainer_notities')
      .select('id, trainer_id, auteur_id, auteur_type, verwijderd')
      .eq('id', notitie_id)
      .eq('trainer_id', trainer_id)
      .maybeSingle()

    if (readError) {
      return jsonError(readError.message, 500)
    }

    const notitie = existing as TrainerNotitieRow | null
    if (!notitie || notitie.verwijderd) {
      return jsonError('Notitie niet gevonden', 404)
    }

    const isOriginalTrainer =
      role === 'trainer' &&
      trainerId === trainer_id &&
      notitie.auteur_type === 'trainer' &&
      notitie.auteur_id === user.id
    const isManagement = role === 'management' || role === 'admin'

    if (!isOriginalTrainer && !isManagement) {
      return jsonError('Alleen de auteur mag dit bericht verwijderen', 403)
    }

    const { data, error: updateError } = await supabase
      .from('trainer_notities')
      .update({
        verwijderd: true,
        verwijderd_op: new Date().toISOString(),
      })
      .eq('id', notitie_id)
      .eq('trainer_id', trainer_id)
      .select('id')

    if (updateError) {
      return jsonError(updateError.message, 500)
    }

    if (!data?.length) {
      return jsonError('Notitie niet gevonden', 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'Onbekende fout',
      500
    )
  }
}
