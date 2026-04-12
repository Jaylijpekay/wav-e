import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function DELETE(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (userId !== ADMIN_UUID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { target_user_id } = await req.json()

  if (!target_user_id) {
    return NextResponse.json({ error: 'target_user_id verplicht' }, { status: 400 })
  }

  // Protect the admin account from self-deletion
  if (target_user_id === ADMIN_UUID) {
    return NextResponse.json({ error: 'Admin account kan niet verwijderd worden' }, { status: 403 })
  }

  const supabase = getServiceClient()

  // Delete role row first (FK safety)
  await supabase.from('user_roles').delete().eq('user_id', target_user_id)

  // Delete auth user
  const { error } = await supabase.auth.admin.deleteUser(target_user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
