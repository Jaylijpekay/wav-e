import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

type NewUserRole = 'management' | 'trainer'

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
export async function POST(req: NextRequest) {
  const sessionClient = await getSessionClient()
  const { data: { user: currentUser }, error: userError } = await sessionClient.auth.getUser()
  if (userError || !currentUser) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const { data: currentRole } = await sessionClient.rpc('get_my_role')
  if (currentRole !== 'admin' && currentRole !== 'management') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const supabase = await getAdminClient()

  const { email, password, role, voornaam, achternaam } = await req.json()

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Email, wachtwoord en rol zijn verplicht' }, { status: 400 })
  }
  if (!['management', 'trainer'].includes(role)) {
    return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 })
  }
  if (!voornaam?.trim() || !achternaam?.trim()) {
    return NextResponse.json({ error: 'Voornaam en achternaam zijn verplicht' }, { status: 400 })
  }

  const newRole = role as NewUserRole

  const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: newRole,
      voornaam: voornaam.trim(),
      achternaam: achternaam.trim(),
      first_name: voornaam.trim(),
      last_name: achternaam.trim(),
      name: `${voornaam.trim()} ${achternaam.trim()}`,
      full_name: `${voornaam.trim()} ${achternaam.trim()}`,
    },
  })

  if (createError || !user) {
    return NextResponse.json({ error: createError?.message ?? 'Aanmaken mislukt' }, { status: 500 })
  }

  if (newRole === 'trainer') {
    const { data: trainerRow, error: trainerErr } = await supabase
      .from('trainers')
      .insert({ id: user.id, voornaam: voornaam.trim(), achternaam: achternaam.trim(), email, actief: true })
      .select('id')
      .single()

    if (trainerErr || !trainerRow) {
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: trainerErr?.message ?? 'Trainer aanmaken mislukt' }, { status: 500 })
    }

    const { data: roleData, error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: newRole, trainer_id: trainerRow.id })
      .select('id')

    if (roleErr || !roleData?.length) {
      await supabase
        .from('trainers')
        .update({ actief: false })
        .eq('id', trainerRow.id)
        .select('id')
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: 'Aanmaken mislukt: rol kon niet worden opgeslagen' }, { status: 500 })
    }
  }

  if (newRole === 'management') {
    const { data: mgmtRow, error: mgmtErr } = await supabase
      .from('management_gebruikers')
      .insert({ id: user.id, voornaam: voornaam.trim(), achternaam: achternaam.trim(), email, actief: true, supabase_user_id: user.id })
      .select('id')
      .single()

    if (mgmtErr || !mgmtRow) {
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: mgmtErr?.message ?? 'Management aanmaken mislukt' }, { status: 500 })
    }

    const { data: roleData, error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: newRole, trainer_id: null })
      .select('id')

    if (roleErr || !roleData?.length) {
      await supabase
        .from('management_gebruikers')
        .update({ actief: false })
        .eq('id', mgmtRow.id)
        .select('id')
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: 'Aanmaken mislukt: rol kon niet worden opgeslagen' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, user })
}
