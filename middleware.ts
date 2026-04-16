import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// ROUTE DEFINITIONS
// ============================================================

const PUBLIC_ROUTES = ['/login']

const MANAGEMENT_ONLY_ROUTES = ['/management']

const ADMIN_ONLY_ROUTES = ['/admin', '/api/admin']

const CONSOLE_ROUTE = '/console'

const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

// ============================================================
// MIDDLEWARE
// ============================================================

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // ----------------------------------------------------------
  // 1. CONSOLE TOKEN PATH
  // ----------------------------------------------------------

  if (pathname.startsWith(CONSOLE_ROUTE)) {
    const token = searchParams.get('token')
      ?? request.cookies.get('console_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const { data, error } = await supabaseAdmin
      .rpc('validate_console_token', { p_token: token })

    if (error || !data) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    supabaseAdmin.rpc('touch_console_token', { p_token: token })

    const response = NextResponse.next()
    response.headers.set('x-console-trainer-id', data as string)
    response.headers.set('x-auth-mode', 'console')

    if (!request.cookies.get('console_token')) {
      response.cookies.set('console_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
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

  // ----------------------------------------------------------
  // 4. ADMIN GATE — superuser UUID only
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

  // Root redirect — send each role to their home
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

  // /gesprek is trainer-only.
  // /leden (exact) is trainer-only — the member list belongs to the trainer view.
  // /leden/[id] and deeper routes are accessible to management too (read-only detail).
  const isTrainerOnly =
    pathname.startsWith('/gesprek') ||
    pathname === '/leden'

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
