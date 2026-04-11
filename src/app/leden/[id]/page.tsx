'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  email: string | null
  telefoon: string | null
  geboortedatum: string | null
  startdatum: string | null
  actief: boolean
}

type Evaluatie = {
  id: string
  cyclus: number
  datum: string
  slaap: number | null
  energie: number | null
  stress: number | null
  gewicht_kg: number | null
  vetpercentage: number | null
}

type ContactMoment = {
  id: string
  datum: string
  type: string | null
  notities: string | null
}

type Actie = {
  id: string
  omschrijving: string
  status: string
  aangemaakt: string
  deadline: string | null
}

type HealthSignal = {
  label: string
  value: number
  unit?: string
  status: 'red' | 'amber' | 'green'
  reden: string
}

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const scoreColor = (score: number | null, inverted = false): string => {
  if (score === null) return '#333'
  const bad = inverted ? score > 7 : score < 6
  const ok = inverted ? score > 5 : score > 7
  if (bad) return '#dc2626'
  if (ok) return '#16a34a'
  return '#888'
}

// Derive health signals from the most recent evaluation
// TODO v0.2 — allow trainer to create an actie directly linked to a health signal
// (e.g. actie.health_signal = 'slaap' | 'energie' | 'stress').
// Requires: acties.health_signal nullable text column + UI trigger on signal row.
const getHealthSignals = (ev: Evaluatie | null): HealthSignal[] => {
  if (!ev) return []

  const signals: HealthSignal[] = []

  if (ev.slaap !== null) {
    signals.push({
      label: 'Slaap',
      value: ev.slaap,
      unit: '/10',
      status: ev.slaap < 6 ? 'red' : ev.slaap < 7 ? 'amber' : 'green',
      reden: ev.slaap < 6
        ? 'Onder drempelwaarde — actie vereist'
        : ev.slaap < 7
        ? 'Dicht bij drempelwaarde'
        : 'Geen zorgen',
    })
  }

  if (ev.energie !== null) {
    signals.push({
      label: 'Energie',
      value: ev.energie,
      unit: '/10',
      status: ev.energie < 6 ? 'red' : ev.energie < 7 ? 'amber' : 'green',
      reden: ev.energie < 6
        ? 'Onder drempelwaarde — actie vereist'
        : ev.energie < 7
        ? 'Dicht bij drempelwaarde'
        : 'Geen zorgen',
    })
  }

  if (ev.stress !== null) {
    signals.push({
      label: 'Stress',
      value: ev.stress,
      unit: '/10',
      status: ev.stress > 7 ? 'red' : ev.stress > 5 ? 'amber' : 'green',
      reden: ev.stress > 7
        ? 'Boven drempelwaarde — actie vereist'
        : ev.stress > 5
        ? 'Dicht bij drempelwaarde'
        : 'Geen zorgen',
    })
  }

  return signals
}

const HEALTH_COLORS = {
  red:   { bg: '#1a0808', border: '#3a1010', dot: '#dc2626', text: '#f87171', label: '#f87171' },
  amber: { bg: '#1a1208', border: '#3a2a08', dot: '#d97706', text: '#fbbf24', label: '#fbbf24' },
  green: { bg: '#081a0e', border: '#0e3018', dot: '#16a34a', text: '#4ade80', label: '#4ade80' },
}

