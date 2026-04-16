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

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { target_user_id } = await req.json()

  if (!target_user_id) {
    return NextResponse.json({ error: 'target_user_id verplicht' }, { status: 400 })
  }
  if (target_user_id === ADMIN_UUID) {
    return NextResponse.json({ error: 'Admin account kan niet verwijderd worden' }, { status: 403 })
  }

  const supabase = getServiceClient()

  // 1. Fetch user_roles to determine role and trainer_id before deleting
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role, trainer_id')
    .eq('user_id', target_user_id)
    .single()

  // 2. Delete profile row from the correct table
  if (roleRow?.role === 'trainer' && roleRow.trainer_id) {
    await supabase.from('trainers').delete().eq('id', roleRow.trainer_id)
  }

  if (roleRow?.role === 'management') {
    // management_gebruikers is keyed by email — fetch email from auth first
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(target_user_id)
    if (authUser?.email) {
      await supabase.from('management_gebruikers').delete().eq('email', authUser.email)
    }
  }

  // 3. Delete user_roles row
  await supabase.from('user_roles').delete().eq('user_id', target_user_id)

  // 4. Delete auth user
  const { error } = await supabase.auth.admin.deleteUser(target_user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
