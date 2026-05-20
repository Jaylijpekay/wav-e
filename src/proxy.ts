import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyConsoleSession } from '@/lib/consoleSession'

// ============================================================
// ROUTE DEFINITIONS
// ============================================================

// /console is intentionally public — the page itself validates the token
// via /api/console/validate and shows an 'invalid' state if it fails.
const PUBLIC_PREFIXES = ['/login', '/api/console', '/api/auth-context', '/console']

const MANAGEMENT_ONLY_ROUTES = ['/management']

const ADMIN_API_ROUTES = ['/api/admin']

const ADMIN_ONLY_ROUTES = ['/admin']

const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

// ============================================================
// CONSOLE SESSION CHECK (cryptographic only — no DB call)
// ============================================================

// The proxy only verifies the console_session HMAC signature and expiry.
// The console_token DB validity check happens inside the API routes
// (verify-pin/route.ts, serverAuth.ts) where a failed DB call does not
// cause a redirect to /login — it just returns 401 to the client fetch.
// Moving that DB check into the proxy caused every protected page request
// to make a supabase RPC call; if that call failed or the token was
// stale the request fell through to Supabase session auth, which also
// failed for console-only sessions, producing the /login redirect.
const allowConsoleSessionRoute = async (request: NextRequest): Promise<NextResponse | null> => {
  const { pathname } = request.nextUrl

  const session = await verifyConsoleSession(request.cookies.get('console_session')?.value)
  if (!session) return null

  if (session.type === 'trainer') {
    const trainerPath = `/trainer/${session.id}`
    const allowed =
      pathname === trainerPath ||
      pathname.startsWith(`${trainerPath}/`) ||
      pathname.startsWith('/gesprek') ||
      pathname.startsWith('/leden/')
    if (!allowed) {
      return NextResponse.redirect(new URL(trainerPath, request.url))
    }
  }

  if (session.type === 'management') {
    const allowed = pathname.startsWith('/management')
    if (!allowed) {
      return NextResponse.redirect(new URL('/management', request.url))
    }
  }

  return NextResponse.next()
}

// ============================================================
// PROXY
// ============================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ----------------------------------------------------------
  // 1. PUBLIC ROUTES (including /console)
  // ----------------------------------------------------------

  if (PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))) {
    return NextResponse.next()
  }

  // ----------------------------------------------------------
  // 2. CONSOLE SESSION (fast — HMAC only, no network)
  // ----------------------------------------------------------

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
