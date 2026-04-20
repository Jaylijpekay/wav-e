import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { type, id, pin } = await req.json()

  if (!type || !id || !pin) {
    return NextResponse.json({ error: 'Ontbrekende velden' }, { status: 400 })
  }

  const supabase = getServiceClient()

  let valid = false
  if (type === 'trainer') {
    const { data } = await supabase.rpc('verify_trainer_pin', { p_trainer_id: id, p_pin: pin })
    valid = !!data
  } else if (type === 'management') {
    const { data } = await supabase.rpc('verify_management_pin', { p_management_id: id, p_pin: pin })
    valid = !!data
  } else {
    return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 })
  }

  if (!valid) {
    return NextResponse.json({ error: 'Onjuiste PIN' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
