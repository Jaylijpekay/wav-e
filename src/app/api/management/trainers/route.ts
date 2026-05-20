import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext } from '@/lib/serverAuth'

type CreateTrainerBody = {
  email?: unknown
  password?: unknown
  voornaam?: unknown
  achternaam?: unknown
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (auth.role !== 'management' && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  let body: CreateTrainerBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password.trim() : ''
  const voornaam = typeof body.voornaam === 'string' ? body.voornaam.trim() : ''
  const achternaam = typeof body.achternaam === 'string' ? body.achternaam.trim() : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email en wachtwoord zijn verplicht' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' }, { status: 400 })
  }
  if (!voornaam || !achternaam) {
    return NextResponse.json({ error: 'Voornaam en achternaam zijn verplicht' }, { status: 400 })
  }

  const { data: { user }, error: createError } = await auth.supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !user) {
    return NextResponse.json({ error: createError?.message ?? 'Aanmaken mislukt' }, { status: 500 })
  }

  const { data: trainerRow, error: trainerError } = await auth.supabase
    .from('trainers')
    .insert({ voornaam, achternaam, email, actief: true })
    .select('id')
    .single()

  if (trainerError || !trainerRow) {
    await auth.supabase.auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: trainerError?.message ?? 'Trainer aanmaken mislukt' }, { status: 500 })
  }

  const { error: roleError } = await auth.supabase
    .from('user_roles')
    .insert({ user_id: user.id, role: 'trainer', trainer_id: trainerRow.id })

  if (roleError) {
    await auth.supabase
      .from('trainers')
      .update({ actief: false })
      .eq('id', trainerRow.id)
    await auth.supabase.auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: 'Aanmaken mislukt: rol kon niet worden opgeslagen' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    trainer: { id: trainerRow.id, email, voornaam, achternaam },
  })
}
