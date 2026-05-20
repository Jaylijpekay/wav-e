import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext, type ServerAuthContext } from '@/lib/serverAuth'

const CURRENT_MANAGEMENT_ID = '__current__'

async function getCurrentManagementId(auth: ServerAuthContext) {
  if (auth.authMode === 'console') return auth.personId

  const { data: { user } } = await auth.supabase.auth.getUser()
  if (!user) return null

  const { data: bySupabaseUserId } = await auth.supabase
    .from('management_gebruikers')
    .select('id')
    .eq('supabase_user_id', user.id)
    .maybeSingle()
  if (bySupabaseUserId?.id) return bySupabaseUserId.id as string

  const { data: byId } = await auth.supabase
    .from('management_gebruikers')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (byId?.id) return byId.id as string

  if (!user.email) return null

  const { data: byEmail } = await auth.supabase
    .from('management_gebruikers')
    .select('id')
    .ilike('email', user.email)
    .maybeSingle()

  return byEmail?.id as string | null
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'admin' && auth.role !== 'management') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  const supabase = auth.supabase

  const { management_id, pin } = await req.json()

  if (!management_id) {
    return NextResponse.json({ error: 'management_id verplicht' }, { status: 400 })
  }
  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN moet exact 4 cijfers zijn' }, { status: 400 })
  }

  const targetManagementId =
    management_id === CURRENT_MANAGEMENT_ID
      ? await getCurrentManagementId(auth)
      : management_id

  if (!targetManagementId) {
    return NextResponse.json({ error: 'Managementgebruiker niet gevonden' }, { status: 404 })
  }

  const { error } = await supabase.rpc('set_management_pin', {
    p_management_id: targetManagementId,
    p_pin: pin,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
