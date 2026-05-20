'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
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
  is_management: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for planned member dropdown work.
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

const toUiStoplight = (stoplight: ReturnType<typeof getStoplight>): 'red' | 'amber' | 'green' => {
  if (stoplight === 'rood') return 'red'
  if (stoplight === 'oranje') return 'amber'
  return 'green'
}

const getLidStoplight = (lid: Lid): 'red' | 'amber' | 'green' =>
  toUiStoplight(getStoplight(daysSince(getLatestContactDatum(lid.laatste_contact, lid.laatste_evaluatie))))

const STOPLIGHT = {
  red:   { dot: 'var(--red-danger)', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.2)',   text: 'var(--red-text)' },
  amber: { dot: 'var(--amber)', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)',   text: 'var(--amber-text)' },
  green: { dot: 'var(--green-signal)', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.2)',   text: 'var(--green-signal-text)' },
}

const DUTCH_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

const todayIsoDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDaysIsoDate = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getIsoDatePart = (iso: string | null) => iso?.slice(0, 10) ?? null

const formatDeadlineDate = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return `${String(day).padStart(2, '0')} ${DUTCH_MONTHS[month - 1]}`
}

const isActieOverdue = (actie: Actie, today = todayIsoDate()) => {
  const deadline = getIsoDatePart(actie.deadline)
  return actie.status === 'open' && deadline !== null && deadline < today
}

const getActieDeadlineDaysRemaining = (actie: Actie, today = todayIsoDate()) => {
  if (actie.status !== 'open') return null
  const deadline = getIsoDatePart(actie.deadline)
  if (!deadline || deadline <= today) return null
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number)
  const [deadlineYear, deadlineMonth, deadlineDay] = deadline.split('-').map(Number)
  const todayTime = new Date(todayYear, todayMonth - 1, todayDay).getTime()
  const deadlineTime = new Date(deadlineYear, deadlineMonth - 1, deadlineDay).getTime()
  return Math.round((deadlineTime - todayTime) / 86400000)
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

