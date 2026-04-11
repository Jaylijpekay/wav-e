'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function Navigation() {
  const router = useRouter()
  const pathname = usePathname()

  const links = [
    { href: '/',           label: 'Home'     },
    { href: '/leden',      label: 'Leden'    },
    { href: '/gesprek/new', label: 'Gesprek' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap');

        .nav-root {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 2rem;
          background: rgba(17,17,17,0.92);
          border-bottom: 1px solid rgba(168,200,0,0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          font-family: 'Raleway', sans-serif;
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
          gap: 0;
          cursor: pointer;
          text-decoration: none;
          border: none;
          background: none;
          padding: 0;
          font-family: 'Raleway', sans-serif;
        }
        .nav-logo-wav { font-size: 1.05rem; font-weight: 700; color: #5A5A5A; letter-spacing: -0.01em; }
        .nav-logo-e   { font-size: 1.05rem; font-weight: 700; color: #A8C800; letter-spacing: -0.01em; }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .nav-link {
          font-family: 'Raleway', sans-serif;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #3a3a3a;
          background: none;
          border: none;
          padding: 6px 12px;
          border-radius: 3px;
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
          text-decoration: none;
        }

        .nav-link:hover {
          color: #A8C800;
          background: rgba(168,200,0,0.06);
        }

        .nav-link.active {
          color: #A8C800;
          background: rgba(168,200,0,0.08);
        }
      `}</style>

      <nav className="nav-root">
        <div className="nav-inner">
          <button className="nav-logo" onClick={() => router.push('/')}>
            <span className="nav-logo-wav">wav-e</span>
            <span className="nav-logo-e"> studios</span>
          </button>

          <div className="nav-links">
            {links.map(link => (
              <button
                key={link.href}
                className={`nav-link${pathname === link.href ? ' active' : ''}`}
                onClick={() => router.push(link.href)}
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}
