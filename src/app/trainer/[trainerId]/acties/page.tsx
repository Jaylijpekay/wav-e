'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getActieUrgency, isActieOpen, URGENCY_COLOR, URGENCY_LABEL } from '@/lib/actieUrgency'
import { daysSince, getLatestContactDatum, getStoplight } from '@/lib/stoplight'
import Navigation from '@/app/components/Navigation'

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
  lid_uuid: string | null
  lid_id: string
  voornaam: string
  achternaam: string
  omschrijving: string
  aangemaakt: string
  deadline: string | null
  status: 'open' | 'afgerond' | 'overdue'
  bron: string
  afgerond: boolean
  is_management: boolean
}

type Trainer = {
  id: string
  naam: string
}

const toUiStoplight = (stoplight: ReturnType<typeof getStoplight>): 'red' | 'amber' | 'green' => {
  if (stoplight === 'rood') return 'red'
  if (stoplight === 'oranje') return 'amber'
  return 'green'
}

const getLidStoplight = (lid: Lid): 'red' | 'amber' | 'green' =>
  toUiStoplight(getStoplight(daysSince(getLatestContactDatum(lid.laatste_contact, lid.laatste_evaluatie))))

const STOPLIGHT_DOT: Record<'red' | 'amber' | 'green', string> = {
  red: 'var(--red-danger)',
  amber: 'var(--amber)',
  green: 'var(--green-signal)',
}

const DUTCH_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

const todayIsoDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getIsoDatePart = (iso: string | null) => iso?.slice(0, 10) ?? null

const formatDeadlineDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return `${String(day).padStart(2, '0')} ${DUTCH_MONTHS[month - 1]}`
}

const getActieDeadlineLabel = (actie: Actie, today = todayIsoDate()) => {
  if (actie.status === 'afgerond') return null
  const deadline = getIsoDatePart(actie.deadline)
  if (!deadline) return null
  if (actie.status === 'open' && deadline < today) return { text: 'VERLOPEN', tone: 'overdue' as const }
  if (deadline === today) return { text: 'Vandaag', tone: 'today' as const }
  const formatted = formatDeadlineDate(deadline)
  return formatted ? { text: `Deadline: ${formatted}`, tone: 'neutral' as const } : null
}

