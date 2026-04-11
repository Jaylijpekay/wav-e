'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  laatste_contact: string | null
  laatste_evaluatie: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
  open_acties: number
}

type Actie = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  omschrijving: string
  aangemaakt: string
}

type LidDropdown = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
}

type Trainer = {
  id: string
  naam: string
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

export default function TrainerDashboard() {
  const { trainerId } = useParams()
  const router = useRouter()

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [leden, setLeden] = useState<Lid[]>([])
  const [acties, setActies] = useState<Actie[]>([])
  const [ledenDropdown, setLedenDropdown] = useState<LidDropdown[]>([])
  const [loading, setLoading] = useState(true)
  const [gesprekOpen, setGesprekOpen] = useState(false)
  const [openStoplight, setOpenStoplight] = useState<'red' | 'amber' | null>(null)

  const gesprekRef = useRef<HTMLDivElement>(null)
  const stoplightRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()

      const { data: trainerData } = await supabase
        .from('trainers')
        .select('id, naam')
        .eq('id', trainerId)
        .single()

      setTrainer(trainerData)

      const { data: ledenData } = await supabase
        .from('leden')
        .select('id, lid_id, voornaam, achternaam')
        .eq('trainer_id', trainerId)
        .eq('actief', true)
        .order('voornaam')

      if (!ledenData || ledenData.length === 0) {
        setLoading(false)
        return
      }

      setLedenDropdown(ledenData)

      const lidIds = ledenData.map(l => l.id)

      const { data: contacten } = await supabase
        .from('contact_momenten')
        .select('lid_id, datum')
        .in('lid_id', lidIds)
        .order('datum', { ascending: false })

      const { data: evaluaties } = await supabase
        .from('evaluaties')
        .select('lid_id, datum, slaap, energie, stress, cyclus')
        .in('lid_id', lidIds)
        .order('cyclus', { ascending: false })

      const { data: actiesData } = await supabase
        .from('acties')
        .select('id, lid_id, omschrijving, aangemaakt')
        .in('lid_id', lidIds)
        .eq('status', 'open')
        .order('aangemaakt', { ascending: true })

      const openActiesPerLid: Record<string, number> = {}
      for (const a of actiesData ?? []) {
        openActiesPerLid[a.lid_id] = (openActiesPerLid[a.lid_id] ?? 0) + 1
      }

      const enrichedLeden: Lid[] = ledenData.map(l => {
        const lastContact = contacten?.find(c => c.lid_id === l.id)
        const lastEval = evaluaties?.find(e => e.lid_id === l.id)
        return {
          id: l.id,
          lid_id: l.lid_id,
          voornaam: l.voornaam,
          achternaam: l.achternaam,
          laatste_contact: lastContact?.datum ?? null,
          laatste_evaluatie: lastEval?.datum ?? null,
          slaap: lastEval?.slaap ?? null,
          energie: lastEval?.energie ?? null,
          stress: lastEval?.stress ?? null,
          open_acties: openActiesPerLid[l.id] ?? 0,
        }
      })

      setLeden(enrichedLeden)

      const enrichedActies: Actie[] = (actiesData ?? []).map(a => {
        const lid = ledenData.find(l => l.id === a.lid_id)
        return {
          id: a.id,
          lid_id: lid?.lid_id ?? '—',
          voornaam: lid?.voornaam ?? '—',
          achternaam: lid?.achternaam ?? '',
          omschrijving: a.omschrijving,
          aangemaakt: a.aangemaakt,
        }
      })

      setActies(enrichedActies)
      setLoading(false)
    }

    if (trainerId) load()
  }, [trainerId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gesprekRef.current && !gesprekRef.current.contains(e.target as Node))
        setGesprekOpen(false)
      if (stoplightRef.current && !stoplightRef.current.contains(e.target as Node))
        setOpenStoplight(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleGesprekSelect = (lid: LidDropdown) => {
    setGesprekOpen(false)
    router.push(`/gesprek/new?lid_id=${lid.id}`)
  }

  const counts = {
    red:   leden.filter(l => getStoplight(l) === 'red').length,
    amber: leden.filter(l => getStoplight(l) === 'amber').length,
    green: leden.filter(l => getStoplight(l) === 'green').length,
  }

  const ledenByStoplight = (sig: 'red' | 'amber') =>
    leden.filter(l => getStoplight(l) === sig)

  return (
    <main style={s.main}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.wordmark} onClick={() => router.push('/')}>WAV-E</span>
          <div style={s.headerRight}>
            <span style={s.trainerName}>{trainer?.naam ?? '—'}</span>
            <button
              style={s.btnSecondary}
              onClick={() => router.push(`/trainer/${trainerId}/leden`)}
            >
              Mijn leden
            </button>

            <div style={{ position: 'relative' }} ref={gesprekRef}>
              <button
                style={s.btnPrimary}
                onClick={() => setGesprekOpen(o => !o)}
              >
                + Nieuw gesprek
              </button>
              {gesprekOpen && (
                <div style={s.dropdown}>
                  {ledenDropdown.length === 0 ? (
                    <div style={s.dropdownEmpty}>Geen leden gevonden</div>
                  ) : ledenDropdown.map(lid => (
                    <div
                      key={lid.id}
                      style={s.dropdownItem}
                      onClick={() => handleGesprekSelect(lid)}
                    >
                      <span style={s.dropdownName}>{lid.voornaam} {lid.achternaam}</span>
                      <span style={s.dropdownMeta}>{lid.lid_id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div style={s.body}>

        {/* Stoplight summary bar */}
        {!loading && (
          <div style={s.summaryBar} ref={stoplightRef}>

            {(['red', 'amber'] as const).map(sig => {
              const col = STOPLIGHT_COLORS[sig]
              const labels = { red: 'Aandacht nodig', amber: 'Let op' }
              const isOpen = openStoplight === sig
              const members = ledenByStoplight(sig)

              return (
                <div key={sig} style={{ position: 'relative' }}>
                  <button
                    style={{
                      ...s.summaryCard,
                      background: isOpen ? col.bg : '#0f0f0f',
                      border: `1px solid ${isOpen ? col.border : '#1c1c1c'}`,
                      cursor: counts[sig] > 0 ? 'pointer' : 'default',
                    }}
                    onClick={() => counts[sig] > 0 && setOpenStoplight(isOpen ? null : sig)}
                  >
                    <span style={{ ...s.summaryDot, background: col.dot }} />
                    <span style={{ ...s.summaryCount, color: col.text }}>{counts[sig]}</span>
                    <span style={s.summaryLabel}>{labels[sig]}</span>
                    {counts[sig] > 0 && (
                      <span style={{ ...s.summaryLabel, color: '#333', marginLeft: 4 }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    )}
                  </button>

                  {isOpen && members.length > 0 && (
                    <div style={{ ...s.dropdown, top: 'calc(100% + 6px)', left: 0, right: 'auto', minWidth: 220 }}>
                      {members.map(lid => (
                        <div
                          key={lid.id}
                          style={s.dropdownItem}
                          onClick={() => {
                            setOpenStoplight(null)
                            router.push(`/leden/${lid.id}`)
                          }}
                        >
                          <span style={s.dropdownName}>{lid.voornaam} {lid.achternaam}</span>
                          <span style={{ ...s.dropdownMeta, color: col.text }}>{lid.lid_id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Green — not clickable */}
            <button
              style={{
                ...s.summaryCard,
                background: '#0f0f0f',
                border: '1px solid #1c1c1c',
                cursor: 'default',
              }}
            >
              <span style={{ ...s.summaryDot, background: STOPLIGHT_COLORS.green.dot }} />
              <span style={{ ...s.summaryCount, color: STOPLIGHT_COLORS.green.text }}>{counts.green}</span>
              <span style={s.summaryLabel}>Op koers</span>
            </button>

            <div style={s.summaryTotal}>
              <span style={s.summaryCount}>{leden.length}</span>
              <span style={s.summaryLabel}>Actieve leden</span>
            </div>
          </div>
        )}

        {/* Open acties — always all, never filtered */}
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Open acties</span>
          <span style={s.sectionCount}>{acties.length}</span>
        </div>

        {loading ? (
          <div style={s.empty}>Laden...</div>
        ) : acties.length === 0 ? (
          <div style={s.empty}>Geen open acties.</div>
        ) : (
          <div style={s.list}>
            {acties.map(actie => {
              const dagen = daysSince(actie.aangemaakt)
              const isOud = dagen !== null && dagen > 7
              const lid = leden.find(l => l.lid_id === actie.lid_id)
              const stoplight = lid ? getStoplight(lid) : 'green'
              const col = STOPLIGHT_COLORS[stoplight]

              return (
                <div
                  key={actie.id}
                  style={{
                    ...s.row,
                    borderLeft: `3px solid ${col.dot}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => router.push(`/leden/${actie.lid_id}`)}
                >
                  <div style={s.rowMain}>
                    <div style={s.rowName}>
                      {actie.voornaam} {actie.achternaam}
                    </div>
                    <div style={s.rowMeta}>{actie.lid_id}</div>
                  </div>

                  <div style={s.rowActie}>
                    {actie.omschrijving}
                  </div>

                  <div style={{
                    ...s.rowDagen,
                    color: isOud ? '#dc2626' : '#444',
                  }}>
                    {dagen === null ? '—' : `${dagen}d`}
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
    cursor: 'pointer',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  trainerName: {
    fontSize: 12,
    color: '#444',
    letterSpacing: '0.05em',
    marginRight: 8,
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid #2a2a2a',
    color: '#888',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    letterSpacing: '0.05em',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#fff',
    border: '1px solid #fff',
    color: '#0a0a0a',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    letterSpacing: '0.05em',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    fontWeight: 600,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    minWidth: 240,
    zIndex: 50,
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #1a1a1a',
    transition: 'background 0.1s',
  },
  dropdownName: {
    fontSize: 13,
    color: '#e8e6e0',
  },
  dropdownMeta: {
    fontSize: 11,
    color: '#444',
  },
  dropdownEmpty: {
    padding: '16px',
    fontSize: 12,
    color: '#444',
    textAlign: 'center' as const,
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
    alignItems: 'flex-start',
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
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    color: '#444',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
  sectionCount: {
    fontSize: 11,
    color: '#333',
    letterSpacing: '0.05em',
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
    minWidth: 200,
    flex: '0 0 200px',
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
  rowActie: {
    flex: 1,
    fontSize: 13,
    color: '#888',
    letterSpacing: '0.02em',
  },
  rowDagen: {
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    flex: '0 0 40px',
    textAlign: 'right' as const,
  },
  empty: {
    color: '#333',
    fontSize: 14,
    padding: '60px 0',
    textAlign: 'center' as const,
  },
}