const getLidActieSortTier = (acties: Actie[], today = todayIsoDate()) => {
  const nextWeek = addDaysIsoDate(today, 7)
  const openActies = acties.filter(a => a.status === 'open')
  if (openActies.some(a => isActieOverdue(a, today))) return 0
  if (openActies.some(a => {
    const deadline = getIsoDatePart(a.deadline)
    return deadline !== null && deadline >= today && deadline <= nextWeek
  })) return 1
  if (openActies.length > 0) return 2
  return 3
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

  const completeActie = async (id: string) => {
    setCompletingId(id)
    setCompleteError(null)
    try {
      const res = await fetch(`/api/acties/${id}`, { method: 'PATCH' })
      if (res.ok) {
        setActies(prev => prev.filter(a => a.id !== id))
      } else {
        setCompleteError('Afmelden mislukt — probeer opnieuw')
      }
    } catch {
      setCompleteError('Verbindingsfout — probeer opnieuw')
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .td-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--bg-base);
          color: var(--text-warm);
          font-family: 'Raleway', sans-serif;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }

        .td-root::before { display: none; }

        .td-header {
          display: none;
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(17,17,17,0.92);
          border-bottom: 1px solid rgba(168,200,0,0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 1.5rem;
        }

        .td-header-inner {
          max-width: var(--app-shell-max);
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .td-wordmark {
          display: flex;
          align-items: baseline;
          gap: 0;
          text-decoration: none;
          flex-shrink: 0;
        }
        .td-wordmark-wav { font-size: 1.1rem; font-weight: 700; color: var(--text-low); letter-spacing: -0.01em; }
        .td-wordmark-e   { font-size: 1.1rem; font-weight: 700; color: var(--wave-green); letter-spacing: -0.01em; }

        .td-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: nowrap;
        }

        .td-trainer-name {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-faint);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-right: 2px;
          white-space: nowrap;
        }

        .td-btn-secondary {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 16px;
          min-height: 44px;
          border-radius: 3px;
          border: 1px solid var(--border-muted-dark);
          background: transparent;
          color: var(--text-mid);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
          white-space: nowrap;
          touch-action: manipulation;
        }
        .td-btn-secondary:hover {
          border-color: rgba(168,200,0,0.4);
          color: var(--wave-green);
          background: rgba(168,200,0,0.06);
        }
        .td-btn-secondary:active {
          border-color: rgba(168,200,0,0.5);
          color: var(--wave-green);
          background: rgba(168,200,0,0.08);
        }

        .td-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--surface-dark);
          border: 1px solid var(--border-muted-dark);
          border-radius: 4px;
          min-width: 240px;
          z-index: 200;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          animation: dropIn 0.15s ease-out both;
        }

        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .td-dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--bg-base);
          transition: background 0.1s;
          min-height: 48px;
        }
        .td-dropdown-item:last-child { border-bottom: none; }
        .td-dropdown-item:hover  { background: rgba(168,200,0,0.06); }
        .td-dropdown-item:active { background: rgba(168,200,0,0.10); }

        .td-dropdown-name  { font-size: 0.88rem; color: var(--text-warm); font-weight: 500; }
        .td-dropdown-meta  { font-size: 0.72rem; color: var(--text-faint); letter-spacing: 0.05em; }
        .td-dropdown-empty { padding: 16px; font-size: 0.8rem; color: var(--text-faint); text-align: center; }

        .td-body {
          max-width: var(--app-shell-max);
          margin: 0 auto;
          padding: 32px var(--app-shell-padding) 6rem;
          position: relative;
          z-index: 1;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .td-section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 1rem;
          animation: fadeUp 0.4s ease-out both;
        }

        .td-section-title {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .td-section-count {
          font-size: 0.65rem;
          color: var(--border-muted-dark);
          background: var(--surface-pressed);
          padding: 2px 7px;
          border-radius: 2px;
          font-weight: 600;
        }

        .td-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 3px;
          overflow: hidden;
          animation: fadeUp 0.4s ease-out 0.08s both;
        }

        .td-row {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 18px 20px;
          min-height: 56px;
          background: rgba(255,255,255,0.02);
          border-left: 3px solid transparent;
          cursor: pointer;
          transition: background 0.15s;
          touch-action: manipulation;
        }

        .td-row:hover:not(.no-nav) { background: rgba(255,255,255,0.04); }
        .td-row:active:not(.no-nav) { background: var(--surface-pressed); }
        .td-row.no-nav { cursor: default; }
        .td-row.overdue { border-left-color: var(--color-stoplight-rood); }

        .td-row-actie { flex: 1; font-size: 0.85rem; color: var(--text-dim); line-height: 1.4; }
        .td-row-dagen { font-size: 0.75rem; font-variant-numeric: tabular-nums; flex: 0 0 36px; text-align: right; font-weight: 600; }
        .td-row-deadline {
          margin-top: 5px;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .td-row-deadline.neutral { color: var(--text-faint); }
        .td-row-deadline.today { color: var(--amber-text); }
        .td-row-deadline.overdue { color: var(--color-stoplight-rood); }

        .td-mgmt-badge {
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-accent-text);
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 2px;
          padding: 2px 6px;
          margin-top: 3px;
          display: inline-block;
        }

        .td-empty {
          color: var(--border-muted-dark);
          font-size: 0.85rem;
          padding: 4rem 0;
          text-align: center;
          letter-spacing: 0.05em;
        }

        .td-group-header {
          padding: 10px 20px 8px;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          min-height: 44px;
          touch-action: manipulation;
        }
        .td-group-header:active { background: var(--surface-dark); }
        .td-group-header.no-nav { cursor: default; }

        @media (min-width: 768px) and (pointer: coarse) {
          .td-header { height: 64px; padding: 0 2rem; }

          .td-btn-secondary {
            padding: 12px 20px;
            min-height: 48px;
            font-size: 0.78rem;
          }

          .td-body { padding: 32px 24px 6rem; }

          .td-dropdown-item { padding: 16px 20px; min-height: 54px; }
          .td-dropdown-name { font-size: 0.95rem; }

          .td-row { padding: 20px 24px; min-height: 64px; }
          .td-row-actie { font-size: 0.9rem; }

          .td-group-header { padding: 12px 24px 10px; min-height: 50px; }

          .td-dropdown { min-width: 280px; }
        }

        @media (min-width: 900px) and (pointer: coarse) and (orientation: landscape) {
          .td-trainer-name { display: inline; }
        }

        @media (max-width: 899px) and (pointer: coarse) and (orientation: portrait) {
          .td-trainer-name { display: none; }
          .td-header-right { gap: 8px; }
          .td-btn-secondary { padding: 10px 12px; font-size: 0.7rem; }
        }
      `}</style>

      <div className="td-root">
        <Navigation />

        <header className="td-header">
          <div className="td-header-inner">
            <div className="td-wordmark">
              <span className="td-wordmark-wav">wav</span>
              <span className="td-wordmark-e">-e</span>
            </div>
            <div className="td-header-right">
              {trainer?.naam && <span className="td-trainer-name">{trainer.naam}</span>}
              <button
                className="td-btn-secondary"
                onClick={() => router.push(`/trainer/${trainerId}`)}
              >
                ← Dashboard
              </button>
            </div>
          </div>
        </header>

        <div className="td-body">
          <div className="td-section-header">
            <span className="td-section-title">Open acties</span>
            <span className="td-section-count">{acties.length}</span>
          </div>
          {completeError && (
            <div style={{ fontSize: '0.75rem', color: 'var(--red-text)', padding: '4px 0 8px', letterSpacing: '0.03em' }}>{completeError}</div>
          )}

          {loading ? (
            <div className="td-empty">Laden…</div>
          ) : acties.length === 0 ? (
            <div className="td-empty">Geen open acties.</div>
          ) : (() => {
            const mgmt   = acties.filter(a => a.is_management)
            const member = acties.filter(a => !a.is_management)

            const groups: Record<string, Actie[]> = {}
            for (const a of member) {
              if (!a.lid_uuid) continue
              if (!groups[a.lid_uuid]) groups[a.lid_uuid] = []
              groups[a.lid_uuid].push(a)
            }

            const today = todayIsoDate()
            const sortedLidIds = Object.keys(groups).sort((a, b) => {
              const tierDiff = getLidActieSortTier(groups[a], today) - getLidActieSortTier(groups[b], today)
              if (tierDiff !== 0) return tierDiff

              const lidA = leden.find(l => l.id === a)
              const lidB = leden.find(l => l.id === b)
              const nameA = `${lidA?.voornaam ?? ''} ${lidA?.achternaam ?? ''}`.trim()
              const nameB = `${lidB?.voornaam ?? ''} ${lidB?.achternaam ?? ''}`.trim()
              return nameA.localeCompare(nameB, 'nl', { sensitivity: 'base' })
            })

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Management group */}
                {mgmt.length > 0 && (
                  <div className="td-list">
                    <div className="td-group-header no-nav">
                      <span style={{ width: 3, height: 12, background: 'var(--color-accent)', borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-accent-text)' }}>Management</span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--border-muted-dark)', marginLeft: 2 }}>{mgmt.length}</span>
                    </div>
                    {mgmt.map(actie => {
                      const deadlineLabel = getActieDeadlineLabel(actie, today)
                      const deadlineDaysRemaining = getActieDeadlineDaysRemaining(actie, today)
                      const overdue = isActieOverdue(actie, today)
                      const completing = completingId === actie.id
                      return (
                        <div
                          key={actie.id}
                          className={`td-row no-nav${overdue ? ' overdue' : ''}`}
                          style={{ borderLeftColor: overdue ? 'var(--color-stoplight-rood)' : 'var(--color-accent)' }}
                        >
                          <div className="td-row-actie" style={{ color: 'var(--wave-gray)' }}>
                            {actie.omschrijving}
                            {deadlineLabel && (
                              <div className={`td-row-deadline ${deadlineLabel.tone}`}>{deadlineLabel.text}</div>
                            )}
                          </div>
                          {deadlineDaysRemaining !== null && (
                            <div className="td-row-dagen" style={{ color: 'var(--text-faint)' }}>
                              {deadlineDaysRemaining}d
                            </div>
                          )}
                          <button
                            onClick={() => completeActie(actie.id)}
                            disabled={completing}
                            style={{ background: 'none', border: '1px solid rgba(168,200,0,0.35)', borderRadius: 3, color: 'var(--wave-green)', cursor: completing ? 'default' : 'pointer', fontSize: '0.8rem', fontWeight: 700, minHeight: 36, minWidth: 36, opacity: completing ? 0.4 : 1, touchAction: 'manipulation', flexShrink: 0 }}
                          >
                            ✓
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Per-lid groups */}
                {sortedLidIds.map(lidUuid => {
                  const lidActies = groups[lidUuid]
                  const lid = leden.find(l => l.id === lidUuid)
                  const sig = lid ? getLidStoplight(lid) : 'green'
                  const col = STOPLIGHT[sig]

                  return (
                    <div key={lidUuid} className="td-list">
                      <div
                        className="td-group-header"
                        onClick={() => router.push(`/leden/${lidUuid}`)}
                      >
                        <span style={{ width: 3, height: 12, background: col.dot, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: col.text }}>
                          {lid ? `${lid.voornaam} ${lid.achternaam}` : '—'}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--border-muted-dark)', marginLeft: 2 }}>{lidActies.length}</span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--border-muted-dark)', marginLeft: 'auto', letterSpacing: '0.06em' }}>
                          {lid?.lid_id}
                        </span>
                      </div>

                      {lidActies.map(actie => {
                        const deadlineLabel = getActieDeadlineLabel(actie, today)
                        const deadlineDaysRemaining = getActieDeadlineDaysRemaining(actie, today)
                        const overdue = isActieOverdue(actie, today)
                        return (
                          <div
                            key={actie.id}
                            className={`td-row${overdue ? ' overdue' : ''}`}
                            style={{ borderLeftColor: overdue ? 'var(--color-stoplight-rood)' : col.dot }}
                            onClick={() => router.push(`/leden/${lidUuid}`)}
                          >
                            <div className="td-row-actie">
                              {actie.omschrijving}
                              {deadlineLabel && (
                                <div className={`td-row-deadline ${deadlineLabel.tone}`}>{deadlineLabel.text}</div>
                              )}
                            </div>
                            {deadlineDaysRemaining !== null && (
                              <div className="td-row-dagen" style={{ color: 'var(--text-faint)' }}>
                                {deadlineDaysRemaining}d
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    </>
  )
}
