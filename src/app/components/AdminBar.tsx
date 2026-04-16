'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

const ADMIN_UUID = 'a596f282-c927-4a11-aaec-bb18721cac50'

export default function AdminBar() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [leden, setLeden] = useState<{ id: string; voornaam: string; achternaam: string; lid_id: string }[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id === ADMIN_UUID) {
        setVisible(true)
        const { data } = await supabase
          .from('leden')
          .select('id, voornaam, achternaam, lid_id')
          .eq('actief', true)
          .order('achternaam')
        setLeden(data ?? [])
      }
    }
    check()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!visible) return null

  return (
    <>
      <style>{`
        .ab-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(20,20,20,0.96);
          border: 1px solid rgba(168,200,0,0.25);
          border-radius: 8px;
          padding: 8px 10px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,200,0,0.08);
          font-family: 'Raleway', sans-serif;
        }

        .ab-label {
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #A8C800;
          padding: 0 6px 0 2px;
          border-right: 1px solid #2a2a2a;
          margin-right: 4px;
          white-space: nowrap;
        }

        .ab-btn {
          font-family: 'Raleway', sans-serif;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #888;
          background: none;
          border: 1px solid #222;
          border-radius: 5px;
          padding: 5px 12px;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
          white-space: nowrap;
        }
        .ab-btn:hover {
          color: #A8C800;
          border-color: rgba(168,200,0,0.3);
          background: rgba(168,200,0,0.05);
        }

        .ab-dropdown-wrap {
          position: relative;
        }

        .ab-dropdown {
          position: absolute;
          bottom: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(20,20,20,0.98);
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          min-width: 220px;
          max-height: 280px;
          overflow-y: auto;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          padding: 4px;
        }

        .ab-dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.12s;
          gap: 12px;
        }
        .ab-dropdown-item:hover { background: rgba(168,200,0,0.07); }

        .ab-dropdown-name {
          font-size: 0.72rem;
          font-weight: 600;
          color: #c8c6c0;
          letter-spacing: 0.02em;
        }
        .ab-dropdown-id {
          font-size: 0.6rem;
          color: #444;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .ab-dropdown::-webkit-scrollbar { width: 4px; }
        .ab-dropdown::-webkit-scrollbar-track { background: transparent; }
        .ab-dropdown::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
      `}</style>

      <div className="ab-bar">
        <span className="ab-label">Admin</span>

        <button className="ab-btn" onClick={() => router.push('/admin')}>
          Admin
        </button>

        <button className="ab-btn" onClick={() => router.push('/management')}>
          Management
        </button>

        <div className="ab-dropdown-wrap" ref={dropdownRef}>
          <button
            className="ab-btn"
            onClick={() => setDropdownOpen(o => !o)}
          >
            Leden {dropdownOpen ? '▲' : '▼'}
          </button>

          {dropdownOpen && (
            <div className="ab-dropdown">
              {leden.length === 0
                ? <div style={{ padding: '10px', color: '#444', fontSize: '0.7rem' }}>Geen leden</div>
                : leden.map(l => (
                  <div
                    key={l.id}
                    className="ab-dropdown-item"
                    onClick={() => { router.push(`/leden/${l.id}`); setDropdownOpen(false) }}
                  >
                    <span className="ab-dropdown-name">{l.voornaam} {l.achternaam}</span>
                    <span className="ab-dropdown-id">{l.lid_id}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </>
  )
}
