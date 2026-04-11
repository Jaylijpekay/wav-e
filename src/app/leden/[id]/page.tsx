'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Navigation from '@/app/components/Navigation'

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

const buildHealthSignals = (ev: Evaluatie | null): HealthSignal[] => {
  const make = (key: string, label: string, value: number | null, unit: string, inverted: boolean): HealthSignal => {
    if (value === null) return { key, label, value, unit, status: 'empty', reden: 'Nog niet gemeten', inverted }
    const bad = inverted ? value > 7 : value < 6
    const warn = inverted ? value > 5 : value < 7
    const status = bad ? 'red' : warn ? 'amber' : 'green'
    const reden = bad ? (inverted ? 'Boven drempelwaarde' : 'Onder drempelwaarde') : warn ? 'Dicht bij drempelwaarde' : 'Goed'
    return { key, label, value, unit, status, reden, inverted }
  }
  return [
    make('slaap',   'Slaap',   ev?.slaap   ?? null, '/10', false),
    make('energie', 'Energie', ev?.energie ?? null, '/10', false),
    make('stress',  'Stress',  ev?.stress  ?? null, '/10', true),
  ]
}

const HEALTH = {
  red:   { bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)',  dot: '#dc2626', text: '#f87171', dim: '#7f1d1d' },
  amber: { bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.18)', dot: '#d97706', text: '#fbbf24', dim: '#78350f' },
  green: { bg: 'rgba(22,163,74,0.07)', border: 'rgba(22,163,74,0.18)', dot: '#16a34a', text: '#4ade80', dim: '#14532d' },
  empty: { bg: '#141414',              border: '#1e1e1e',               dot: '#2a2a2a', text: '#333',    dim: '#1a1a1a' },
}

