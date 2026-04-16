import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  const supabase = getServiceClient()

  // 1. Create auth user
  const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !user) {
    return NextResponse.json({ error: createError?.message ?? 'Aanmaken mislukt' }, { status: 500 })
  }

  // 2a. Trainer → trainers table
  if (role === 'trainer') {
    const { data: trainerRow, error: trainerErr } = await supabase
      .from('trainers')
      .insert({ voornaam: voornaam.trim(), achternaam: achternaam.trim(), email, rol: 'trainer', actief: true })
      .select('id')
      .single()

    if (trainerErr || !trainerRow) {
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: trainerErr?.message ?? 'Trainer aanmaken mislukt' }, { status: 500 })
    }

    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: 'trainer', trainer_id: trainerRow.id })

    if (roleErr) {
      await supabase.from('trainers').delete().eq('id', trainerRow.id)
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: roleErr.message }, { status: 500 })
    }
  }

  // 2b. Management → management_gebruikers table
  if (role === 'management') {
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
      .insert({ user_id: user.id, role: 'management', trainer_id: null })

    if (roleErr) {
      await supabase.from('management_gebruikers').delete().eq('id', mgmtRow.id)
      await supabase.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: roleErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, user_id: user.id })
}
