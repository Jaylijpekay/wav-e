import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

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

// GET — list all tokens
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('console_tokens')
    .select('id, token, naam, actief, aangemaakt_op, laatst_gebruikt')
    .order('aangemaakt_op', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tokens: data })
}

// POST — create token
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { naam } = await req.json()
  if (!naam?.trim()) return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })

  const token = randomBytes(32).toString('hex')
  const supabase = getServiceClient()

  const { error } = await supabase.from('console_tokens').insert({
    naam: naam.trim(),
    token,
    trainer_id: null,
    actief: true,
    aangemaakt_door: userId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PATCH — reactivate token
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, actief } = await req.json()
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

  const supabase = getServiceClient()
  const { error } = await supabase.from('console_tokens').update({ actief }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — revoke token
export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId()
  if (userId !== ADMIN_UUID) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

  const supabase = getServiceClient()
  const { error } = await supabase.from('console_tokens').update({ actief: false }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
