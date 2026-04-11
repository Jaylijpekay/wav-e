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
  key: string
  label: string
  value: number | null
  unit: string
  status: 'red' | 'amber' | 'green' | 'empty'
  reden: string
  inverted: boolean
}

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const daysSince = (date: string | null): number | null => {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

// TODO v0.2 — allow trainer to create an actie directly linked to a health signal
// (e.g. actie.health_signal = 'slaap' | 'energie' | 'stress').
// Requires: acties.health_signal nullable text column + "+ Actie" button per flagged signal card.
const buildHealthSignals = (ev: Evaluatie | null): HealthSignal[] => {
  const make = (
    key: string,
    label: string,
    value: number | null,
    unit: string,
    inverted: boolean
  ): HealthSignal => {
    if (value === null) return { key, label, value, unit, status: 'empty', reden: 'Nog niet gemeten', inverted }
    const bad = inverted ? value > 7 : value < 6
    const warn = inverted ? value > 5 : value < 7
    const status = bad ? 'red' : warn ? 'amber' : 'green'
    const reden = bad
      ? inverted ? 'Boven drempelwaarde' : 'Onder drempelwaarde'
      : warn
      ? 'Dicht bij drempelwaarde'
      : 'Goed'
    return { key, label, value, unit, status, reden, inverted }
  }

  return [
    make('slaap',   'Slaap',   ev?.slaap   ?? null, '/10', false),
    make('energie', 'Energie', ev?.energie ?? null, '/10', false),
    make('stress',  'Stress',  ev?.stress  ?? null, '/10', true),
  ]
}

const HEALTH = {
  red:   { bg: '#1c0a0a', border: '#3d1515', dot: '#ef4444', text: '#fca5a5', dim: '#7f1d1d' },
  amber: { bg: '#1a1305', border: '#3d2e0a', dot: '#f59e0b', text: '#fcd34d', dim: '#78350f' },
  green: { bg: '#061510', border: '#0d3320', dot: '#22c55e', text: '#86efac', dim: '#14532d' },
  empty: { bg: '#111', border: '#1e1e1e', dot: '#2a2a2a', text: '#333', dim: '#1a1a1a' },
}

const scoreColor = (score: number | null, inverted = false): string => {
  if (score === null) return '#2a2a2a'
  const bad = inverted ? score > 7 : score < 6
  const ok = inverted ? score > 5 : score > 7 // note: for non-inverted ok means > 7
  if (bad) return '#ef4444'
  if (ok) return '#22c55e'
  return '#666'
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
    if (!error) setActies(prev => prev.filter(a => a.id !== actieId))
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
  const healthSignals = buildHealthSignals(latestEval)
  const lastContactDays = daysSince(contacten[0]?.datum ?? null)

  if (loading) return (
    <main style={s.main}>
      <div style={s.loadingState}>Laden...</div>
    </main>
  )

  if (!lid) return (
    <main style={s.main}>
      <div style={s.loadingState}>Lid niet gevonden.</div>
    </main>
  )

  return (
    <main style={s.main}>

      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <button style={s.backBtn} onClick={() => router.back()}>
            ← terug
          </button>
          <div style={s.headerActions}>
            <button style={s.btnGhost} onClick={() => router.push(`/leden/${id}/vooruitgang`)}>
              Vooruitgang
            </button>
            <button style={s.btnPrimary} onClick={() => router.push(`/gesprek/new?lid_id=${lid.id}`)}>
              + Nieuw gesprek
            </button>
          </div>
        </div>
      </header>

      <div style={s.body}>

        {/* Member identity block */}
        <div style={s.identityBlock}>
          <div style={s.identityLeft}>
            <div style={s.avatar}>
              {lid.voornaam[0]}{lid.achternaam[0]}
            </div>
            <div>
              <h1 style={s.memberName}>{lid.voornaam} {lid.achternaam}</h1>
              <div style={s.memberMeta}>
                <span style={s.metaTag}>{lid.lid_id}</span>
                {lid.startdatum && (
                  <span style={s.metaTag}>lid sinds {formatDate(lid.startdatum)}</span>
                )}
                {!lid.actief && (
                  <span style={{ ...s.metaTag, color: '#ef4444', borderColor: '#3d1515' }}>inactief</span>
                )}
                {lastContactDays !== null && (
                  <span style={{
                    ...s.metaTag,
                    color: lastContactDays > 14 ? '#f59e0b' : '#555',
                    borderColor: lastContactDays > 14 ? '#3d2e0a' : '#1e1e1e',
                  }}>
                    contact {lastContactDays}d geleden
                  </span>
                )}
                {lastContactDays === null && (
                  <span style={{ ...s.metaTag, color: '#ef4444', borderColor: '#3d1515' }}>
                    nog geen contact
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={s.identityRight}>
            {lid.email && <a href={`mailto:${lid.email}`} style={s.contactLink}>{lid.email}</a>}
            {lid.telefoon && <a href={`tel:${lid.telefoon}`} style={s.contactLink}>{lid.telefoon}</a>}
          </div>
        </div>

        {/* Main grid */}
        <div style={s.grid}>

          {/* Left column */}
          <div style={s.col}>

            {/* Evaluatie history */}
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionLabel}>Evaluaties</span>
                <span style={s.sectionBadge}>{evaluaties.length}</span>
              </div>

              {evaluaties.length === 0 ? (
                <div style={s.emptyState}>
                  <span style={s.emptyIcon}>○</span>
                  <span>Nog geen evaluaties</span>
                </div>
              ) : evaluaties.map(ev => (
                <div
                  key={ev.id}
                  style={s.evalRow}
                  onClick={() => router.push(`/leden/${id}/evaluatie/${ev.cyclus}`)}
                >
                  <div style={s.evalLeft}>
                    <div style={s.evalCyclus}>Cyclus {ev.cyclus}</div>
                    <div style={s.evalDatum}>{formatDate(ev.datum)}</div>
                  </div>
                  <div style={s.evalScores}>
                    {[
                      { label: 'S', val: ev.slaap, inv: false },
                      { label: 'E', val: ev.energie, inv: false },
                      { label: 'ST', val: ev.stress, inv: true },
                    ].map(({ label, val, inv }) => (
                      <div key={label} style={s.evalScore}>
                        <span style={s.evalScoreLabel}>{label}</span>
                        <span style={{ ...s.evalScoreVal, color: scoreColor(val, inv) }}>
                          {val ?? '—'}
                        </span>
                      </div>
                    ))}
                    {ev.gewicht_kg && (
                      <div style={s.evalScore}>
                        <span style={s.evalScoreLabel}>KG</span>
                        <span style={{ ...s.evalScoreVal, color: '#555' }}>{ev.gewicht_kg}</span>
                      </div>
                    )}
                  </div>
                  <span style={s.evalArrow}>›</span>
                </div>
              ))}
            </section>

            {/* Contact momenten */}
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionLabel}>Contact</span>
                <button style={s.sectionAction} onClick={() => setContactOpen(o => !o)}>
                  {contactOpen ? '× annuleren' : '+ log contact'}
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
                      style={{ ...s.input, height: 80, resize: 'vertical' as const }}
                    />
                  </div>
                  <button style={s.btnPrimary} onClick={logContact} disabled={savingContact}>
                    {savingContact ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              )}

              {contacten.length === 0 && !contactOpen ? (
                <div style={s.emptyState}>
                  <span style={s.emptyIcon}>○</span>
                  <span>Nog geen contactmomenten</span>
                </div>
              ) : contacten.map(c => (
                <div key={c.id} style={s.contactRow}>
                  <div style={s.contactType}>{c.type ?? 'Contact'}</div>
                  <div style={s.contactDatum}>{formatDate(c.datum)}</div>
                  {c.notities && <div style={s.contactNote}>{c.notities}</div>}
                </div>
              ))}
            </section>

          </div>

          {/* Right column */}
          <div style={s.col}>

            {/* Health signals — always visible */}
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionLabel}>Gezondheid</span>
                {latestEval ? (
                  <span style={s.sectionMeta}>
                    cyclus {latestEval.cyclus} · {formatDate(latestEval.datum)}
                  </span>
                ) : (
                  <span style={{ ...s.sectionMeta, color: '#333' }}>geen data</span>
                )}
              </div>

              <div style={s.healthGrid}>
                {healthSignals.map(sig => {
                  const col = HEALTH[sig.status]
                  return (
                    <div
                      key={sig.key}
                      style={{
                        ...s.healthCard,
                        background: col.bg,
                        borderColor: col.border,
                      }}
                    >
                      <div style={s.healthCardTop}>
                        <span style={{ ...s.healthDot, background: col.dot }} />
                        <span style={{ ...s.healthLabel, color: sig.status === 'empty' ? '#2a2a2a' : '#888' }}>
                          {sig.label}
                        </span>
                      </div>
                      <div style={s.healthValueRow}>
                        <span style={{ ...s.healthValue, color: col.text }}>
                          {sig.value ?? '—'}
                        </span>
                        <span style={{ ...s.healthUnit, color: col.dim }}>
                          {sig.value !== null ? sig.unit : ''}
                        </span>
                      </div>
                      <div style={{ ...s.healthReden, color: col.dim }}>
                        {sig.reden}
                      </div>
                    </div>
                  )
                })}
              </div>

              {!latestEval && (
                <div style={s.healthEmptyNote}>
                  Scores verschijnen na het eerste evaluatiegesprek
                </div>
              )}
            </section>

            {/* Open acties */}
            <section style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionLabel}>Open acties</span>
                <span style={s.sectionBadge}>{acties.length}</span>
              </div>

              {acties.length === 0 ? (
                <div style={s.emptyState}>
                  <span style={s.emptyIcon}>✓</span>
                  <span>Geen open acties</span>
                </div>
              ) : acties.map(actie => {
                const isOverdue = actie.deadline && new Date(actie.deadline) < new Date()
                return (
                  <div key={actie.id} style={{
                    ...s.actieRow,
                    borderLeftColor: isOverdue ? '#ef4444' : '#1e3a2a',
                  }}>
                    <div style={s.actieContent}>
                      <div style={s.actieName}>{actie.omschrijving}</div>
                      <div style={s.actieMeta}>
                        {formatDate(actie.aangemaakt)}
                        {actie.deadline && (
                          <span style={{ color: isOverdue ? '#ef4444' : '#444' }}>
                            {' '}· deadline {formatDate(actie.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      style={s.doneBtn}
                      onClick={() => markActieAfgerond(actie.id)}
                    >
                      ✓
                    </button>
                  </div>
                )
              })}
            </section>

          </div>
        </div>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#080808',
    color: '#d4d0c8',
    fontFamily: '"DM Mono", "Courier New", monospace',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#333',
    fontSize: 13,
    letterSpacing: '0.1em',
  },

  // Header
  header: {
    borderBottom: '1px solid #141414',
    height: 52,
    display: 'flex',
    alignItems: 'center',
    padding: '0 32px',
    position: 'sticky' as const,
    top: 0,
    background: '#080808',
    zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1140,
    width: '100%',
    margin: '0 auto',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#333',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 11,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    padding: 0,
  },
  headerActions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #1e1e1e',
    color: '#444',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 11,
    letterSpacing: '0.06em',
    padding: '7px 14px',
    borderRadius: 3,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#e8e4dc',
    border: '1px solid #e8e4dc',
    color: '#080808',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 11,
    letterSpacing: '0.06em',
    padding: '7px 14px',
    borderRadius: 3,
    cursor: 'pointer',
    fontWeight: 700,
  },

  // Identity block
  body: {
    maxWidth: 1140,
    margin: '0 auto',
    padding: '48px 32px 120px',
  },
  identityBlock: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 56,
    gap: 24,
  },
  identityLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 6,
    background: '#141414',
    border: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#444',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  memberName: {
    fontSize: 24,
    fontWeight: 700,
    color: '#f0ece4',
    margin: '0 0 10px',
    letterSpacing: '-0.01em',
  },
  memberMeta: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  metaTag: {
    fontSize: 10,
    color: '#444',
    border: '1px solid #1e1e1e',
    borderRadius: 3,
    padding: '3px 8px',
    letterSpacing: '0.06em',
  },
  identityRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: 6,
  },
  contactLink: {
    fontSize: 11,
    color: '#333',
    textDecoration: 'none',
    letterSpacing: '0.03em',
  },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: 40,
    alignItems: 'flex-start',
  },
  col: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 48,
  },

  // Sections
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: '1px solid #111',
  },
  sectionLabel: {
    fontSize: 10,
    color: '#333',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  },
  sectionBadge: {
    fontSize: 10,
    color: '#2a2a2a',
    letterSpacing: '0.05em',
  },
  sectionMeta: {
    fontSize: 10,
    color: '#2a2a2a',
    letterSpacing: '0.04em',
  },
  sectionAction: {
    background: 'none',
    border: 'none',
    color: '#333',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 10,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    padding: 0,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 0',
    color: '#222',
    fontSize: 12,
    letterSpacing: '0.04em',
  },
  emptyIcon: {
    fontSize: 14,
    color: '#1e1e1e',
  },

  // Evaluatie rows
  evalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '13px 16px',
    background: '#0d0d0d',
    border: '1px solid #111',
    borderRadius: 5,
    cursor: 'pointer',
    marginBottom: 2,
  },
  evalLeft: {
    flex: 1,
  },
  evalCyclus: {
    fontSize: 12,
    color: '#c8c4bc',
    marginBottom: 2,
  },
  evalDatum: {
    fontSize: 10,
    color: '#333',
    letterSpacing: '0.04em',
  },
  evalScores: {
    display: 'flex',
    gap: 14,
  },
  evalScore: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
  },
  evalScoreLabel: {
    fontSize: 8,
    color: '#2a2a2a',
    letterSpacing: '0.1em',
  },
  evalScoreVal: {
    fontSize: 13,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  evalArrow: {
    fontSize: 18,
    color: '#222',
  },

  // Contact rows
  contactRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '4px 12px',
    padding: '12px 16px',
    background: '#0d0d0d',
    border: '1px solid #111',
    borderRadius: 5,
    marginBottom: 2,
  },
  contactType: {
    fontSize: 12,
    color: '#c8c4bc',
  },
  contactDatum: {
    fontSize: 10,
    color: '#333',
    letterSpacing: '0.04em',
    textAlign: 'right' as const,
  },
  contactNote: {
    fontSize: 11,
    color: '#444',
    gridColumn: '1 / -1',
    letterSpacing: '0.02em',
    marginTop: 2,
  },

  // Health signals
  healthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
  },
  healthCard: {
    borderRadius: 6,
    border: '1px solid',
    padding: '14px 14px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  healthCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  healthLabel: {
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  },
  healthValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
  },
  healthValue: {
    fontSize: 28,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
  },
  healthUnit: {
    fontSize: 11,
    fontWeight: 400,
  },
  healthReden: {
    fontSize: 9,
    letterSpacing: '0.04em',
    lineHeight: 1.4,
  },
  healthEmptyNote: {
    fontSize: 10,
    color: '#222',
    letterSpacing: '0.04em',
    padding: '10px 0 4px',
    textAlign: 'center' as const,
  },

  // Acties
  actieRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '13px 16px',
    background: '#0d0d0d',
    border: '1px solid #111',
    borderLeft: '3px solid #1e3a2a',
    borderRadius: 5,
    marginBottom: 2,
  },
  actieContent: {
    flex: 1,
  },
  actieName: {
    fontSize: 12,
    color: '#c8c4bc',
    marginBottom: 3,
  },
  actieMeta: {
    fontSize: 10,
    color: '#333',
    letterSpacing: '0.03em',
  },
  doneBtn: {
    background: 'transparent',
    border: '1px solid #1e1e1e',
    color: '#2a2a2a',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    width: 30,
    height: 30,
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Form
  formCard: {
    background: '#0d0d0d',
    border: '1px solid #141414',
    borderRadius: 5,
    padding: 18,
    marginBottom: 3,
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
    fontSize: 9,
    color: '#333',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
  input: {
    background: '#080808',
    border: '1px solid #1e1e1e',
    color: '#d4d0c8',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    padding: '8px 12px',
    borderRadius: 4,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
}
