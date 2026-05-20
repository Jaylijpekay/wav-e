import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerAuthContext } from '@/lib/serverAuth'

type Role = 'trainer' | 'management' | 'admin'

type RouteParams = {
  params: Promise<{
    lid_id: string
    notitie_id: string
  }>
}

const DELETE_ROLES: Role[] = ['trainer', 'management', 'admin']
const GEZIEN_ROLES: Role[] = ['trainer', 'admin']

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
    role: DELETE_ROLES.includes(auth.role as Role) ? (auth.role as Role) : null,
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

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { lid_id, notitie_id } = await params
    const { supabase, user, role, trainerId, error } = await getAuthContext(req)

    if (!user) {
      return jsonError('Niet ingelogd', 401)
    }

    if (
      !role ||
      !DELETE_ROLES.includes(role) ||
      !(await canAccessLid(supabase, role, trainerId, lid_id))
    ) {
      return jsonError('Geen toegang', 403)
    }

    const { data, error: updateError } = await supabase
      .from('notities')
      .update({
        verwijderd: true,
        verwijderd_op: new Date().toISOString(),
      })
      .eq('id', notitie_id)
      .eq('lid_id', lid_id)
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

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { lid_id, notitie_id } = await params
    const { supabase, user, role, trainerId, error } = await getAuthContext(req)

    if (!user) {
      return jsonError('Niet ingelogd', 401)
    }

    if (
      !role ||
      !GEZIEN_ROLES.includes(role) ||
      !(await canAccessLid(supabase, role, trainerId, lid_id))
    ) {
      return jsonError('Geen toegang', 403)
    }

    let body: { gezien?: unknown }

    try {
      body = await req.json()
    } catch {
      return jsonError('Ongeldige JSON', 400)
    }

    if (body.gezien !== true) {
      return jsonError('Ongeldige actie', 400)
    }

    const { data, error: updateError } = await supabase
      .from('notities')
      .update({
        gezien: true,
        gezien_op: new Date().toISOString(),
      })
      .eq('id', notitie_id)
      .eq('lid_id', lid_id)
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
