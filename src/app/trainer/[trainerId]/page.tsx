'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  trainer_naam: string
  laatste_contact: string | null
  laatste_evaluatie: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
  open_acties: number
}

type Signal = {
  label: string
  reden: string
}

const daysSince = (date: string | null): number | null => {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

const getSignals = (lid: Lid): Signal[] => {
  const signals: Signal[] = []
  const dagsSindsContact = daysSince(lid.laatste_contact)
  const dagsSindsEval = daysSince(lid.laatste_evaluatie)

  if (dagsSindsContact === null || dagsSindsContact > 14)
    signals.push({ label: 'Geen contact', reden: dagsSindsContact === null ? 'Nog nooit' : `${dagsSindsContact} dagen geleden` })
  if (dagsSindsEval === null || dagsSindsEval > 42)
    signals.push({ label: 'Geen evaluatie', reden: dagsSindsEval === null ? 'Nog nooit' : `${dagsSindsEval} dagen geleden` })
  if (lid.open_acties > 0)
    signals.push({ label: 'Open acties', reden: `${lid.open_acties} actie${lid.open_acties > 1 ? 's' : ''}` })
  if (lid.slaap !== null && lid.slaap < 6)
    signals.push({ label: 'Slaap rood', reden: `Score ${lid.slaap}/10` })
  if (lid.energie !== null && lid.energie < 6)
    signals.push({ label: 'Energie rood', reden: `Score ${lid.energie}/10` })
  if (lid.stress !== null && lid.stress > 7)
    signals.push({ label: 'Stress rood', reden: `Score ${lid.stress}/10` })

  return signals
}

const getStoplight = (lid: Lid): 'red' | 'amber' | 'green' => {
  const signals = getSignals(lid)
  if (signals.length === 0) return 'green'
  // Red if: no evaluation ever, or lifestyle red signals
  const dagsSindsEval = daysSince(lid.laatste_evaluatie)
  const hasRedLifestyle =
    (lid.slaap !== null && lid.slaap < 6) ||
    (lid.energie !== null && lid.energie < 6) ||
    (lid.stress !== null && lid.stress > 7)
  if (dagsSindsEval === null || dagsSindsEval > 42 || hasRedLifestyle) return 'red'
  return 'amber'
}

const STOPLIGHT_COLORS = {
  red:   { dot: '#dc2626', bg: '#1a0808', border: '#3a1010', text: '#f87171' },
  amber: { dot: '#d97706', bg: '#1a1208', border: '#3a2a08', text: '#fbbf24' },
  green: { dot: '#16a34a', bg: '#081a0e', border: '#0e3018', text: '#4ade80' },
}

export default function Dashboard() {
  const router = useRouter()
  const [leden, setLeden] = useState<Lid[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'red' | 'amber' | 'green'>('all')

  useEffect(() => {
    const supabase = getSupabase()
    const load = async () => {
      const { data: ledenData } = await supabase
        .from('leden')
        .select('id, lid_id, voornaam, achternaam, trainer_id, actief')
        .eq('actief', true)

      if (!ledenData) { setLoading(false); return }

      const { data: trainers } = await supabase.from('trainers').select('id, naam')
      const { data: contacten } = await supabase
        .from('contact_momenten')
        .select('lid_id, datum')
        .order('datum', { ascending: false })
      const { data: evaluaties } = await supabase
        .from('evaluaties')
        .select('lid_id, datum, slaap, energie, stress, cyclus')
        .order('cyclus', { ascending: false })
      const { data: acties } = await supabase
        .from('acties')
        .select('lid_id, afgerond')
        .eq('afgerond', false)

      const enriched: Lid[] = ledenData.map(l => {
        const trainer = trainers?.find(t => t.id === l.trainer_id)
        const lastContact = contacten?.find(c => c.lid_id === l.id)
        const lastEval = evaluaties?.find(e => e.lid_id === l.id)
        const openActies = acties?.filter(a => a.lid_id === l.id).length ?? 0

        return {
          id: l.id,
          lid_id: l.lid_id,
          voornaam: l.voornaam,
          achternaam: l.achternaam,
          trainer_naam: trainer?.naam ?? '—',
          laatste_contact: lastContact?.datum ?? null,
          laatste_evaluatie: lastEval?.datum ?? null,
          slaap: lastEval?.slaap ?? null,
          energie: lastEval?.energie ?? null,
          stress: lastEval?.stress ?? null,
          open_acties: openActies,
        }
      })

      // Sort: red first, then amber, then green
      const order = { red: 0, amber: 1, green: 2 }
      enriched.sort((a, b) => order[getStoplight(a)] - order[getStoplight(b)])

      setLeden(enriched)
      setLoading(false)
    }

    load()
  }, [])

  const filtered = filter === 'all' ? leden : leden.filter(l => getStoplight(l) === filter)

  const counts = {
    red: leden.filter(l => getStoplight(l) === 'red').length,
    amber: leden.filter(l => getStoplight(l) === 'amber').length,
    green: leden.filter(l => getStoplight(l) === 'green').length,
  }

  return (
    <main style={s.main}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.wordmark}>WAV-E</span>
          <nav style={s.nav}>
            <span style={s.navActive}>Dashboard</span>
            <span style={s.navLink} onClick={() => router.push('/leden')}>Leden</span>
            <span style={s.navLink} onClick={() => router.push('/gesprek/new')}>+ Gesprek</span>
          </nav>
        </div>
      </header>

      <div style={s.body}>

        {/* Summary bar */}
        <div style={s.summaryBar}>
          {(['red', 'amber', 'green'] as const).map(sig => {
            const col = STOPLIGHT_COLORS[sig]
            const labels = { red: 'Aandacht nodig', amber: 'Let op', green: 'Op koers' }
            return (
              <button
                key={sig}
                style={{
                  ...s.summaryCard,
                  background: filter === sig ? col.bg : '#0f0f0f',
                  border: `1px solid ${filter === sig ? col.border : '#1c1c1c'}`,
                  cursor: 'pointer',
                }}
                onClick={() => setFilter(filter === sig ? 'all' : sig)}
              >
                <span style={{ ...s.summaryDot, background: col.dot }} />
                <span style={{ ...s.summaryCount, color: col.text }}>{counts[sig]}</span>
                <span style={s.summaryLabel}>{labels[sig]}</span>
              </button>
            )
          })}
          <div style={s.summaryTotal}>
            <span style={s.summaryCount}>{leden.length}</span>
            <span style={s.summaryLabel}>Actieve leden</span>
          </div>
        </div>

        {/* Member rows */}
        {loading ? (
          <div style={s.empty}>Laden...</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>Geen leden gevonden.</div>
        ) : (
          <div style={s.list}>
            {filtered.map(lid => {
              const stoplight = getStoplight(lid)
              const col = STOPLIGHT_COLORS[stoplight]
              const signals = getSignals(lid)
              const dagContact = daysSince(lid.laatste_contact)
              const dagEval = daysSince(lid.laatste_evaluatie)

              return (
                <div
                  key={lid.id}
                  style={{
                    ...s.row,
                    borderLeft: `3px solid ${col.dot}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => router.push(`/leden/${lid.id}`)}
                >
                  {/* Left: name + trainer */}
                  <div style={s.rowMain}>
                    <div style={s.rowName}>
                      {lid.voornaam} {lid.achternaam}
                    </div>
                    <div style={s.rowMeta}>
                      {lid.lid_id} · {lid.trainer_naam}
                    </div>
                  </div>

                  {/* Middle: timing */}
                  <div style={s.rowTiming}>
                    <div style={s.timingItem}>
                      <span style={s.timingLabel}>Contact</span>
                      <span style={{
                        ...s.timingValue,
                        color: dagContact === null || dagContact > 14 ? '#dc2626' : '#888',
                      }}>
                        {dagContact === null ? 'Nooit' : `${dagContact}d`}
                      </span>
                    </div>
                    <div style={s.timingItem}>
                      <span style={s.timingLabel}>Evaluatie</span>
                      <span style={{
                        ...s.timingValue,
                        color: dagEval === null || dagEval > 42 ? '#dc2626' : '#888',
                      }}>
                        {dagEval === null ? 'Nooit' : `${dagEval}d`}
                      </span>
                    </div>
                  </div>

                  {/* Right: signals */}
                  <div style={s.signals}>
                    {signals.length === 0 ? (
                      <span style={{ ...s.signalTag, color: '#16a34a', background: '#081a0e', border: '1px solid #0e3018' }}>
                        Op koers
                      </span>
                    ) : signals.map((sig, i) => (
                      <span key={i} style={{
                        ...s.signalTag,
                        color: col.text,
                        background: col.bg,
                        border: `1px solid ${col.border}`,
                      }}>
                        {sig.label} · {sig.reden}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#e8e6e0',
    fontFamily: '"DM Mono", "Courier New", monospace',
  },
  header: {
    borderBottom: '1px solid #1a1a1a',
    padding: '0 32px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    background: '#0a0a0a',
    zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1100,
    width: '100%',
    margin: '0 auto',
  },
  wordmark: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.2em',
    color: '#fff',
  },
  nav: {
    display: 'flex',
    gap: 28,
    alignItems: 'center',
  },
  navActive: {
    fontSize: 13,
    color: '#fff',
    letterSpacing: '0.05em',
  },
  navLink: {
    fontSize: 13,
    color: '#444',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  body: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '40px 32px 120px',
  },
  summaryBar: {
    display: 'flex',
    gap: 12,
    marginBottom: 40,
    flexWrap: 'wrap' as const,
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 20px',
    borderRadius: 8,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#555',
    letterSpacing: '0.05em',
  },
  summaryTotal: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 20px',
    marginLeft: 'auto',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
    padding: '18px 20px',
    background: '#0f0f0f',
    borderRadius: 6,
    transition: 'background 0.15s',
  },
  rowMain: {
    minWidth: 220,
    flex: '0 0 220px',
  },
  rowName: {
    fontSize: 14,
    color: '#e8e6e0',
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 12,
    color: '#444',
    letterSpacing: '0.03em',
  },
  rowTiming: {
    display: 'flex',
    gap: 28,
    flex: '0 0 180px',
  },
  timingItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
  },
  timingLabel: {
    fontSize: 10,
    color: '#333',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  timingValue: {
    fontSize: 14,
    fontVariantNumeric: 'tabular-nums',
  },
  signals: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
    flex: 1,
    justifyContent: 'flex-end',
  },
  signalTag: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 4,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap' as const,
  },
  empty: {
    color: '#333',
    fontSize: 14,
    padding: '60px 0',
    textAlign: 'center' as const,
  },
}
