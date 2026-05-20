import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

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

// AUTH: All handlers in this file require a valid Supabase session with role 'admin'.
// Console sessions are not accepted. Do not migrate to service-role-only
// until admin UI is moved off the browser Supabase client.

// GET - list all tokens
export async function GET() {
  const { supabase, error: authError } = await getAdminContext()
  if (authError) return authError

  const { data, error } = await supabase
    .from('console_tokens')
    .select('id, token, naam, actief, aangemaakt_op, laatst_gebruikt')
    .order('aangemaakt_op', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tokens: data })
}

// POST - create token
export async function POST(req: NextRequest) {
  const { supabase, user, error: authError } = await getAdminContext()
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { naam } = await req.json()
  if (!naam?.trim()) return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })

  const token = randomBytes(32).toString('hex')

  const { data, error } = await supabase
    .from('console_tokens')
    .insert({
      naam: naam.trim(),
      token,
      trainer_id: null,
      actief: true,
      aangemaakt_door: user.id,
    })
    .select('id, token, naam, actief, aangemaakt_op, laatst_gebruikt')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Token aanmaken mislukt' }, { status: 500 })
  return NextResponse.json({ success: true, token: data[0] })
}

// PATCH - reactivate token
export async function PATCH(req: NextRequest) {
  const { supabase, error: authError } = await getAdminContext()
  if (authError) return authError

  const { id, actief } = await req.json()
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

  const { data, error } = await supabase
    .from('console_tokens')
    .update({ actief })
    .eq('id', id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Token niet gevonden' }, { status: 404 })
  return NextResponse.json({ success: true })
}

// DELETE - revoke token
export async function DELETE(req: NextRequest) {
  const { supabase, error: authError } = await getAdminContext()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

  const { data, error } = await supabase
    .from('console_tokens')
    .update({ actief: false })
    .eq('id', id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Token niet gevonden' }, { status: 404 })
  return NextResponse.json({ success: true })
}
