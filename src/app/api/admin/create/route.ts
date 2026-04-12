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

  const { email, password, role, trainer_id } = await req.json()

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'email, password en role zijn verplicht' }, { status: 400 })
  }

  if (!['management', 'trainer'].includes(role)) {
    return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 })
  }

  if (role === 'trainer' && !trainer_id) {
    return NextResponse.json({ error: 'trainer_id verplicht voor trainer rol' }, { status: 400 })
  }

  const supabase = getServiceClient()

  const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !user) {
    return NextResponse.json({ error: createError?.message ?? 'Aanmaken mislukt' }, { status: 500 })
  }

  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: user.id,
      role,
      trainer_id: role === 'trainer' ? trainer_id : null,
    })

  if (roleError) {
    await supabase.auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, user_id: user.id })
}
