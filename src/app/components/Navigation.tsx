'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

type NavRole = 'trainer' | 'management' | 'admin' | null

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()
  const [role, setRole] = useState<NavRole>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'
      if (user.id === ADMIN_UUID) { setRole('admin'); return }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      setRole((data?.role as NavRole) ?? null)
    }
    load()
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const trainerLinks = [
    { href: '/leden',       label: 'Leden'   },
    { href: '/gesprek/new', label: 'Gesprek' },
  ]

  const managementLinks = [
    { href: '/management', label: 'Management' },
  ]

  const adminLinks = [
    { href: '/admin', label: 'Admin' },
  ]

  const links =
    role === 'trainer'    ? trainerLinks    :
    role === 'management' ? managementLinks :
    role === 'admin'      ? adminLinks      :
    []

  return (
    <>
      <style>{`
        .nav-root {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 2rem;
          background: rgba(17, 17, 17, 0.92);
          border-bottom: 1px solid var(--border-green);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          font-family: var(--font-primary);
        }

        .nav-inner {
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-logo {
          display: flex;
          align-items: baseline;
          cursor: pointer;
          text-decoration: none;
          border: none;
          background: none;
          padding: 0;
          font-family: var(--font-primary);
        }
        .nav-logo-wav { font-size: 1.05rem; font-weight: 700; color: var(--wave-gray);  letter-spacing: -0.01em; }
        .nav-logo-e   { font-size: 1.05rem; font-weight: 700; color: var(--wave-green); letter-spacing: -0.01em; }

        .nav-right { display: flex; align-items: center; gap: 2px; }

        .nav-link {
          font-family: var(--font-primary);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-muted);
          background: none;
          border: none;
          padding: 6px 12px;
          border-radius: var(--radius-button);
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
        }
        .nav-link:hover  { color: var(--wave-green); background: var(--wave-green-dim); }
        .nav-link.active { color: var(--wave-green); background: var(--wave-green-dim); }

        .nav-logout {
          font-family: var(--font-primary);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-muted);
          background: none;
          border: 1px solid var(--border-subtle);
          padding: 5px 12px;
          border-radius: var(--radius-button);
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
          margin-left: 8px;
        }
        .nav-logout:hover:not(:disabled) { color: #f87171; border-color: rgba(248,113,113,0.4); }
        .nav-logout:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <nav className="nav-root">
        <div className="nav-inner">
          <button className="nav-logo" onClick={() => router.push('/')}>
            <span className="nav-logo-wav">wav-e</span>
            <span className="nav-logo-e"> studios</span>
          </button>

          <div className="nav-right">
            {links.map(link => (
              <button
                key={link.href}
                className={`nav-link${pathname === link.href ? ' active' : ''}`}
                onClick={() => router.push(link.href)}
              >
                {link.label}
              </button>
            ))}

            {role && (
              <button
                className="nav-logout"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? '…' : 'Uitloggen'}
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