const scoreColor = (score: number | null, inverted = false): string => {
  if (score === null) return '#2a2a2a'
  const bad = inverted ? score > 7 : score < 6
  const ok  = inverted ? score <= 5 : score > 7
  if (bad) return '#ef4444'
  if (ok)  return '#22c55e'
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
      const { data: lidData } = await supabase.from('leden').select('id, lid_id, voornaam, achternaam, email, telefoon, geboortedatum, startdatum, actief').eq('id', id).single()
      setLid(lidData)
      const { data: evalData } = await supabase.from('evaluaties').select('id, cyclus, datum, slaap, energie, stress, gewicht_kg, vetpercentage').eq('lid_id', id).order('cyclus', { ascending: false })
      setEvaluaties(evalData ?? [])
      const { data: contactData } = await supabase.from('contact_momenten').select('id, datum, type, notities').eq('lid_id', id).order('datum', { ascending: false })
      setContacten(contactData ?? [])
      const { data: actiesData } = await supabase.from('acties').select('id, omschrijving, status, aangemaakt, deadline').eq('lid_id', id).eq('status', 'open').order('aangemaakt', { ascending: true })
      setActies(actiesData ?? [])
      setLoading(false)
    }
    if (id) load()
  }, [id])

  const markActieAfgerond = async (actieId: string) => {
    const supabase = getSupabase()
    const { error } = await supabase.from('acties').update({ status: 'afgerond', afgerond: true, afgerond_op: new Date().toISOString() }).eq('id', actieId).select()
    if (!error) setActies(prev => prev.filter(a => a.id !== actieId))
  }

  const logContact = async () => {
    if (!lid) return
    setSavingContact(true)
    const supabase = getSupabase()
    await supabase.from('contact_momenten').insert({ lid_id: lid.id, datum: contactDatum, type: contactType, notities: contactNotities || null })
    const { data: fresh } = await supabase.from('contact_momenten').select('id, datum, type, notities').eq('lid_id', lid.id).order('datum', { ascending: false })
    setContacten(fresh ?? [])
    setContactOpen(false)
    setContactNotities('')
    setSavingContact(false)
  }

  const latestEval = evaluaties[0] ?? null
  const healthSignals = buildHealthSignals(latestEval)
  const lastContactDays = daysSince(contacten[0]?.datum ?? null)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Raleway', sans-serif", color: '#2a2a2a', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
      Laden…
    </div>
  )

  if (!lid) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Raleway', sans-serif", color: '#2a2a2a', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
      Lid niet gevonden.
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .ld-root {
          min-height: 100vh;
          background: #111;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          position: relative;
        }

        .ld-root::before {
          content: '';
          position: fixed;
          bottom: -20%;
          left: -10%;
          width: 50%;
          height: 50%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.04) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Header */
        .ld-header {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 52px;
          display: flex;
          align-items: center;
          padding: 0 2rem;
          background: rgba(17,17,17,0.92);
          border-bottom: 1px solid rgba(168,200,0,0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .ld-header-inner {
          max-width: 1140px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ld-back {
          background: none;
          border: none;
          color: #3a3a3a;
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }
        .ld-back:hover { color: #A8C800; }

        .ld-header-actions { display: flex; gap: 10px; align-items: center; }

        .ld-btn-ghost {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 14px;
          border-radius: 3px;
          border: 1px solid #1e1e1e;
          background: transparent;
          color: #3a3a3a;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .ld-btn-ghost:hover { border-color: rgba(168,200,0,0.3); color: #A8C800; }

        .ld-btn-primary {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 14px;
          border-radius: 3px;
          border: 1px solid #A8C800;
          background: #A8C800;
          color: #111;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s, transform 0.15s;
        }
        .ld-btn-primary:hover {
          background: #95B400;
          box-shadow: 0 4px 14px rgba(168,200,0,0.3);
          transform: translateY(-1px);
        }
        .ld-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* Body */
        .ld-body {
          max-width: 1140px;
          margin: 0 auto;
          padding: 2.5rem 2rem 6rem;
          position: relative;
          z-index: 1;
        }

        /* Identity */
        .ld-identity {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 3rem;
          gap: 24px;
          animation: ldFadeUp 0.4s ease-out both;
        }

        .ld-identity-left { display: flex; align-items: flex-start; gap: 18px; }

        .ld-avatar {
          width: 48px;
          height: 48px;
          border-radius: 3px;
          background: #1a1a1a;
          border: 1px solid #222;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 700;
          color: #A8C800;
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }

        .ld-member-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #e8e6e0;
          margin: 0 0 10px;
          letter-spacing: -0.02em;
        }

        .ld-meta-tags { display: flex; flex-wrap: wrap; gap: 6px; }

        .ld-meta-tag {
          font-size: 0.65rem;
          font-weight: 500;
          color: #3a3a3a;
          border: 1px solid #1e1e1e;
          border-radius: 2px;
          padding: 3px 8px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .ld-meta-tag-warn  { color: #d97706; border-color: rgba(217,119,6,0.25); }
        .ld-meta-tag-alert { color: #dc2626; border-color: rgba(220,38,38,0.25); }

        .ld-identity-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
        .ld-contact-link { font-size: 0.75rem; color: #2a2a2a; text-decoration: none; letter-spacing: 0.03em; transition: color 0.15s; }
        .ld-contact-link:hover { color: #A8C800; }

        /* Grid */
        .ld-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 2.5rem;
          align-items: flex-start;
        }

        .ld-col { display: flex; flex-direction: column; gap: 2.5rem; }

        /* Section */
        .ld-section { display: flex; flex-direction: column; gap: 3px; animation: ldFadeUp 0.4s ease-out 0.08s both; }

        .ld-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #181818;
        }

        .ld-section-label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #2a2a2a;
        }

        .ld-section-badge {
          font-size: 0.65rem;
          color: #222;
          background: #161616;
          padding: 2px 7px;
          border-radius: 2px;
          font-weight: 600;
        }

        .ld-section-meta { font-size: 0.65rem; color: #2a2a2a; letter-spacing: 0.04em; }

        .ld-section-action {
          background: none;
          border: none;
          color: #2a2a2a;
          font-family: 'Raleway', sans-serif;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }
        .ld-section-action:hover { color: #A8C800; }

        /* Empty state */
        .ld-empty {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 0;
          color: #1e1e1e;
          font-size: 0.8rem;
          letter-spacing: 0.04em;
        }

        /* Table wrapper — bordered, sharp */
        .ld-table-block {
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          overflow: hidden;
        }

        /* Eval rows */
        .ld-eval-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 13px 16px;
          background: #141414;
          border-bottom: 1px solid #1a1a1a;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ld-eval-row:last-child { border-bottom: none; }
        .ld-eval-row:hover { background: #181818; }

        .ld-eval-left { flex: 1; }
        .ld-eval-cyclus { font-size: 0.85rem; font-weight: 600; color: #c8c6c0; margin-bottom: 2px; }
        .ld-eval-datum  { font-size: 0.7rem; color: #2a2a2a; letter-spacing: 0.04em; }

        .ld-eval-scores { display: flex; gap: 14px; }
        .ld-eval-score  { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .ld-eval-score-label { font-size: 0.55rem; color: #222; letter-spacing: 0.1em; font-weight: 600; text-transform: uppercase; }
        .ld-eval-score-val   { font-size: 0.9rem; font-weight: 700; font-variant-numeric: tabular-nums; }
        .ld-eval-arrow { font-size: 1.1rem; color: #1e1e1e; }

        /* Contact rows */
        .ld-contact-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 4px 12px;
          padding: 12px 16px;
          background: #141414;
          border-bottom: 1px solid #1a1a1a;
        }
        .ld-contact-row:last-child { border-bottom: none; }
        .ld-contact-type  { font-size: 0.82rem; font-weight: 500; color: #c8c6c0; text-transform: capitalize; }
        .ld-contact-datum { font-size: 0.7rem; color: #2a2a2a; letter-spacing: 0.04em; text-align: right; }
        .ld-contact-note  { font-size: 0.75rem; color: #3a3a3a; grid-column: 1 / -1; margin-top: 2px; letter-spacing: 0.02em; }

        /* Form card */
        .ld-form-card {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          padding: 16px;
          margin-bottom: 3px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: ldFadeUp 0.2s ease-out both;
        }

        .ld-form-row   { display: flex; flex-direction: column; gap: 5px; }
        .ld-form-label { font-size: 0.6rem; font-weight: 600; color: #2a2a2a; letter-spacing: 0.14em; text-transform: uppercase; }

        .ld-input {
          background: #0d0d0d;
          border: 1px solid #1e1e1e;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          font-size: 0.85rem;
          font-weight: 400;
          padding: 8px 12px;
          border-radius: 3px;
          width: 100%;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ld-input:focus {
          border-color: #A8C800;
          box-shadow: 0 0 0 3px rgba(168,200,0,0.08);
        }

        /* Health grid */
        .ld-health-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .ld-health-card {
          border-radius: 3px;
          border: 1px solid;
          padding: 14px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .ld-health-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }

        .ld-health-card-top { display: flex; align-items: center; gap: 7px; }
        .ld-health-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .ld-health-label { font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 600; }
        .ld-health-value-row { display: flex; align-items: baseline; gap: 3px; }
        .ld-health-value { font-size: 1.75rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
        .ld-health-unit  { font-size: 0.7rem; font-weight: 400; }
        .ld-health-reden { font-size: 0.6rem; letter-spacing: 0.04em; line-height: 1.4; }
        .ld-health-empty-note { font-size: 0.65rem; color: #1e1e1e; letter-spacing: 0.04em; padding: 10px 0 4px; text-align: center; }

        /* Acties */
        .ld-actie-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 16px;
          background: #141414;
          border-bottom: 1px solid #1a1a1a;
          border-left: 3px solid transparent;
          transition: background 0.15s;
        }
        .ld-actie-row:last-child { border-bottom: none; }
        .ld-actie-row:hover { background: #181818; }

        .ld-actie-content { flex: 1; }
        .ld-actie-name { font-size: 0.82rem; font-weight: 500; color: #c8c6c0; margin-bottom: 3px; }
        .ld-actie-meta { font-size: 0.68rem; color: #2a2a2a; letter-spacing: 0.03em; }

        .ld-done-btn {
          background: transparent;
          border: 1px solid #1e1e1e;
          color: #2a2a2a;
          font-family: 'Raleway', sans-serif;
          font-size: 0.75rem;
          width: 28px;
          height: 28px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .ld-done-btn:hover {
          border-color: rgba(22,163,74,0.4);
          color: #16a34a;
          background: rgba(22,163,74,0.06);
        }

        @keyframes ldFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="ld-root">
        {/* Header */}
        <header className="ld-header">
          <div className="ld-header-inner">
            <button className="ld-back" onClick={() => router.back()}>← terug</button>
            <div className="ld-header-actions">
              <button className="ld-btn-ghost" onClick={() => router.push(`/leden/${id}/vooruitgang`)}>
                Vooruitgang
              </button>
              <button className="ld-btn-primary" onClick={() => router.push(`/gesprek/new?lid_id=${lid.id}`)}>
                + Nieuw gesprek
              </button>
            </div>
          </div>
        </header>

        <div className="ld-body">

          {/* Identity */}
          <div className="ld-identity">
            <div className="ld-identity-left">
              <div className="ld-avatar">{lid.voornaam[0]}{lid.achternaam[0]}</div>
              <div>
                <h1 className="ld-member-name">{lid.voornaam} {lid.achternaam}</h1>
                <div className="ld-meta-tags">
                  <span className="ld-meta-tag">{lid.lid_id}</span>
                  {lid.startdatum && <span className="ld-meta-tag">lid sinds {formatDate(lid.startdatum)}</span>}
                  {!lid.actief && <span className="ld-meta-tag ld-meta-tag-alert">inactief</span>}
                  {lastContactDays !== null
                    ? <span className={`ld-meta-tag${lastContactDays > 14 ? ' ld-meta-tag-warn' : ''}`}>contact {lastContactDays}d geleden</span>
                    : <span className="ld-meta-tag ld-meta-tag-alert">nog geen contact</span>
                  }
                </div>
              </div>
            </div>
            <div className="ld-identity-right">
              {lid.email    && <a href={`mailto:${lid.email}`}    className="ld-contact-link">{lid.email}</a>}
              {lid.telefoon && <a href={`tel:${lid.telefoon}`}    className="ld-contact-link">{lid.telefoon}</a>}
            </div>
          </div>

          {/* Main grid */}
          <div className="ld-grid">

            {/* Left column */}
            <div className="ld-col">

              {/* Evaluaties */}
              <section className="ld-section">
                <div className="ld-section-head">
                  <span className="ld-section-label">Evaluaties</span>
                  <span className="ld-section-badge">{evaluaties.length}</span>
                </div>
                {evaluaties.length === 0
                  ? <div className="ld-empty"><span>○</span><span>Nog geen evaluaties</span></div>
                  : (
                    <div className="ld-table-block">
                      {evaluaties.map(ev => (
                        <div key={ev.id} className="ld-eval-row" onClick={() => router.push(`/leden/${id}/evaluatie/${ev.cyclus}`)}>
                          <div className="ld-eval-left">
                            <div className="ld-eval-cyclus">Cyclus {ev.cyclus}</div>
                            <div className="ld-eval-datum">{formatDate(ev.datum)}</div>
                          </div>
                          <div className="ld-eval-scores">
                            {[
                              { label: 'S',  val: ev.slaap,   inv: false },
                              { label: 'E',  val: ev.energie, inv: false },
                              { label: 'ST', val: ev.stress,  inv: true  },
                            ].map(({ label, val, inv }) => (
                              <div key={label} className="ld-eval-score">
                                <span className="ld-eval-score-label">{label}</span>
                                <span className="ld-eval-score-val" style={{ color: scoreColor(val, inv) }}>{val ?? '—'}</span>
                              </div>
                            ))}
                            {ev.gewicht_kg && (
                              <div className="ld-eval-score">
                                <span className="ld-eval-score-label">KG</span>
                                <span className="ld-eval-score-val" style={{ color: '#555' }}>{ev.gewicht_kg}</span>
                              </div>
                            )}
                          </div>
                          <span className="ld-eval-arrow">›</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </section>

              {/* Contact momenten */}
              <section className="ld-section">
                <div className="ld-section-head">
                  <span className="ld-section-label">Contact</span>
                  <button className="ld-section-action" onClick={() => setContactOpen(o => !o)}>
                    {contactOpen ? '× annuleren' : '+ log contact'}
                  </button>
                </div>

                {contactOpen && (
                  <div className="ld-form-card">
                    <div className="ld-form-row">
                      <label className="ld-form-label">Datum</label>
                      <input type="date" value={contactDatum} onChange={e => setContactDatum(e.target.value)} className="ld-input" />
                    </div>
                    <div className="ld-form-row">
                      <label className="ld-form-label">Type</label>
                      <select value={contactType} onChange={e => setContactType(e.target.value)} className="ld-input">
                        <option value="check-in">Check-in</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="telefoon">Telefoon</option>
                        <option value="sessie">Sessie</option>
                        <option value="anders">Anders</option>
                      </select>
                    </div>
                    <div className="ld-form-row">
                      <label className="ld-form-label">Notities</label>
                      <textarea
                        value={contactNotities}
                        onChange={e => setContactNotities(e.target.value)}
                        placeholder="Optioneel…"
                        className="ld-input"
                        style={{ height: 80, resize: 'vertical' }}
                      />
                    </div>
                    <button className="ld-btn-primary" onClick={logContact} disabled={savingContact}>
                      {savingContact ? 'Opslaan…' : 'Opslaan'}
                    </button>
                  </div>
                )}

                {contacten.length === 0 && !contactOpen
                  ? <div className="ld-empty"><span>○</span><span>Nog geen contactmomenten</span></div>
                  : contacten.length > 0 && (
                    <div className="ld-table-block">
                      {contacten.map(c => (
                        <div key={c.id} className="ld-contact-row">
                          <div className="ld-contact-type">{c.type ?? 'Contact'}</div>
                          <div className="ld-contact-datum">{formatDate(c.datum)}</div>
                          {c.notities && <div className="ld-contact-note">{c.notities}</div>}
                        </div>
                      ))}
                    </div>
                  )
                }
              </section>
            </div>

            {/* Right column */}
            <div className="ld-col">

              {/* Health signals */}
              <section className="ld-section">
                <div className="ld-section-head">
                  <span className="ld-section-label">Gezondheid</span>
                  {latestEval
                    ? <span className="ld-section-meta">cyclus {latestEval.cyclus} · {formatDate(latestEval.datum)}</span>
                    : <span className="ld-section-meta" style={{ color: '#1e1e1e' }}>geen data</span>
                  }
                </div>
                <div className="ld-health-grid">
                  {healthSignals.map(sig => {
                    const col = HEALTH[sig.status]
                    return (
                      <div
                        key={sig.key}
                        className="ld-health-card"
                        style={{ background: col.bg, borderColor: col.border }}
                      >
                        <div className="ld-health-card-top">
                          <span className="ld-health-dot" style={{ background: col.dot }} />
                          <span className="ld-health-label" style={{ color: sig.status === 'empty' ? '#222' : '#666' }}>{sig.label}</span>
                        </div>
                        <div className="ld-health-value-row">
                          <span className="ld-health-value" style={{ color: col.text }}>{sig.value ?? '—'}</span>
                          <span className="ld-health-unit" style={{ color: col.dim }}>{sig.value !== null ? sig.unit : ''}</span>
                        </div>
                        <div className="ld-health-reden" style={{ color: col.dim }}>{sig.reden}</div>
                      </div>
                    )
                  })}
                </div>
                {!latestEval && <div className="ld-health-empty-note">Scores verschijnen na het eerste evaluatiegesprek</div>}
              </section>

              {/* Open acties */}
              <section className="ld-section">
                <div className="ld-section-head">
                  <span className="ld-section-label">Open acties</span>
                  <span className="ld-section-badge">{acties.length}</span>
                </div>
                {acties.length === 0
                  ? <div className="ld-empty"><span>✓</span><span>Geen open acties</span></div>
                  : (
                    <div className="ld-table-block">
                      {acties.map(actie => {
                        const isOverdue = actie.deadline && new Date(actie.deadline) < new Date()
                        return (
                          <div
                            key={actie.id}
                            className="ld-actie-row"
                            style={{ borderLeftColor: isOverdue ? '#dc2626' : 'rgba(22,163,74,0.3)' }}
                          >
                            <div className="ld-actie-content">
                              <div className="ld-actie-name">{actie.omschrijving}</div>
                              <div className="ld-actie-meta">
                                {formatDate(actie.aangemaakt)}
                                {actie.deadline && (
                                  <span style={{ color: isOverdue ? '#dc2626' : '#2a2a2a' }}>
                                    {' '}· deadline {formatDate(actie.deadline)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button className="ld-done-btn" onClick={() => markActieAfgerond(actie.id)}>✓</button>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              </section>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
