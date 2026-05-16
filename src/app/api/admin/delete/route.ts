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

export async function DELETE(req: NextRequest) {
  const supabase = await getAdminClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

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
    const { data: { user: authUser }, error: authUserError } = await supabase.auth.admin.getUserById(target_user_id)

    if (authUserError) {
      return NextResponse.json({ error: authUserError.message }, { status: 500 })
    }

    if (!authUser?.email) {
      return NextResponse.json({ error: 'Management gebruiker niet gevonden' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('management_gebruikers')
      .update({ actief: false })
      .eq('email', authUser.email)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Management gebruiker niet gevonden' }, { status: 404 })
  }

  const { error } = await supabase.auth.admin.deleteUser(target_user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
