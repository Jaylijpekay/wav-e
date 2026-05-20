import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { verifyConsoleSession } from '@/lib/consoleSession'

export type AppRole = 'trainer' | 'management' | 'admin'

export type ServerAuthContext = {
  supabase: ReturnType<typeof createServerClient>
  authMode: 'session' | 'console'
  userId: string | null
  role: AppRole
  trainerId: string | null
  personId: string
}

export async function getServiceSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
}

async function validateConsoleToken(supabase: Awaited<ReturnType<typeof getServiceSupabase>>, token: string | undefined) {
  if (!token) return false
  const { data, error } = await supabase.rpc('validate_console_token', { p_token: token })
  return !error && !!data
}

export async function getServerAuthContext(req?: NextRequest): Promise<ServerAuthContext | null> {
  const supabase = await getServiceSupabase()

  const consoleToken = req?.cookies.get('console_token')?.value
  const consoleSession = await verifyConsoleSession(req?.cookies.get('console_session')?.value)

  if (consoleSession && await validateConsoleToken(supabase, consoleToken)) {
    return {
      supabase,
      authMode: 'console',
      userId: null,
      role: consoleSession.type,
      trainerId: consoleSession.type === 'trainer' ? consoleSession.id : null,
      personId: consoleSession.id,
    }
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  const [
    { data: role },
    { data: trainerId },
  ] = await Promise.all([
    supabase.rpc('get_my_role'),
    supabase.rpc('get_my_trainer_id'),
  ])

  if (role !== 'trainer' && role !== 'management' && role !== 'admin') return null

  return {
    supabase,
    authMode: 'session',
    userId: user.id,
    role,
    trainerId: typeof trainerId === 'string' ? trainerId : null,
    personId: user.id,
  }
}

export function canAccessTrainer(auth: ServerAuthContext, trainerId: string) {
  if (auth.role === 'admin' || auth.role === 'management') return true
  return auth.role === 'trainer' && auth.trainerId === trainerId
}

export async function canAccessLid(auth: ServerAuthContext, lidId: string) {
  if (auth.role === 'admin' || auth.role === 'management') return true
  if (auth.role !== 'trainer' || !auth.trainerId) return false

  const { data, error } = await auth.supabase
    .from('leden')
    .select('id')
    .eq('id', lidId)
    .eq('trainer_id', auth.trainerId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return !!data
}
