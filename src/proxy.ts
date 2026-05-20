import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyConsoleSession } from '@/lib/consoleSession'

// ============================================================
// ROUTE DEFINITIONS
// ============================================================

const PUBLIC_ROUTES = ['/login', '/api/console', '/api/auth-context']

const MANAGEMENT_ONLY_ROUTES = ['/management']

const ADMIN_API_ROUTES = ['/api/admin']

const ADMIN_ONLY_ROUTES = ['/admin']

const CONSOLE_ROUTE = '/console'

const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

const validateConsoleToken = async (request: NextRequest) => {
  const token = request.nextUrl.searchParams.get('token')
    ?? request.cookies.get('console_token')?.value

  if (!token) return null

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data, error } = await supabaseAdmin
    .rpc('validate_console_token', { p_token: token })

  if (error || !data) return null
  return token
}

const allowConsoleSessionRoute = async (request: NextRequest) => {
  const { pathname } = request.nextUrl
  const token = await validateConsoleToken(request)
  if (!token) return null

  const session = await verifyConsoleSession(request.cookies.get('console_session')?.value)
  if (!session) return null

  const trainerPath = `/trainer/${session.id}`
  const trainerApiPath = `/api/trainer/${session.id}`
  const isAllowedTrainerRoute =
    session.type === 'trainer' &&
    (
      pathname === trainerPath ||
      pathname.startsWith(`${trainerPath}/`) ||
      pathname === trainerApiPath ||
      pathname.startsWith(`${trainerApiPath}/`) ||
      pathname.startsWith('/api/trainer-notities/') ||
      pathname.startsWith('/api/notities/') ||
      pathname.startsWith('/api/gesprek') ||
      pathname.startsWith('/gesprek')
    )

  const isAllowedManagementRoute =
    session.type === 'management' &&
    (
      pathname.startsWith('/management') ||
      pathname.startsWith('/api/trainer-notities') ||
      pathname.startsWith('/api/notities/')
    )

  if (!isAllowedTrainerRoute && !isAllowedManagementRoute) return null

  const response = NextResponse.next()
  response.headers.set('x-auth-mode', 'console-pin')
  response.headers.set('x-console-person-type', session.type)
  response.headers.set('x-console-person-id', session.id)

  if (!request.cookies.get('console_token')) {
    response.cookies.set('console_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }

  return response
}

// ============================================================
// PROXY
// ============================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ----------------------------------------------------------
  // 1. CONSOLE TOKEN PATH
  // ----------------------------------------------------------

  if (pathname.startsWith(CONSOLE_ROUTE)) {
    const token = await validateConsoleToken(request)

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const response = NextResponse.next()
    response.headers.set('x-auth-mode', 'console')

    if (!request.cookies.get('console_token')) {
      response.cookies.set('console_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      })
    }

    return response
  }

  // ----------------------------------------------------------
  // 2. PUBLIC ROUTES
  // ----------------------------------------------------------

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const consoleResponse = await allowConsoleSessionRoute(request)
  if (consoleResponse) return consoleResponse

  // ----------------------------------------------------------
  // 3. SESSION-BASED AUTH
  // ----------------------------------------------------------

  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (ADMIN_API_ROUTES.some(route => pathname.startsWith(route))) {
    response.headers.set('x-user-id', user.id)
    response.headers.set('x-auth-mode', 'session')
    return response
  }

  // ----------------------------------------------------------
  // 4. ADMIN GATE - superuser UUID only
  // ----------------------------------------------------------

  if (ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    if (user.id !== ADMIN_UUID) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    response.headers.set('x-user-id', user.id)
    response.headers.set('x-auth-mode', 'session')
    return response
  }

  // ----------------------------------------------------------
  // 5. ROLE-BASED ROUTE GUARDS
  // ----------------------------------------------------------

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role, trainer_id')
    .eq('user_id', user.id)
    .single()

  const role = roleRow?.role

  // Root redirect - send each role to their home
  if (pathname === '/') {
    if (user.id === ADMIN_UUID) return NextResponse.redirect(new URL('/admin', request.url))
    if (role === 'management') return NextResponse.redirect(new URL('/management', request.url))
    if (role === 'trainer') return NextResponse.redirect(new URL('/leden', request.url))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (MANAGEMENT_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    if (role !== 'management' && user.id !== ADMIN_UUID) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // /leden (exact list) is trainer-only - management has their own overview.
  // /leden/[id] and deeper + /gesprek are accessible to both trainer and management
  // (Karim is management but also acts as trainer).
  const isTrainerOnly = pathname === '/leden'

  if (isTrainerOnly && role !== 'trainer' && user.id !== ADMIN_UUID) {
    return NextResponse.redirect(new URL('/management', request.url))
  }

  response.headers.set('x-user-id', user.id)
  response.headers.set('x-user-role', role ?? '')
  response.headers.set('x-user-trainer-id', roleRow?.trainer_id ?? '')
  response.headers.set('x-auth-mode', 'session')

  return response
}

// ============================================================
// MATCHER
// ============================================================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
