import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// ROUTE DEFINITIONS
// ============================================================

const PUBLIC_ROUTES = ['/login']

const MANAGEMENT_ONLY_ROUTES = ['/management']

const CONSOLE_ROUTE = '/console'

// ============================================================
// MIDDLEWARE
// ============================================================

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // ----------------------------------------------------------
  // 1. CONSOLE TOKEN PATH
  // Device hits /console?token=abc123 — no session required.
  // Validate the token via DB function, inject trainer context.
  // ----------------------------------------------------------

  if (pathname.startsWith(CONSOLE_ROUTE)) {
    const token = searchParams.get('token')
      ?? request.cookies.get('console_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Validate token using a service-role client (bypasses RLS)
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const { data, error } = await supabaseAdmin
      .rpc('validate_console_token', { p_token: token })

    if (error || !data) {
      // Token invalid or revoked — back to login
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Token valid — stamp last used (fire and forget)
    supabaseAdmin.rpc('touch_console_token', { p_token: token })

    // Pass trainer_id downstream via header
    // Pages/API routes read x-console-trainer-id to scope queries
    const response = NextResponse.next()
    response.headers.set('x-console-trainer-id', data as string)
    response.headers.set('x-auth-mode', 'console')

    // Persist token in cookie so device doesn't need ?token= on
    // every navigation after the first load
    if (!request.cookies.get('console_token')) {
      response.cookies.set('console_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year — revoke via DB, not expiry
      })
    }

    return response
  }

  // ----------------------------------------------------------
  // 2. PUBLIC ROUTES — no auth needed
  // ----------------------------------------------------------

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // ----------------------------------------------------------
  // 3. SESSION-BASED AUTH PATH
  // All other routes require a valid Supabase session.
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
          cookiesToSet.forEach(({ name, value, options }) => {
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

  // Refresh session — required by @supabase/ssr on every request
  const { data: { user } } = await supabase.auth.getUser()

  // No session → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch role for this user
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role, trainer_id')
    .eq('user_id', user.id)
    .single()

  const role = roleRow?.role

  // ----------------------------------------------------------
  // 4. ROLE-BASED ROUTE GUARDS
  // ----------------------------------------------------------

  // Management-only routes — block trainers
  if (MANAGEMENT_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    if (role !== 'management') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Trainer-only routes — block management
  // Management has no business on trainer-specific pages
  const TRAINER_ONLY_ROUTES = ['/gesprek', '/leden']
  if (TRAINER_ONLY_ROUTES.some(route => pathname.startsWith(route))) {
    if (role !== 'trainer') {
      return NextResponse.redirect(new URL('/management', request.url))
    }
  }

  // Pass role + trainer_id downstream via headers
  response.headers.set('x-user-role', role ?? '')
  response.headers.set('x-user-trainer-id', roleRow?.trainer_id ?? '')
  response.headers.set('x-auth-mode', 'session')

  return response
}

// ============================================================
// MATCHER — run middleware on all routes except static assets
// ============================================================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
