import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function getAdminContext() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { supabase, user: null, error: NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 }) }
  }

  const { data: role } = await supabase.rpc('get_my_role')
  if (role !== 'admin') {
    return { supabase, user: null, error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }

  return { supabase, user, error: null }
}

// AUTH: This route requires a valid Supabase session with role 'admin'.
// Console sessions are not accepted. Do not migrate to service-role-only
// until admin UI is moved off the browser Supabase client.
export async function GET() {
  const { supabase, user: currentUser, error: authError } = await getAdminContext()
  if (authError) return authError
  if (!currentUser) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: { users }, error } = await supabase.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id, role, trainer_id')

  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, voornaam, achternaam')

  const roleMap = Object.fromEntries((roles ?? []).map(r => [r.user_id, r]))
  const trainerMap = Object.fromEntries((trainers ?? []).map(t => [t.id, t]))

  const result = users.map(u => {
    const roleRow = roleMap[u.id]
    const trainer = roleRow?.trainer_id ? trainerMap[roleRow.trainer_id] : null
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      role: u.id === currentUser.id ? 'admin' : (roleRow?.role ?? null),
      trainer_id: roleRow?.trainer_id ?? null,
      trainer_naam: trainer ? `${trainer.voornaam} ${trainer.achternaam}` : null,
    }
  })

  return NextResponse.json({ users: result })
}