export default function TrainerActiesPage() {
  const params = useParams()
  const router = useRouter()
  const trainerId = params.trainerId as string

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [leden, setLeden] = useState<Lid[]>([])
  const [acties, setActies] = useState<Actie[]>([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [showToekomstig, setShowToekomstig] = useState(false)

  const completeActie = async (id: string) => {
    setCompletingId(id)
    setCompleteError(null)
    try {
      const res = await fetch(`/api/acties/${id}`, { method: 'PATCH' })
      if (res.ok) {
        setActies(prev => prev.filter(a => a.id !== id))
      } else {
        setCompleteError('Afmelden mislukt - probeer opnieuw')
      }
    } catch {
      setCompleteError('Verbindingsfout - probeer opnieuw')
    } finally {
      setCompletingId(null)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/trainer/${trainerId}/acties`)
        if (!res.ok) throw new Error('Acties ophalen mislukt')
        const data = await res.json()
        setTrainer(data.trainer)
        setLeden(data.leden ?? [])
        setActies(data.acties ?? [])
      } catch {
        setTrainer(null)
        setLeden([])
        setActies([])
      } finally {
        setLoading(false)
      }
    }
    if (trainerId) load()
  }, [trainerId])

  const managementActies = acties
    .filter(a => !a.afgerond && a.bron === 'management')
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  const openActies = acties
    .filter(a => !a.afgerond && a.bron !== 'management' && isActieOpen(a.deadline, a.bron, a.afgerond))
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))

  const toekomstigeActies = acties
    .filter(a => !a.afgerond && a.bron !== 'management' && getActieUrgency(a.deadline, a.bron) === 'toekomstig')
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  const zichtbareActiesCount = managementActies.length + openActies.length
  const today = todayIsoDate()

  const secondaryButtonStyle: CSSProperties = {
    minHeight: 44,
    background: 'none',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    padding: '9px 18px',
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    touchAction: 'manipulation',
  }
  const checkButtonStyle: CSSProperties = {
    ...secondaryButtonStyle,
    width: 44,
    padding: 0,
    color: 'var(--green-signal-text)',
    flexShrink: 0,
    opacity: 1,
  }
  const sectionStyle: CSSProperties = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 16,
    overflow: 'hidden',
  }
  const sectionHeaderStyle: CSSProperties = {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
  const rowStyle: CSSProperties = {
    padding: '14px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
  }
  const openActiesByLid = openActies.reduce<Record<string, Actie[]>>((acc, actie) => {
    const key = actie.lid_uuid ?? 'zonder-lid'
    acc[key] = [...(acc[key] ?? []), actie]
    return acc
  }, {})
  const openActieGroups = Object.entries(openActiesByLid).sort(([a], [b]) => {
    const lidA = leden.find(l => l.id === a)
    const lidB = leden.find(l => l.id === b)
    return `${lidA?.voornaam ?? ''} ${lidA?.achternaam ?? ''}`.localeCompare(`${lidB?.voornaam ?? ''} ${lidB?.achternaam ?? ''}`, 'nl', { sensitivity: 'base' })
  })

  return (
    <>
      <Navigation />

      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Mijn acties</h1>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              {zichtbareActiesCount} open acties{trainer?.naam ? ` · ${trainer.naam}` : ''}
            </div>
          </div>
          <button style={secondaryButtonStyle} onClick={() => router.push(`/trainer/${trainerId}`)}>
            ← Dashboard
          </button>
        </div>

        {completeError && (
          <div style={{ color: 'var(--red-text)', fontSize: 13 }}>{completeError}</div>
        )}

        {loading ? (
          <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Laden…</div>
        ) : zichtbareActiesCount === 0 && toekomstigeActies.length === 0 ? (
          <section style={sectionStyle}>
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen open acties.</div>
          </section>
        ) : (
          <>
            {managementActies.length > 0 && (
              <section style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Van management</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{managementActies.length}</div>
                </div>
                {managementActies.map((actie, index) => {
                  const deadlineLabel = getActieDeadlineLabel(actie, today)
                  const completing = completingId === actie.id
                  return (
                    <div key={actie.id} style={{ ...rowStyle, borderBottom: index < managementActies.length - 1 ? '1px solid var(--border-subtle)' : 'none', borderLeft: '3px solid var(--color-accent)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{actie.omschrijving}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-accent-text)', marginTop: 4, fontWeight: 700 }}>Management</div>
                        {deadlineLabel && (
                          <div style={{ fontSize: 12, color: deadlineLabel.tone === 'overdue' ? 'var(--red-text)' : 'var(--text-muted)', marginTop: 4 }}>{deadlineLabel.text}</div>
                        )}
                      </div>
                      <button style={{ ...checkButtonStyle, opacity: completing ? 0.5 : 1 }} onClick={() => completeActie(actie.id)} disabled={completing}>✓</button>
                    </div>
                  )
                })}
              </section>
            )}

            {openActies.length > 0 && (
              <section style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Open acties</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{openActies.length}</div>
                </div>
                {openActieGroups.map(([lidUuid, lidActies]) => {
                  const lid = leden.find(l => l.id === lidUuid)
                  const sig = lid ? getLidStoplight(lid) : 'green'
                  return (
                    <div key={lidUuid}>
                      <div style={{ padding: '10px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{lid ? `${lid.voornaam} ${lid.achternaam}` : 'Zonder lid'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lid?.lid_id}</div>
                      </div>
                      {lidActies.map(actie => {
                        const urgency = getActieUrgency(actie.deadline, actie.bron)
                        const kleur = urgency === 'toekomstig' ? 'groen' : urgency
                        const deadlineLabel = getActieDeadlineLabel(actie, today)
                        const completing = completingId === actie.id
                        return (
                          <div key={actie.id} style={{ ...rowStyle, borderLeft: `3px solid ${URGENCY_COLOR[kleur]}` }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STOPLIGHT_DOT[sig], flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{actie.omschrijving}</div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: URGENCY_COLOR[kleur], textTransform: 'uppercase', letterSpacing: '0.06em' }}>{URGENCY_LABEL[urgency]}</span>
                                {deadlineLabel && <span style={{ fontSize: 12, color: deadlineLabel.tone === 'overdue' ? 'var(--red-text)' : 'var(--text-muted)' }}>{deadlineLabel.text}</span>}
                              </div>
                            </div>
                            <button style={{ ...checkButtonStyle, opacity: completing ? 0.5 : 1 }} onClick={() => completeActie(actie.id)} disabled={completing}>✓</button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </section>
            )}

            {toekomstigeActies.length > 0 && (
              <section style={sectionStyle}>
                <button
                  onClick={() => setShowToekomstig(o => !o)}
                  style={{ ...sectionHeaderStyle, width: '100%', background: 'var(--bg-surface)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', touchAction: 'manipulation', minHeight: 44 }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Toekomstig ({toekomstigeActies.length})</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{showToekomstig ? '▲' : '▼'}</div>
                </button>
                {showToekomstig && toekomstigeActies.map((actie, index) => {
                  const deadlineLabel = getActieDeadlineLabel(actie, today)
                  return (
                    <div key={actie.id} style={{ ...rowStyle, borderBottom: index < toekomstigeActies.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: 0.72 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{actie.omschrijving}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {actie.voornaam} {actie.achternaam}{deadlineLabel ? ` · ${deadlineLabel.text}` : ''}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
