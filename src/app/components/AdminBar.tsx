'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function AdminBar() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [ledenOpen, setLedenOpen]       = useState(false)
  const [trainersOpen, setTrainersOpen] = useState(false)
  const [leden, setLeden]     = useState<{ id: string; voornaam: string; achternaam: string; lid_id: string }[]>([])
  const [trainers, setTrainers] = useState<{ id: string; voornaam: string; achternaam: string }[]>([])
  const [ledenLoaded, setLedenLoaded] = useState(false)
  const [trainersLoaded, setTrainersLoaded] = useState(false)
  const [ledenLoading, setLedenLoading] = useState(false)
  const [trainersLoading, setTrainersLoading] = useState(false)

  const ledenRef    = useRef<HTMLDivElement>(null)
  const trainersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const check = async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: role } = await supabase.rpc('get_my_role')
      if (role !== 'admin') return

      setVisible(true)
    }
    check()
  }, [])

  const loadLeden = async () => {
    if (ledenLoaded || ledenLoading) return
    setLedenLoading(true)
    try {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('leden')
        .select('id, voornaam, achternaam, lid_id')
        .eq('actief', true)
        .order('achternaam')
      setLeden(data ?? [])
      setLedenLoaded(true)
    } finally {
      setLedenLoading(false)
    }
  }

  const loadTrainers = async () => {
    if (trainersLoaded || trainersLoading) return
    setTrainersLoading(true)
    try {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('trainers')
        .select('id, voornaam, achternaam')
        .eq('actief', true)
        .order('achternaam')
      setTrainers(data ?? [])
      setTrainersLoaded(true)
    } finally {
      setTrainersLoading(false)
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ledenRef.current    && !ledenRef.current.contains(e.target as Node))    setLedenOpen(false)
      if (trainersRef.current && !trainersRef.current.contains(e.target as Node)) setTrainersOpen(false)
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
          color: var(--wave-green);
          padding: 0 6px 0 2px;
          border-right: 1px solid var(--border-muted-dark);
          margin-right: 4px;
          white-space: nowrap;
        }

        .ab-btn {
          font-family: 'Raleway', sans-serif;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--wave-gray);
          background: none;
          border: 1px solid var(--border-black);
          border-radius: 5px;
          padding: 5px 12px;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
          white-space: nowrap;
        }
        .ab-btn:hover {
          color: var(--wave-green);
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
          border: 1px solid var(--border-muted-dark);
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
          color: var(--text-warm);
          letter-spacing: 0.02em;
        }
        .ab-dropdown-id {
          font-size: 0.6rem;
          color: var(--text-quieter);
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .ab-dropdown::-webkit-scrollbar { width: 4px; }
        .ab-dropdown::-webkit-scrollbar-track { background: transparent; }
        .ab-dropdown::-webkit-scrollbar-thumb { background: var(--border-muted-dark); border-radius: 2px; }
      `}</style>

      <div className="ab-bar">
        <span className="ab-label">Admin</span>

        <button className="ab-btn" onClick={() => router.push('/admin')}>
          Admin
        </button>

        <button className="ab-btn" onClick={() => router.push('/management')}>
          Management
        </button>

        {/* Trainers dropup */}
        <div className="ab-dropdown-wrap" ref={trainersRef}>
          <button
            className="ab-btn"
            onClick={() => {
              const nextOpen = !trainersOpen
              setTrainersOpen(nextOpen)
              setLedenOpen(false)
              if (nextOpen) void loadTrainers()
            }}
          >
            Trainers {trainersOpen ? '▲' : '▼'}
          </button>

          {trainersOpen && (
            <div className="ab-dropdown">
              {trainersLoading
                ? <div style={{ padding: '10px', color: 'var(--text-quieter)', fontSize: '0.7rem' }}>Laden…</div>
                : trainers.length === 0
                ? <div style={{ padding: '10px', color: 'var(--text-quieter)', fontSize: '0.7rem' }}>Geen trainers</div>
                : trainers.map(t => (
                  <div
                    key={t.id}
                    className="ab-dropdown-item"
                    onClick={() => { router.push(`/trainer/${t.id}`); setTrainersOpen(false) }}
                  >
                    <span className="ab-dropdown-name">{t.voornaam} {t.achternaam}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Leden dropup */}
        <div className="ab-dropdown-wrap" ref={ledenRef}>
          <button
            className="ab-btn"
            onClick={() => {
              const nextOpen = !ledenOpen
              setLedenOpen(nextOpen)
              setTrainersOpen(false)
              if (nextOpen) void loadLeden()
            }}
          >
            Leden {ledenOpen ? '▲' : '▼'}
          </button>

          {ledenOpen && (
            <div className="ab-dropdown">
              {ledenLoading
                ? <div style={{ padding: '10px', color: 'var(--text-quieter)', fontSize: '0.7rem' }}>Laden…</div>
                : leden.length === 0
                ? <div style={{ padding: '10px', color: 'var(--text-quieter)', fontSize: '0.7rem' }}>Geen leden</div>
                : leden.map(l => (
                  <div
                    key={l.id}
                    className="ab-dropdown-item"
                    onClick={() => { router.push(`/leden/${l.id}`); setLedenOpen(false) }}
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