export default function LedenDetail() {
  const { id } = useParams()
  const router = useRouter()

  const [lid, setLid] = useState<Lid | null>(null)
  const [evaluaties, setEvaluaties] = useState<Evaluatie[]>([])
  const [contacten, setContacten] = useState<ContactMoment[]>([])
  const [acties, setActies] = useState<Actie[]>([])
  const [loading, setLoading] = useState(true)

  const [contactOpen, setContactOpen] = useState(false)
  const [contactDatum, setContactDatum] = useState(new Date().toISOString().split('T')[0])
  const [contactType, setContactType] = useState('check-in')
  const [contactNotities, setContactNotities] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()

      const { data: lidData } = await supabase
        .from('leden')
        .select('id, lid_id, voornaam, achternaam, email, telefoon, geboortedatum, startdatum, actief')
        .eq('id', id)
        .single()

      setLid(lidData)

      const { data: evalData } = await supabase
        .from('evaluaties')
        .select('id, cyclus, datum, slaap, energie, stress, gewicht_kg, vetpercentage')
        .eq('lid_id', id)
        .order('cyclus', { ascending: false })

      setEvaluaties(evalData ?? [])

      const { data: contactData } = await supabase
        .from('contact_momenten')
        .select('id, datum, type, notities')
        .eq('lid_id', id)
        .order('datum', { ascending: false })

      setContacten(contactData ?? [])

      const { data: actiesData } = await supabase
        .from('acties')
        .select('id, omschrijving, status, aangemaakt, deadline')
        .eq('lid_id', id)
        .eq('status', 'open')
        .order('aangemaakt', { ascending: true })

      setActies(actiesData ?? [])
      setLoading(false)
    }

    if (id) load()
  }, [id])

  const markActieAfgerond = async (actieId: string) => {
    const supabase = getSupabase()
    const { error } = await supabase
      .from('acties')
      .update({ status: 'afgerond', afgerond: true, afgerond_op: new Date().toISOString() })
      .eq('id', actieId)
      .select()

    if (!error) {
      setActies(prev => prev.filter(a => a.id !== actieId))
    }
  }

  const logContact = async () => {
    if (!lid) return
    setSavingContact(true)
    const supabase = getSupabase()
    await supabase.from('contact_momenten').insert({
      lid_id: lid.id,
      datum: contactDatum,
      type: contactType,
      notities: contactNotities || null,
    })
    const { data: fresh } = await supabase
      .from('contact_momenten')
      .select('id, datum, type, notities')
      .eq('lid_id', lid.id)
      .order('datum', { ascending: false })
    setContacten(fresh ?? [])
    setContactOpen(false)
    setContactNotities('')
    setSavingContact(false)
  }

  const latestEval = evaluaties[0] ?? null
  const healthSignals = getHealthSignals(latestEval)
  const flaggedSignals = healthSignals.filter(s => s.status !== 'green')

  if (loading) return <main style={s.main}><div style={s.empty}>Laden...</div></main>
  if (!lid) return <main style={s.main}><div style={s.empty}>Lid niet gevonden.</div></main>

  return (
    <main style={s.main}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.wordmark} onClick={() => router.back()}>← terug</span>
          <div style={s.headerRight}>
            <button style={s.btnAccent} onClick={() => router.push(`/leden/${id}/vooruitgang`)}>
              Vooruitgang tonen
            </button>
            <button style={s.btnPrimary} onClick={() => router.push(`/gesprek/new?lid_id=${lid.id}`)}>
              + Nieuw gesprek
            </button>
          </div>
        </div>
      </header>

      <div style={s.body}>

        {/* Member info */}
        <div style={s.memberHeader}>
          <div>
            <div style={s.memberName}>{lid.voornaam} {lid.achternaam}</div>
            <div style={s.memberMeta}>
              {lid.lid_id}
              {lid.startdatum && ` · lid sinds ${formatDate(lid.startdatum)}`}
              {!lid.actief && ' · inactief'}
            </div>
          </div>
          <div style={s.memberContact}>
            {lid.email && <span style={s.memberContactItem}>{lid.email}</span>}
            {lid.telefoon && <span style={s.memberContactItem}>{lid.telefoon}</span>}
          </div>
        </div>

        <div style={s.grid}>

          {/* Left column */}
          <div style={s.col}>

            {/* Evaluaties */}
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionTitle}>Evaluaties</span>
                <span style={s.sectionCount}>{evaluaties.length}</span>
              </div>
              {evaluaties.length === 0 ? (
                <div style={s.empty}>Geen evaluaties.</div>
              ) : evaluaties.map(ev => (
                <div
                  key={ev.id}
                  style={{ ...s.row, cursor: 'pointer' }}
                  onClick={() => router.push(`/leden/${id}/evaluatie/${ev.cyclus}`)}
                >
                  <div style={s.rowMain}>
                    <div style={s.rowName}>Cyclus {ev.cyclus}</div>
                    <div style={s.rowMeta}>{formatDate(ev.datum)}</div>
                  </div>
                  <div style={s.scoreRow}>
                    <div style={s.scoreItem}>
                      <span style={s.scoreLabel}>Slaap</span>
                      <span style={{ ...s.scoreValue, color: scoreColor(ev.slaap) }}>{ev.slaap ?? '—'}</span>
                    </div>
                    <div style={s.scoreItem}>
                      <span style={s.scoreLabel}>Energie</span>
                      <span style={{ ...s.scoreValue, color: scoreColor(ev.energie) }}>{ev.energie ?? '—'}</span>
                    </div>
                    <div style={s.scoreItem}>
                      <span style={s.scoreLabel}>Stress</span>
                      <span style={{ ...s.scoreValue, color: scoreColor(ev.stress, true) }}>{ev.stress ?? '—'}</span>
                    </div>
                    {ev.gewicht_kg && (
                      <div style={s.scoreItem}>
                        <span style={s.scoreLabel}>Gewicht</span>
                        <span style={{ ...s.scoreValue, color: '#888' }}>{ev.gewicht_kg}kg</span>
                      </div>
                    )}
                  </div>
                  <span style={s.rowArrow}>→</span>
                </div>
              ))}
            </div>

            {/* Contact momenten */}
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionTitle}>Contact momenten</span>
                <button style={s.sectionBtn} onClick={() => setContactOpen(o => !o)}>
                  {contactOpen ? 'annuleren' : '+ log contact'}
                </button>
              </div>

              {contactOpen && (
                <div style={s.formCard}>
                  <div style={s.formRow}>
                    <label style={s.formLabel}>Datum</label>
                    <input
                      type="date"
                      value={contactDatum}
                      onChange={e => setContactDatum(e.target.value)}
                      style={s.input}
                    />
                  </div>
                  <div style={s.formRow}>
                    <label style={s.formLabel}>Type</label>
                    <select value={contactType} onChange={e => setContactType(e.target.value)} style={s.input}>
                      <option value="check-in">Check-in</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telefoon">Telefoon</option>
                      <option value="sessie">Sessie</option>
                      <option value="anders">Anders</option>
                    </select>
                  </div>
                  <div style={s.formRow}>
                    <label style={s.formLabel}>Notities</label>
                    <textarea
                      value={contactNotities}
                      onChange={e => setContactNotities(e.target.value)}
                      placeholder="Optioneel..."
                      style={{ ...s.input, height: 72, resize: 'vertical' as const }}
                    />
                  </div>
                  <button style={s.btnPrimary} onClick={logContact} disabled={savingContact}>
                    {savingContact ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              )}

              {contacten.length === 0 ? (
                <div style={s.empty}>Geen contactmomenten.</div>
              ) : contacten.map(c => (
                <div key={c.id} style={s.row}>
                  <div style={s.rowMain}>
                    <div style={s.rowName}>{c.type ?? 'Contact'}</div>
                    <div style={s.rowMeta}>{formatDate(c.datum)}</div>
                  </div>
                  {c.notities && <div style={s.rowNote}>{c.notities}</div>}
                </div>
              ))}
            </div>

          </div>

          {/* Right column */}
          <div style={s.col}>

            {/* Health signals */}
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionTitle}>Gezondheid</span>
                {latestEval && (
                  <span style={s.sectionMeta}>cyclus {latestEval.cyclus} · {formatDate(latestEval.datum)}</span>
                )}
              </div>

              {!latestEval ? (
                <div style={s.empty}>Geen evaluatiedata.</div>
              ) : healthSignals.length === 0 ? (
                <div style={s.empty}>Geen scores beschikbaar.</div>
              ) : (
                <>
                  {/* Flagged signals first, prominent */}
                  {flaggedSignals.length > 0 && (
                    <div style={s.signalGroup}>
                      {flaggedSignals.map(sig => {
                        const col = HEALTH_COLORS[sig.status]
                        return (
                          <div key={sig.label} style={{
                            ...s.signalCard,
                            background: col.bg,
                            border: `1px solid ${col.border}`,
                          }}>
                            <div style={s.signalTop}>
                              <div style={s.signalLeft}>
                                <span style={{ ...s.signalDot, background: col.dot }} />
                                <span style={{ ...s.signalLabel, color: col.label }}>{sig.label}</span>
                              </div>
                              <div style={s.signalRight}>
                                <span style={{ ...s.signalValue, color: col.text }}>
                                  {sig.value}
                                </span>
                                <span style={s.signalUnit}>{sig.unit}</span>
                              </div>
                            </div>
                            <div style={{ ...s.signalReden, color: col.text }}>
                              {sig.reden}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Green signals — muted row */}
                  {healthSignals.filter(s => s.status === 'green').length > 0 && (
                    <div style={s.greenRow}>
                      {healthSignals.filter(sig => sig.status === 'green').map(sig => (
                        <div key={sig.label} style={s.greenItem}>
                          <span style={s.greenDot} />
                          <span style={s.greenLabel}>{sig.label}</span>
                          <span style={s.greenValue}>{sig.value}{sig.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Open acties */}
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <span style={s.sectionTitle}>Open acties</span>
                <span style={s.sectionCount}>{acties.length}</span>
              </div>
              {acties.length === 0 ? (
                <div style={s.empty}>Geen open acties.</div>
              ) : acties.map(actie => (
                <div key={actie.id} style={s.actieRow}>
                  <div style={s.rowMain}>
                    <div style={s.rowName}>{actie.omschrijving}</div>
                    <div style={s.rowMeta}>
                      {formatDate(actie.aangemaakt)}
                      {actie.deadline && ` · deadline ${formatDate(actie.deadline)}`}
                    </div>
                  </div>
                  <button style={s.doneBtn} onClick={() => markActieAfgerond(actie.id)}>
                    ✓ Afgerond
                  </button>
                </div>
              ))}
            </div>

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
    fontSize: 12,
    color: '#444',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
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
  btnAccent: {
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
  body: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '40px 32px 120px',
  },
  memberHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 48,
    gap: 32,
  },
  memberName: {
    fontSize: 22,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 8,
    letterSpacing: '0.02em',
  },
  memberMeta: {
    fontSize: 12,
    color: '#444',
    letterSpacing: '0.05em',
  },
  memberContact: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: 6,
  },
  memberContactItem: {
    fontSize: 12,
    color: '#555',
    letterSpacing: '0.03em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: 32,
    alignItems: 'flex-start',
  },
  col: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 40,
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  },
  sectionMeta: {
    fontSize: 11,
    color: '#333',
    letterSpacing: '0.03em',
  },
  sectionBtn: {
    background: 'transparent',
    border: 'none',
    color: '#555',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 11,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    padding: 0,
  },

  // Health signal cards (red/amber)
  signalGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    marginBottom: 6,
  },
  signalCard: {
    borderRadius: 6,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  signalTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signalLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  signalDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  signalLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  signalRight: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
  },
  signalValue: {
    fontSize: 22,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  },
  signalUnit: {
    fontSize: 11,
    color: '#444',
  },
  signalReden: {
    fontSize: 11,
    letterSpacing: '0.03em',
    opacity: 0.85,
  },

  // Green signals — compact muted row
  greenRow: {
    display: 'flex',
    gap: 16,
    padding: '10px 16px',
    background: '#0d0d0d',
    borderRadius: 6,
    flexWrap: 'wrap' as const,
  },
  greenItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#16a34a',
    flexShrink: 0,
  },
  greenLabel: {
    fontSize: 11,
    color: '#555',
    letterSpacing: '0.05em',
  },
  greenValue: {
    fontSize: 11,
    color: '#4ade80',
    fontVariantNumeric: 'tabular-nums',
  },

  // Shared row styles
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '14px 16px',
    background: '#0f0f0f',
    borderRadius: 6,
    marginBottom: 2,
  },
  actieRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '14px 16px',
    background: '#0f0f0f',
    borderRadius: 6,
    marginBottom: 2,
    borderLeft: '3px solid #2a2a2a',
  },
  rowMain: {
    flex: 1,
  },
  rowName: {
    fontSize: 13,
    color: '#e8e6e0',
    marginBottom: 3,
  },
  rowMeta: {
    fontSize: 11,
    color: '#444',
    letterSpacing: '0.03em',
  },
  rowNote: {
    fontSize: 12,
    color: '#555',
    flex: 1,
    letterSpacing: '0.02em',
  },
  rowArrow: {
    fontSize: 14,
    color: '#333',
  },
  scoreRow: {
    display: 'flex',
    gap: 16,
  },
  scoreItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 9,
    color: '#333',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  scoreValue: {
    fontSize: 13,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
  },
  doneBtn: {
    background: 'transparent',
    border: '1px solid #2a2a2a',
    color: '#555',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 11,
    letterSpacing: '0.05em',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  formCard: {
    background: '#0f0f0f',
    border: '1px solid #1a1a1a',
    borderRadius: 6,
    padding: '20px',
    marginBottom: 2,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  formLabel: {
    fontSize: 10,
    color: '#444',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  input: {
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    color: '#e8e6e0',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 4,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  empty: {
    color: '#333',
    fontSize: 13,
    padding: '24px 0',
    textAlign: 'center' as const,
  },
}
