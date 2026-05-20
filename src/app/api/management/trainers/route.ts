import { NextRequest, NextResponse } from 'next/server'
import { getServerAuthContext, getServiceRoleClient } from '@/lib/serverAuth'

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

  const db = getServiceRoleClient()

  const { data: existingUsers, error: listError } = await db.auth.admin.listUsers()
  if (listError) {
    return NextResponse.json({ error: `Gebruikerscontrole mislukt: ${listError.message}` }, { status: 500 })
  }
  const existingAuthUser = existingUsers.users.find(
    (user: { email?: string | null }) => user.email?.toLowerCase() === email.toLowerCase()
  )
  if (existingAuthUser) {
    return NextResponse.json({ error: 'Er bestaat al een login met dit e-mailadres' }, { status: 409 })
  }

  const { data: trainerRow, error: trainerError } = await db
    .from('trainers')
    .insert({ voornaam, achternaam, email, actief: false })
    .select('id')
    .single()

  if (trainerError || !trainerRow) {
    return NextResponse.json({ error: trainerError?.message ?? 'Trainer aanmaken mislukt' }, { status: 500 })
  }

  const { data: { user }, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'trainer',
      trainer_id: trainerRow.id,
      voornaam,
      achternaam,
      first_name: voornaam,
      last_name: achternaam,
      name: `${voornaam} ${achternaam}`,
      full_name: `${voornaam} ${achternaam}`,
    },
  })

  if (createError || !user) {
    await db
      .from('trainers')
      .update({ actief: false })
      .eq('id', trainerRow.id)

    const message = createError?.message ?? 'Aanmaken mislukt'
    const status = message.toLowerCase().includes('already') ? 409 : 500
    return NextResponse.json({ error: `Login aanmaken mislukt: ${message}` }, { status })
  }

  const { data: existingRole, error: roleReadError } = await db
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (roleReadError) {
    await db.auth.admin.deleteUser(user.id)
    await db
      .from('trainers')
      .update({ actief: false })
      .eq('id', trainerRow.id)
    return NextResponse.json({ error: roleReadError.message }, { status: 500 })
  }

  const roleWrite = existingRole
    ? db
      .from('user_roles')
      .update({ role: 'trainer', trainer_id: trainerRow.id })
      .eq('id', existingRole.id)
    : db
      .from('user_roles')
      .insert({ user_id: user.id, role: 'trainer', trainer_id: trainerRow.id })

  const { error: roleError } = await roleWrite

  if (roleError) {
    await db
      .from('trainers')
      .update({ actief: false })
      .eq('id', trainerRow.id)
    await db.auth.admin.deleteUser(user.id)
    return NextResponse.json({ error: 'Aanmaken mislukt: rol kon niet worden opgeslagen' }, { status: 500 })
  }

  const { error: activateError } = await db
    .from('trainers')
    .update({ actief: true })
    .eq('id', trainerRow.id)

  if (activateError) {
    await db.auth.admin.deleteUser(user.id)
    await db
      .from('trainers')
      .update({ actief: false })
      .eq('id', trainerRow.id)
    return NextResponse.json({ error: activateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    trainer: { id: trainerRow.id, email, voornaam, achternaam },
  })
}
