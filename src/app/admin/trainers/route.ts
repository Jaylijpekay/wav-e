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

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (userId !== ADMIN_UUID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getServiceClient()
  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, voornaam, achternaam')
    .order('achternaam')

  return NextResponse.json({ trainers: trainers ?? [] })
}
