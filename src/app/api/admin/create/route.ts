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

export async function POST(req: NextRequest) {
  const supabase = await getAdminClient()
  const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
  if (userError || !currentUser) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const { data: currentRole } = await supabase.rpc('get_my_role')
  if (currentRole !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

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
  })

  if (createError || !user) {
    return NextResponse.json({ error: createError?.message ?? 'Aanmaken mislukt' }, { status: 500 })
  }

  if (newRole === 'trainer') {
    const { data: trainerRow, error: trainerErr } = await supabase
      .from('trainers')
      .insert({ voornaam: voornaam.trim(), achternaam: achternaam.trim(), email, actief: true })
      .select('id')
      .single()

    if (trainerErr || !trainerRow) {
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: trainerErr?.message ?? 'Trainer aanmaken mislukt' }, { status: 500 })
    }

    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: newRole, trainer_id: trainerRow.id })

    if (roleErr) {
      await supabase
        .from('trainers')
        .update({ actief: false })
        .eq('id', trainerRow.id)
        .select('id')
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: roleErr.message }, { status: 500 })
    }
  }

  if (newRole === 'management') {
    const { data: mgmtRow, error: mgmtErr } = await supabase
      .from('management_gebruikers')
      .insert({ voornaam: voornaam.trim(), achternaam: achternaam.trim(), email, actief: true })
      .select('id')
      .single()

    if (mgmtErr || !mgmtRow) {
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: mgmtErr?.message ?? 'Management aanmaken mislukt' }, { status: 500 })
    }

    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: newRole, trainer_id: null })

    if (roleErr) {
      await supabase
        .from('management_gebruikers')
        .update({ actief: false })
        .eq('id', mgmtRow.id)
        .select('id')
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: roleErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, user })
}
