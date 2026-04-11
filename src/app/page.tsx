'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Trainer = {
  id: string
  naam: string
}

export default function Home() {
  const router = useRouter()
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const { data } = await supabase
        .from('trainers')
        .select('id, naam')
        .order('naam')
      setTrainers(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleTrainerSelect = (id: string) => {
    setSelectedTrainer(id)
    if (id) router.push(`/trainer/${id}`)
  }

  return (
    <main style={s.main}>
      <div style={s.center}>

        <div style={s.wordmark}>WAV-E</div>
        <div style={s.sub}>EMS coaching intelligence</div>

        <div style={s.grid}>

          {/* Personal Trainer */}
          <div style={s.card}>
            <div style={s.cardLabel}>Personal trainer</div>
            <div style={s.cardDesc}>Open jouw dashboard</div>
            <select
              style={s.select}
              value={selectedTrainer}
              onChange={e => handleTrainerSelect(e.target.value)}
              disabled={loading}
            >
              <option value=''>
                {loading ? 'Laden...' : 'Selecteer trainer →'}
              </option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.naam}
                </option>
              ))}
            </select>
          </div>

          {/* Management */}
          <div
            style={{ ...s.card, cursor: 'pointer' }}
            onClick={() => router.push('/management')}
          >
            <div style={s.cardLabel}>Management</div>
            <div style={s.cardDesc}>Studio-breed overzicht</div>
            <div style={s.cardArrow}>→</div>
          </div>

          {/* Nieuw lid */}
          <div
            style={{ ...s.card, cursor: 'pointer' }}
            onClick={() => router.push('/nieuw-lid')}
          >
            <div style={s.cardLabel}>Nieuw lid</div>
            <div style={s.cardDesc}>Lid toevoegen</div>
            <div style={s.cardArrow}>→</div>
          </div>

          {/* Admin */}
          <div
            style={{ ...s.card, cursor: 'pointer' }}
            onClick={() => router.push('/admin')}
          >
            <div style={s.cardLabel}>Admin</div>
            <div style={s.cardDesc}>Instellingen & beheer</div>
            <div style={s.cardArrow}>→</div>
          </div>

        </div>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"DM Mono", "Courier New", monospace',
    padding: '40px 24px',
  },
  center: {
    width: '100%',
    maxWidth: 560,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 48,
  },
  wordmark: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.3em',
    color: '#fff',
    textAlign: 'center',
  },
  sub: {
    fontSize: 11,
    color: '#333',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginTop: -36,
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 2,
    width: '100%',
  },
  card: {
    background: '#0f0f0f',
    border: '1px solid #1a1a1a',
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    transition: 'background 0.15s, border-color 0.15s',
  },
  cardLabel: {
    fontSize: 13,
    color: '#e8e6e0',
    letterSpacing: '0.05em',
  },
  cardDesc: {
    fontSize: 11,
    color: '#444',
    letterSpacing: '0.05em',
  },
  cardArrow: {
    fontSize: 16,
    color: '#333',
    marginTop: 12,
  },
  select: {
    marginTop: 12,
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    color: '#e8e6e0',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    padding: '10px 12px',
    borderRadius: 4,
    width: '100%',
    cursor: 'pointer',
    appearance: 'none',
    outline: 'none',
  },
}
