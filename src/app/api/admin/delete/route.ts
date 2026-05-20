import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function getAdminClient() {
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

async function getSessionClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
}

// AUTH: This route requires a valid Supabase session with role 'admin'.
// Console sessions are not accepted. Do not migrate to service-role-only
// until admin UI is moved off the browser Supabase client.
export async function DELETE(req: NextRequest) {
  const sessionClient = await getSessionClient()
  const { data: { user }, error: userError } = await sessionClient.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const { data: role } = await sessionClient.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const supabase = await getAdminClient()

  const { target_user_id } = await req.json()

  if (!target_user_id) {
    return NextResponse.json({ error: 'target_user_id verplicht' }, { status: 400 })
  }

  const { data: roleRow, error: roleError } = await supabase
    .from('user_roles')
    .select('role, trainer_id')
    .eq('user_id', target_user_id)
    .maybeSingle()

  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  if (!roleRow) {
    return NextResponse.json({ error: 'Gebruiker heeft geen verwijderbare rol' }, { status: 400 })
  }

  if (roleRow.role === 'trainer' && roleRow.trainer_id) {
    const { data, error } = await supabase
      .from('trainers')
      .update({ actief: false })
      .eq('id', roleRow.trainer_id)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Trainer niet gevonden' }, { status: 404 })
  }

  if (roleRow.role === 'management') {
    // Match by auth user UUID, not email — avoids silent mismatch if emails differ
    const { data, error } = await supabase
      .from('management_gebruikers')
      .update({ actief: false })
      .eq('supabase_user_id', target_user_id)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // If no row matched by supabase_user_id, fall back to email for backwards compatibility
    if (!data?.length) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(target_user_id)
      if (authUser?.email) {
        await supabase
          .from('management_gebruikers')
          .update({ actief: false })
          .eq('email', authUser.email)
      }
    }
  }

  const { error } = await supabase.auth.admin.deleteUser(target_user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
