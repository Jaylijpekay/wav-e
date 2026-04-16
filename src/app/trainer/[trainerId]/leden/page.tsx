'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  email: string | null
  telefoon: string | null
  geboortedatum: string | null
  geslacht: string | null
  startdatum: string
  status: string | null
  actief: boolean
  laatste_contact: string | null
  laatste_evaluatie: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
  open_acties: number
}

type Trainer = {
  id: string
  naam: string
}

// ── Helpers ────────────────────────────────────────────────────────────

const daysSince = (date: string | null): number | null => {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

const getStoplight = (lid: Lid): 'red' | 'amber' | 'green' => {
  const dagsSindsContact = daysSince(lid.laatste_contact)
  const dagsSindsEval    = daysSince(lid.laatste_evaluatie)
  const hasRedLifestyle  =
    (lid.slaap   !== null && lid.slaap   < 6) ||
    (lid.energie !== null && lid.energie < 6) ||
    (lid.stress  !== null && lid.stress  > 7)

  if (dagsSindsEval === null || dagsSindsEval > 42 || hasRedLifestyle) return 'red'
  if (dagsSindsContact === null || dagsSindsContact > 14 || lid.open_acties > 0) return 'amber'
  return 'green'
}

const STOPLIGHT = {
  red:   { dot: '#dc2626', bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)',  text: '#f87171',  label: 'Aandacht' },
  amber: { dot: '#d97706', bg: 'rgba(217,119,6,0.07)',  border: 'rgba(217,119,6,0.18)',  text: '#fbbf24',  label: 'Let op'   },
  green: { dot: '#16a34a', bg: 'rgba(22,163,74,0.07)',  border: 'rgba(22,163,74,0.18)',  text: '#4ade80',  label: 'Op koers' },
}

const STATUS_COLOR: Record<string, string> = {
  actief:   '#4ade80',
  bevroren: '#60a5fa',
  'on hold': '#fbbf24',
  stopt:    '#f87171',
  inactief: '#555',
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ── Page ───────────────────────────────────────────────────────────────

export default function MijnLedenPage() {
  const { trainerId } = useParams()
  const router = useRouter()

  const [trainer, setTrainer]   = useState<Trainer | null>(null)
  const [leden, setLeden]       = useState<Lid[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | 'red' | 'amber' | 'green'>('all')
  const [search, setSearch]     = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()

      const { data: trainerData } = await supabase
        .from('trainers').select('id, naam').eq('id', trainerId).single()
      setTrainer(trainerData)

      const { data: ledenData } = await supabase
        .from('leden')
        .select('id, lid_id, voornaam, achternaam, email, telefoon, geboortedatum, geslacht, startdatum, status, actief')
        .eq('trainer_id', trainerId)
        .order('voornaam')

      if (!ledenData || ledenData.length === 0) { setLoading(false); return }

      const lidIds = ledenData.map(l => l.id)

      const [{ data: contacten }, { data: evaluaties }, { data: actiesData }] = await Promise.all([
        supabase.from('contact_momenten').select('lid_id, datum').in('lid_id', lidIds).order('datum', { ascending: false }),
        supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').in('lid_id', lidIds).order('cyclus', { ascending: false }),
        supabase.from('acties').select('id, lid_id').in('lid_id', lidIds).eq('status', 'open'),
      ])

      const openActiesPerLid: Record<string, number> = {}
      for (const a of actiesData ?? []) openActiesPerLid[a.lid_id] = (openActiesPerLid[a.lid_id] ?? 0) + 1

      const enriched: Lid[] = ledenData.map(l => {
        const lastContact = contacten?.find(c => c.lid_id === l.id)
        const lastEval    = evaluaties?.find(e => e.lid_id === l.id)
        return {
          ...l,
          laatste_contact:    lastContact?.datum   ?? null,
          laatste_evaluatie:  lastEval?.datum      ?? null,
          slaap:              lastEval?.slaap      ?? null,
          energie:            lastEval?.energie    ?? null,
          stress:             lastEval?.stress     ?? null,
          open_acties:        openActiesPerLid[l.id] ?? 0,
        }
      })

      setLeden(enriched)
      setLoading(false)
    }
    if (trainerId) load()
  }, [trainerId])

  const counts = {
    red:   leden.filter(l => getStoplight(l) === 'red').length,
    amber: leden.filter(l => getStoplight(l) === 'amber').length,
    green: leden.filter(l => getStoplight(l) === 'green').length,
  }

  const visible = leden.filter(l => {
    if (filter !== 'all' && getStoplight(l) !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        l.voornaam.toLowerCase().includes(q) ||
        l.achternaam.toLowerCase().includes(q) ||
        l.lid_id.toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .ml-root {
          min-height: 100vh;
          background: #111;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
        }
        .ml-root::before {
          content: '';
          position: fixed;
          top: -20%; right: -10%;
          width: 55%; height: 55%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.04) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Header */
        .ml-header {
          position: sticky; top: 0; z-index: 100;
          height: 52px;
          display: flex; align-items: center; padding: 0 2rem;
          background: rgba(17,17,17,0.92);
          border-bottom: 1px solid rgba(168,200,0,0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .ml-header-inner {
          max-width: 960px; width: 100%; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
        }
        .ml-back {
          background: none; border: none;
          color: #555; font-family: 'Raleway', sans-serif;
          font-size: 0.72rem; font-weight: 500; letter-spacing: 0.08em;
          cursor: pointer; padding: 0; transition: color 0.15s;
        }
        .ml-back:hover { color: #A8C800; }
        .ml-header-title {
          font-size: 0.72rem; font-weight: 500;
          letter-spacing: 0.1em; text-transform: uppercase; color: #B4B4B4;
        }

        /* Body */
        .ml-body {
          max-width: 960px; margin: 0 auto;
          padding: 2rem 2rem 6rem;
          position: relative; z-index: 1;
        }

        /* Page title */
        .ml-title {
          font-size: 1.3rem; font-weight: 700; color: #fff;
          letter-spacing: -0.02em; margin: 0 0 6px;
        }
        .ml-subtitle {
          font-size: 0.7rem; color: #444; letter-spacing: 0.06em;
          margin-bottom: 1.75rem;
        }

        /* Stoplight filter bar */
        .ml-filter-bar {
          display: flex; gap: 8px; margin-bottom: 1.25rem; flex-wrap: wrap;
        }
        .ml-filter-btn {
          display: flex; align-items: center; gap: 7px;
          background: #161616; border: 1px solid #1e1e1e;
          border-radius: 3px; padding: 7px 14px;
          font-family: 'Raleway', sans-serif;
          font-size: 0.68rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: #555;
          cursor: pointer; transition: all 0.15s;
        }
        .ml-filter-btn:hover { border-color: #2a2a2a; color: #888; }
        .ml-filter-btn.active { color: #c8c6c0; border-color: #333; background: #1a1a1a; }
        .ml-filter-dot {
          width: 7px; height: 7px; border-radius: 50%;
        }
        .ml-filter-count {
          font-size: 0.62rem; color: #444;
        }

        /* Search */
        .ml-search {
          width: 100%; box-sizing: border-box;
          background: #161616; border: 1px solid #1e1e1e; border-radius: 3px;
          padding: 9px 14px; margin-bottom: 1.25rem;
          font-family: 'Raleway', sans-serif; font-size: 0.82rem; color: #c8c6c0;
          outline: none; transition: border-color 0.15s;
        }
        .ml-search::placeholder { color: #2e2e2e; }
        .ml-search:focus { border-color: rgba(168,200,0,0.25); }

        /* Table */
        .ml-table-wrap {
          border: 1px solid #1a1a1a; border-radius: 3px; overflow: hidden;
          animation: mlFadeUp 0.3s ease-out both;
        }
        .ml-table {
          width: 100%; border-collapse: collapse;
        }
        .ml-th {
          font-size: 0.58rem; font-weight: 600; letter-spacing: 0.12em;
          text-transform: uppercase; color: #333;
          padding: 10px 16px; text-align: left;
          background: #141414; border-bottom: 1px solid #1a1a1a;
        }
        .ml-th:last-child { text-align: right; }
        .ml-tr {
          background: #141414; border-bottom: 1px solid #171717;
          cursor: pointer; transition: background 0.12s;
        }
        .ml-tr:last-child { border-bottom: none; }
        .ml-tr:hover { background: #181818; }
        .ml-td {
          padding: 13px 16px; vertical-align: middle;
          font-size: 0.78rem; color: #666;
        }

        /* Name cell */
        .ml-name { font-size: 0.875rem; font-weight: 600; color: #c8c6c0; margin-bottom: 2px; }
        .ml-lid-id { font-size: 0.62rem; color: #2e2e2e; letter-spacing: 0.06em; }

        /* Contact/eval cells */
        .ml-days-ok  { color: #3a3a3a; font-variant-numeric: tabular-nums; }
        .ml-days-warn { color: #fbbf24; font-variant-numeric: tabular-nums; font-weight: 600; }
        .ml-days-red  { color: #f87171; font-variant-numeric: tabular-nums; font-weight: 600; }
        .ml-never { color: #2a2a2a; font-style: italic; font-size: 0.72rem; }

        /* Stoplight dot */
        .ml-dot {
          width: 9px; height: 9px; border-radius: 50%;
          display: inline-block; margin-right: 8px; flex-shrink: 0;
        }

        /* Status pill */
        .ml-status {
          font-size: 0.6rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 3px 8px; border-radius: 2px;
          border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03);
        }

        /* Acties badge */
        .ml-acties-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 3px;
          font-size: 0.65rem; font-weight: 700;
          background: rgba(220,38,38,0.12); color: #f87171;
        }

        /* Empty */
        .ml-empty {
          text-align: center; padding: 4rem 0;
          font-size: 0.8rem; color: #2a2a2a; letter-spacing: 0.06em;
        }

        /* Count label */
        .ml-count {
          font-size: 0.62rem; color: #333; letter-spacing: 0.06em;
          margin-bottom: 0.75rem;
        }

        @keyframes mlFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="ml-root">
        <header className="ml-header">
          <div className="ml-header-inner">
            <button className="ml-back" onClick={() => router.push(`/trainer/${trainerId}`)}>
              ← Dashboard
            </button>
            <span className="ml-header-title">Mijn leden</span>
          </div>
        </header>

        <div className="ml-body">
          <h1 className="ml-title">
            {trainer ? `${trainer.naam}` : 'Mijn leden'}
          </h1>
          <div className="ml-subtitle">
            {leden.length} {leden.length === 1 ? 'lid' : 'leden'} · alle statussen
          </div>

          {/* Stoplight filter */}
          {!loading && (
            <div className="ml-filter-bar">
              <button
                className={`ml-filter-btn${filter === 'all' ? ' active' : ''}`}
                onClick={() => setFilter('all')}
              >
                Allen <span className="ml-filter-count">{leden.length}</span>
              </button>
              {(['red', 'amber', 'green'] as const).map(sig => (
                <button
                  key={sig}
                  className={`ml-filter-btn${filter === sig ? ' active' : ''}`}
                  onClick={() => setFilter(sig)}
                >
                  <span className="ml-filter-dot" style={{ background: STOPLIGHT[sig].dot }} />
                  {STOPLIGHT[sig].label}
                  <span className="ml-filter-count">{counts[sig]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <input
            className="ml-search"
            type="text"
            placeholder="Zoek op naam, lid-id of e-mail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {loading ? (
            <div className="ml-empty">Laden…</div>
          ) : visible.length === 0 ? (
            <div className="ml-empty">Geen leden gevonden.</div>
          ) : (
            <>
              <div className="ml-count">{visible.length} {visible.length === 1 ? 'resultaat' : 'resultaten'}</div>
              <div className="ml-table-wrap">
                <table className="ml-table">
                  <thead>
                    <tr>
                      <th className="ml-th">Lid</th>
                      <th className="ml-th">Status</th>
                      <th className="ml-th">Laatste contact</th>
                      <th className="ml-th">Laatste evaluatie</th>
                      <th className="ml-th">Start</th>
                      <th className="ml-th" style={{ textAlign: 'right' }}>Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(lid => {
                      const sig = getStoplight(lid)
                      const col = STOPLIGHT[sig]
                      const dagContact = daysSince(lid.laatste_contact)
                      const dagEval    = daysSince(lid.laatste_evaluatie)

                      const contactClass = dagContact === null ? '' : dagContact > 14 ? 'ml-days-red' : dagContact > 10 ? 'ml-days-warn' : 'ml-days-ok'
                      const evalClass    = dagEval    === null ? '' : dagEval    > 42 ? 'ml-days-red' : dagEval    > 35 ? 'ml-days-warn' : 'ml-days-ok'

                      return (
                        <tr key={lid.id} className="ml-tr" onClick={() => router.push(`/leden/${lid.id}`)}>

                          {/* Lid naam + id */}
                          <td className="ml-td">
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <span className="ml-dot" style={{ background: col.dot }} />
                              <div>
                                <div className="ml-name">{lid.voornaam} {lid.achternaam}</div>
                                <div className="ml-lid-id">{lid.lid_id}</div>
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="ml-td">
                            {lid.status ? (
                              <span
                                className="ml-status"
                                style={{ color: STATUS_COLOR[lid.status.toLowerCase()] ?? '#555' }}
                              >
                                {lid.status}
                              </span>
                            ) : <span style={{ color: '#2a2a2a' }}>—</span>}
                          </td>

                          {/* Laatste contact */}
                          <td className="ml-td">
                            {lid.laatste_contact === null
                              ? <span className="ml-never">Nog nooit</span>
                              : (
                                <span className={contactClass}>
                                  {dagContact === 0 ? 'Vandaag' : dagContact === 1 ? 'Gisteren' : `${dagContact}d geleden`}
                                </span>
                              )
                            }
                          </td>

                          {/* Laatste evaluatie */}
                          <td className="ml-td">
                            {lid.laatste_evaluatie === null
                              ? <span className="ml-never">Nog nooit</span>
                              : (
                                <span className={evalClass}>
                                  {dagEval === 0 ? 'Vandaag' : dagEval === 1 ? 'Gisteren' : `${dagEval}d geleden`}
                                </span>
                              )
                            }
                          </td>

                          {/* Startdatum */}
                          <td className="ml-td">
                            <span style={{ color: '#3a3a3a', fontSize: '0.72rem' }}>{formatDate(lid.startdatum)}</span>
                          </td>

                          {/* Open acties */}
                          <td className="ml-td" style={{ textAlign: 'right' }}>
                            {lid.open_acties > 0
                              ? <span className="ml-acties-badge">{lid.open_acties}</span>
                              : <span style={{ color: '#2a2a2a' }}>—</span>
                            }
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
