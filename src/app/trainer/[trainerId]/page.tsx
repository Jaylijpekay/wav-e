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
  lid_uuid: string | null
  lid_id: string
  voornaam: string
  achternaam: string
  omschrijving: string
  aangemaakt: string
  is_management: boolean
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

const STOPLIGHT = {
  red:   { dot: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.2)',   text: '#f87171' },
  amber: { dot: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)',   text: '#fbbf24' },
  green: { dot: '#16a34a', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.2)',   text: '#4ade80' },
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
        .from('trainers').select('id, naam').eq('id', trainerId).single()
      setTrainer(trainerData)

      const { data: ledenData } = await supabase
        .from('leden').select('id, lid_id, voornaam, achternaam')
        .eq('trainer_id', trainerId).eq('actief', true).order('voornaam')

      if (!ledenData || ledenData.length === 0) { setLoading(false); return }
      setLedenDropdown(ledenData)

      const lidIds = ledenData.map(l => l.id)

      const [
        { data: contacten },
        { data: evaluaties },
        { data: actiesData },
        { data: trainerActies },
      ] = await Promise.all([
        supabase.from('contact_momenten').select('lid_id, datum').in('lid_id', lidIds).order('datum', { ascending: false }),
        supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').in('lid_id', lidIds).order('cyclus', { ascending: false }),
        supabase.from('acties').select('id, lid_id, omschrijving, aangemaakt').in('lid_id', lidIds).eq('status', 'open').order('aangemaakt', { ascending: true }),
        supabase.from('acties').select('id, lid_id, omschrijving, aangemaakt').eq('trainer_id', trainerId as string).is('lid_id', null).eq('status', 'open').order('aangemaakt', { ascending: true }),
      ])

      const openActiesPerLid: Record<string, number> = {}
      for (const a of actiesData ?? []) openActiesPerLid[a.lid_id] = (openActiesPerLid[a.lid_id] ?? 0) + 1

      const enrichedLeden: Lid[] = ledenData.map(l => {
        const lastContact = contacten?.find(c => c.lid_id === l.id)
        const lastEval = evaluaties?.find(e => e.lid_id === l.id)
        return {
          id: l.id, lid_id: l.lid_id, voornaam: l.voornaam, achternaam: l.achternaam,
          laatste_contact: lastContact?.datum ?? null,
          laatste_evaluatie: lastEval?.datum ?? null,
          slaap: lastEval?.slaap ?? null,
          energie: lastEval?.energie ?? null,
          stress: lastEval?.stress ?? null,
          open_acties: openActiesPerLid[l.id] ?? 0,
        }
      })

      setLeden(enrichedLeden)

      const memberActies: Actie[] = (actiesData ?? []).map(a => {
        const lid = ledenData.find(l => l.id === a.lid_id)
        return {
          id: a.id, lid_uuid: a.lid_id, lid_id: lid?.lid_id ?? '—',
          voornaam: lid?.voornaam ?? '—', achternaam: lid?.achternaam ?? '',
          omschrijving: a.omschrijving, aangemaakt: a.aangemaakt,
          is_management: false,
        }
      })

      const mgmtActies: Actie[] = (trainerActies ?? []).map(a => ({
        id: a.id, lid_uuid: null, lid_id: '',
        voornaam: 'Management', achternaam: '',
        omschrijving: a.omschrijving, aangemaakt: a.aangemaakt,
        is_management: true,
      }))

      setActies([...mgmtActies, ...memberActies])
      setLoading(false)
    }
    if (trainerId) load()
  }, [trainerId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gesprekRef.current && !gesprekRef.current.contains(e.target as Node)) setGesprekOpen(false)
      if (stoplightRef.current && !stoplightRef.current.contains(e.target as Node)) setOpenStoplight(null)
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

  const ledenByStoplight = (sig: 'red' | 'amber') => leden.filter(l => getStoplight(l) === sig)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .td-root {
          min-height: 100vh;
          background: #111;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          position: relative;
        }

        .td-root::before {
          content: '';
          position: fixed;
          top: -20%;
          right: -10%;
          width: 55%;
          height: 55%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.05) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Header ── */
        .td-header {
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
          padding: 0 2rem;
        }

        .td-header-inner {
          max-width: 1100px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .td-wordmark {
          display: flex;
          align-items: baseline;
          gap: 0;
          cursor: pointer;
          text-decoration: none;
        }
        .td-wordmark-wav  { font-size: 1.1rem; font-weight: 700; color: #5A5A5A; letter-spacing: -0.01em; }
        .td-wordmark-e    { font-size: 1.1rem; font-weight: 700; color: #A8C800; letter-spacing: -0.01em; }

        .td-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .td-trainer-name {
          font-size: 0.75rem;
          font-weight: 500;
          color: #3a3a3a;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-right: 4px;
        }

        .td-btn-secondary {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 7px 14px;
          border-radius: 3px;
          border: 1px solid #2a2a2a;
          background: transparent;
          color: #666;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .td-btn-secondary:hover {
          border-color: rgba(168,200,0,0.4);
          color: #A8C800;
          background: rgba(168,200,0,0.06);
        }

        .td-btn-primary {
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
        .td-btn-primary:hover {
          background: #95B400;
          box-shadow: 0 4px 14px rgba(168,200,0,0.3);
          transform: translateY(-1px);
        }

        /* ── Dropdown ── */
        .td-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: #161616;
          border: 1px solid #2a2a2a;
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
          padding: 11px 16px;
          cursor: pointer;
          border-bottom: 1px solid #1e1e1e;
          transition: background 0.1s;
        }
        .td-dropdown-item:last-child { border-bottom: none; }
        .td-dropdown-item:hover { background: rgba(168,200,0,0.06); }

        .td-dropdown-name { font-size: 0.85rem; color: #c8c6c0; font-weight: 500; }
        .td-dropdown-meta { font-size: 0.72rem; color: #3a3a3a; letter-spacing: 0.05em; }
        .td-dropdown-empty { padding: 16px; font-size: 0.8rem; color: #3a3a3a; text-align: center; }

        /* ── Body ── */
        .td-body {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2.5rem 2rem 6rem;
          position: relative;
          z-index: 1;
        }

        /* ── Stoplight bar ── */
        .td-summary-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 2.5rem;
          flex-wrap: wrap;
          align-items: flex-start;
          animation: fadeUp 0.4s ease-out both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .td-summary-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 3px;
          font-family: 'Raleway', sans-serif;
          transition: all 0.2s ease;
          border: 1px solid #1e1e1e;
          background: #141414;
        }

        .td-summary-card.clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }

        .td-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .td-summary-count {
          font-size: 1.2rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .td-summary-label {
          font-size: 0.7rem;
          color: #3a3a3a;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 500;
        }

        .td-summary-chevron {
          font-size: 0.6rem;
          color: #2a2a2a;
          margin-left: 2px;
        }

        .td-summary-total {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          margin-left: auto;
        }

        /* ── Section header ── */
        .td-section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 1rem;
          animation: fadeUp 0.4s ease-out 0.1s both;
        }

        .td-section-title {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #3a3a3a;
        }

        .td-section-count {
          font-size: 0.65rem;
          color: #2a2a2a;
          background: #1a1a1a;
          padding: 2px 7px;
          border-radius: 2px;
          font-weight: 600;
        }

        /* ── Acties list ── */
        .td-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          overflow: hidden;
          animation: fadeUp 0.4s ease-out 0.15s both;
        }

        .td-row {
          display: flex;
          align-items: center;
          gap: 2rem;
          padding: 16px 20px;
          background: #141414;
          border-left: 3px solid transparent;
          cursor: pointer;
          transition: background 0.15s;
        }

        .td-row:hover { background: #181818; }
        .td-row.no-nav { cursor: default; }

        .td-row-main { min-width: 190px; flex: 0 0 190px; }
        .td-row-name { font-size: 0.875rem; font-weight: 600; color: #c8c6c0; margin-bottom: 3px; }
        .td-row-lid-id { font-size: 0.7rem; color: #3a3a3a; letter-spacing: 0.05em; }
        .td-row-actie { flex: 1; font-size: 0.82rem; color: #555; }
        .td-row-dagen { font-size: 0.75rem; font-variant-numeric: tabular-nums; flex: 0 0 36px; text-align: right; font-weight: 600; }

        /* Management actie badge */
        .td-mgmt-badge {
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #818cf8;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 2px;
          padding: 2px 6px;
          margin-top: 3px;
          display: inline-block;
        }

        .td-empty {
          color: #2a2a2a;
          font-size: 0.85rem;
          padding: 4rem 0;
          text-align: center;
          letter-spacing: 0.05em;
        }

        /* Stoplight dropdown panel */
        .td-stoplight-panel {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          background: #161616;
          border: 1px solid #2a2a2a;
          border-radius: 4px;
          min-width: 220px;
          z-index: 200;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          animation: dropIn 0.15s ease-out both;
        }
      `}</style>

      <div className="td-root">
        {/* Header */}
        <header className="td-header">
          <div className="td-header-inner">
            <div className="td-wordmark" onClick={() => router.push('/')}>
              <span className="td-wordmark-wav">wav-e</span>
              <span className="td-wordmark-e"> studios</span>
            </div>

            <div className="td-header-right">
              {trainer?.naam && (
                <span className="td-trainer-name">{trainer.naam}</span>
              )}
              <button
                className="td-btn-secondary"
                onClick={() => router.push(`/trainer/${trainerId}/leden`)}
              >
                Mijn leden
              </button>

              <div style={{ position: 'relative' }} ref={gesprekRef}>
                <button className="td-btn-primary" onClick={() => setGesprekOpen(o => !o)}>
                  + Nieuw gesprek
                </button>
                {gesprekOpen && (
                  <div className="td-dropdown">
                    {ledenDropdown.length === 0
                      ? <div className="td-dropdown-empty">Geen leden gevonden</div>
                      : ledenDropdown.map(lid => (
                        <div key={lid.id} className="td-dropdown-item" onClick={() => handleGesprekSelect(lid)}>
                          <span className="td-dropdown-name">{lid.voornaam} {lid.achternaam}</span>
                          <span className="td-dropdown-meta">{lid.lid_id}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="td-body">
          {/* Stoplight summary bar */}
          {!loading && (
            <div className="td-summary-bar" ref={stoplightRef}>
              {(['red', 'amber'] as const).map(sig => {
                const col = STOPLIGHT[sig]
                const labels = { red: 'Aandacht nodig', amber: 'Let op' }
                const isOpen = openStoplight === sig
                const members = ledenByStoplight(sig)
                const isClickable = counts[sig] > 0

                return (
                  <div key={sig} style={{ position: 'relative' }}>
                    <button
                      className={`td-summary-card${isClickable ? ' clickable' : ''}`}
                      style={{
                        background: isOpen ? col.bg : '#141414',
                        borderColor: isOpen ? col.border : '#1e1e1e',
                        cursor: isClickable ? 'pointer' : 'default',
                      }}
                      onClick={() => isClickable && setOpenStoplight(isOpen ? null : sig)}
                    >
                      <span className="td-dot" style={{ background: col.dot }} />
                      <span className="td-summary-count" style={{ color: col.text }}>{counts[sig]}</span>
                      <span className="td-summary-label">{labels[sig]}</span>
                      {isClickable && (
                        <span className="td-summary-chevron">{isOpen ? '▲' : '▼'}</span>
                      )}
                    </button>

                    {isOpen && members.length > 0 && (
                      <div className="td-stoplight-panel">
                        {members.map(lid => (
                          <div
                            key={lid.id}
                            className="td-dropdown-item"
                            onClick={() => { setOpenStoplight(null); router.push(`/leden/${lid.id}`) }}
                          >
                            <span className="td-dropdown-name">{lid.voornaam} {lid.achternaam}</span>
                            <span className="td-dropdown-meta" style={{ color: col.text }}>{lid.lid_id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Green — not clickable */}
              <button className="td-summary-card" style={{ cursor: 'default' }}>
                <span className="td-dot" style={{ background: STOPLIGHT.green.dot }} />
                <span className="td-summary-count" style={{ color: STOPLIGHT.green.text }}>{counts.green}</span>
                <span className="td-summary-label">Op koers</span>
              </button>

              <div className="td-summary-total">
                <span className="td-summary-count" style={{ color: '#3a3a3a' }}>{leden.length}</span>
                <span className="td-summary-label">Actieve leden</span>
              </div>
            </div>
          )}

          {/* Open acties */}
          <div className="td-section-header">
            <span className="td-section-title">Open acties</span>
            <span className="td-section-count">{acties.length}</span>
          </div>

          {loading ? (
            <div className="td-empty">Laden…</div>
          ) : acties.length === 0 ? (
            <div className="td-empty">Geen open acties.</div>
          ) : (() => {
            // Split management vs member acties
            const mgmt   = acties.filter(a => a.is_management)
            const member = acties.filter(a => !a.is_management)

            // Group member acties by lid_uuid, preserving stoplight order (red → amber → green)
            const lidOrder = leden
              .slice()
              .sort((a, b) => {
                const order = { red: 0, amber: 1, green: 2 }
                return order[getStoplight(a)] - order[getStoplight(b)]
              })
              .map(l => l.id)

            const groups: Record<string, Actie[]> = {}
            for (const a of member) {
              if (!a.lid_uuid) continue
              if (!groups[a.lid_uuid]) groups[a.lid_uuid] = []
              groups[a.lid_uuid].push(a)
            }

            const sortedLidIds = Object.keys(groups).sort(
              (a, b) => lidOrder.indexOf(a) - lidOrder.indexOf(b)
            )

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* Management group */}
                {mgmt.length > 0 && (
                  <div className="td-list">
                    <div style={{ padding: '8px 20px 6px', background: '#111', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 3, height: 12, background: '#6366f1', borderRadius: 2, display: 'inline-block' }} />
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#818cf8' }}>Management</span>
                      <span style={{ fontSize: '0.6rem', color: '#2a2a2a', marginLeft: 2 }}>{mgmt.length}</span>
                    </div>
                    {mgmt.map(actie => {
                      const dagen = daysSince(actie.aangemaakt)
                      const isOud = dagen !== null && dagen > 7
                      return (
                        <div key={actie.id} className="td-row no-nav" style={{ borderLeftColor: '#6366f1' }}>
                          <div className="td-row-actie" style={{ color: '#888' }}>{actie.omschrijving}</div>
                          <div className="td-row-dagen" style={{ color: isOud ? '#dc2626' : '#3a3a3a' }}>
                            {dagen === null ? '—' : `${dagen}d`}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Per-lid groups */}
                {sortedLidIds.map(lidUuid => {
                  const lidActies = groups[lidUuid]
                  const lid = leden.find(l => l.id === lidUuid)
                  const sig = lid ? getStoplight(lid) : 'green'
                  const col = STOPLIGHT[sig]

                  return (
                    <div key={lidUuid} className="td-list">
                      {/* Group header — clickable → member page */}
                      <div
                        style={{ padding: '8px 20px 6px', background: '#111', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onClick={() => router.push(`/leden/${lidUuid}`)}
                      >
                        <span style={{ width: 3, height: 12, background: col.dot, borderRadius: 2, display: 'inline-block' }} />
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: col.text }}>
                          {lid ? `${lid.voornaam} ${lid.achternaam}` : '—'}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: '#2a2a2a', marginLeft: 2 }}>{lidActies.length}</span>
                        <span style={{ fontSize: '0.6rem', color: '#2a2a2a', marginLeft: 'auto', letterSpacing: '0.06em' }}>
                          {lid?.lid_id}
                        </span>
                      </div>

                      {/* Acties under this lid */}
                      {lidActies.map(actie => {
                        const dagen = daysSince(actie.aangemaakt)
                        const isOud = dagen !== null && dagen > 7
                        return (
                          <div
                            key={actie.id}
                            className="td-row"
                            style={{ borderLeftColor: col.dot }}
                            onClick={() => router.push(`/leden/${lidUuid}`)}
                          >
                            <div className="td-row-actie">{actie.omschrijving}</div>
                            <div className="td-row-dagen" style={{ color: isOud ? '#dc2626' : '#3a3a3a' }}>
                              {dagen === null ? '—' : `${dagen}d`}
                            </div>
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
