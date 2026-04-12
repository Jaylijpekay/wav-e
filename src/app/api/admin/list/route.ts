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

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getServiceClient()

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
      role: u.id === ADMIN_UUID ? 'admin' : (roleRow?.role ?? null),
      trainer_id: roleRow?.trainer_id ?? null,
      trainer_naam: trainer ? `${trainer.voornaam} ${trainer.achternaam}` : null,
    }
  })

  return NextResponse.json({ users: result })
}
