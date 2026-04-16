'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Evaluatie = {
  id: string
  cyclus: number
  datum: string
  slaap: number | null
  energie: number | null
  stress: number | null
  voeding: number | null
  beweging: number | null
  motivatie: number | null
  tevredenheid: number | null
  gewicht_kg: number | null
  vetpercentage: number | null
  spiermassa_kg: number | null
  visceraal_vet: number | null
  buikomvang_cm: number | null
  doelen_behaald: boolean | null
}

type Lid = {
  voornaam: string
  achternaam: string
  lid_id: string
}

const STOPLIGHT = (key: string, val: number) => {
  if (key === 'stress') return val > 7 ? 'red' : val > 5 ? 'amber' : 'green'
  return val < 6 ? 'red' : val < 7 ? 'amber' : 'green'
}

const COLORS = {
  red:   { thumb: '#dc2626', label: '#f87171', track: 'rgba(220,38,38,0.18)', bg: 'rgba(220,38,38,0.06)' },
  amber: { thumb: '#d97706', label: '#fbbf24', track: 'rgba(217,119,6,0.18)', bg: 'rgba(217,119,6,0.06)' },
  green: { thumb: '#16a34a', label: '#4ade80', track: 'rgba(22,163,74,0.18)', bg: 'rgba(22,163,74,0.06)' },
}

const SLIDERS = [
  { key: 'slaap',        label: 'Slaap',        low: 'Slecht',     high: 'Uitstekend' },
  { key: 'energie',      label: 'Energie',      low: 'Leeg',       high: 'Vol energie' },
  { key: 'stress',       label: 'Stress',       low: 'Geen',       high: 'Extreem' },
  { key: 'voeding',      label: 'Voeding',      low: 'Slecht',     high: 'Zeer goed' },
  { key: 'beweging',     label: 'Beweging',     low: 'Weinig',     high: 'Veel' },
  { key: 'motivatie',    label: 'Motivatie',    low: 'Geen',       high: 'Hoog' },
  { key: 'tevredenheid', label: 'Tevredenheid', low: 'Ontevreden', high: 'Zeer tevreden' },
]

const FYSIEK = [
  { key: 'gewicht_kg',    label: 'Gewicht',      unit: 'kg', lowerIsBetter: false },
  { key: 'vetpercentage', label: 'Vetpercentage', unit: '%',  lowerIsBetter: true  },
  { key: 'spiermassa_kg', label: 'Spiermassa',   unit: 'kg', lowerIsBetter: false },
  { key: 'visceraal_vet', label: 'Visceraal vet', unit: '',  lowerIsBetter: true  },
  { key: 'buikomvang_cm', label: 'Buikomvang',   unit: 'cm', lowerIsBetter: true  },
]

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const delta = (curr: number | null, prev: number | null, lowerIsBetter = false) => {
  if (curr === null || prev === null) return null
  const diff = curr - prev
  if (diff === 0) return null
  const improved = lowerIsBetter ? diff < 0 : diff > 0
  return {
    val: Math.abs(diff),
    sign: diff > 0 ? '+' : '−',
    color: improved ? '#4ade80' : '#f87171',
  }
}

// Mini sparkline: renders a tiny SVG line for a metric across cycles
function Sparkline({ values, isStress = false }: { values: (number | null)[], isStress?: boolean }) {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2) return null

  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const W = 80
  const H = 24
  const pad = 2

  const pts = values
    .map((v, i) => v !== null ? { x: (i / (values.length - 1)) * (W - pad * 2) + pad, y: H - pad - ((v - min) / range) * (H - pad * 2) } : null)
    .filter(Boolean) as { x: number; y: number }[]

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const last = valid[valid.length - 1]
  const prev = valid[valid.length - 2]
  const improved = isStress ? last < prev : last > prev
  const color = last === prev ? '#444' : improved ? '#4ade80' : '#f87171'

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 2.5 : 1.5}
          fill={i === pts.length - 1 ? color : '#333'} />
      ))}
    </svg>
  )
}

export default function VooruitgangPage() {
  const { id } = useParams()
  const router = useRouter()

  const [evals, setEvals] = useState<Evaluatie[]>([])
  const [lid, setLid] = useState<Lid | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'leefstijl' | 'fysiek' | 'overzicht'>('leefstijl')

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()

      const { data: lidData } = await supabase
        .from('leden')
        .select('voornaam, achternaam, lid_id')
        .eq('id', id)
        .single()
      setLid(lidData)

      const { data: evalData } = await supabase
        .from('evaluaties')
        .select('id, cyclus, datum, slaap, energie, stress, voeding, beweging, motivatie, tevredenheid, gewicht_kg, vetpercentage, spiermassa_kg, visceraal_vet, buikomvang_cm, doelen_behaald')
        .eq('lid_id', id)
        .order('cyclus', { ascending: true })
      setEvals(evalData ?? [])

      setLoading(false)
    }
    if (id) load()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A8C800', boxShadow: '0 0 12px rgba(168,200,0,0.5)' }} />
    </div>
  )

  if (!lid) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontFamily: 'Raleway, sans-serif', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
      Lid niet gevonden.
    </div>
  )

  if (evals.length === 0) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#111', color: '#555', fontFamily: 'Raleway, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Geen evaluaties gevonden</span>
        <button onClick={() => router.push(`/leden/${id}`)} style={{ background: 'none', border: 'none', color: '#A8C800', fontFamily: 'Raleway, sans-serif', fontSize: '0.72rem', cursor: 'pointer', letterSpacing: '0.08em' }}>
          ← Terug naar {lid.voornaam}
        </button>
      </div>
    </>
  )

  const latest = evals[evals.length - 1]
  const first = evals[0]
  const hasPrev = evals.length > 1

  // Compute overall trend score for leefstijl: compare latest vs first
  const trendScores = SLIDERS.map(({ key }) => {
    const vals = evals.map(e => e[key as keyof Evaluatie] as number | null)
    const f = vals[0]
    const l = vals[vals.length - 1]
    if (f === null || l === null) return null
    const diff = key === 'stress' ? f - l : l - f // higher = better, except stress
    return diff
  }).filter((v): v is number => v !== null)
  const avgTrend = trendScores.length ? trendScores.reduce((a, b) => a + b, 0) / trendScores.length : 0
  const trendLabel = avgTrend > 0.5 ? 'Verbeterend' : avgTrend < -0.5 ? 'Achteruitgaand' : 'Stabiel'
  const trendColor = avgTrend > 0.5 ? '#4ade80' : avgTrend < -0.5 ? '#f87171' : '#fbbf24'

  const doelen_ja = evals.filter(e => e.doelen_behaald === true).length
  const doelen_total = evals.filter(e => e.doelen_behaald !== null).length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .vg-root {
          min-height: 100vh;
          background: #111;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          position: relative;
        }
        .vg-root::before {
          content: '';
          position: fixed;
          top: -10%;
          right: -10%;
          width: 50%;
          height: 50%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.04) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Header */
        .vg-header {
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
        .vg-header-inner {
          max-width: 900px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .vg-back {
          background: none;
          border: none;
          color: #555;
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }
        .vg-back:hover { color: #A8C800; }
        .vg-header-title {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #B4B4B4;
        }

        /* Body */
        .vg-body {
          max-width: 900px;
          margin: 0 auto;
          padding: 2.5rem 2rem 6rem;
          position: relative;
          z-index: 1;
        }

        /* Identity */
        .vg-name {
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .vg-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 2rem;
        }
        .vg-tag {
          display: inline-block;
          font-size: 0.65rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #555;
          background: #161616;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          padding: 4px 10px;
        }
        .vg-tag-highlight {
          color: #A8C800;
          border-color: rgba(168,200,0,0.2);
          background: rgba(168,200,0,0.06);
        }

        /* Summary cards */
        .vg-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
          margin-bottom: 2rem;
        }
        .vg-summary-card {
          background: #161616;
          border: 1px solid #1e1e1e;
          border-radius: 4px;
          padding: 14px 16px;
        }
        .vg-summary-label {
          font-size: 0.58rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #555;
          margin-bottom: 6px;
        }
        .vg-summary-value {
          font-size: 1.3rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .vg-summary-sub {
          font-size: 0.62rem;
          color: #444;
          margin-top: 2px;
          letter-spacing: 0.04em;
        }

        /* Tab bar */
        .vg-tabs {
          display: flex;
          gap: 2px;
          margin-bottom: 1.75rem;
          background: #161616;
          border: 1px solid #1e1e1e;
          border-radius: 4px;
          padding: 3px;
        }
        .vg-tab {
          flex: 1;
          background: none;
          border: none;
          font-family: 'Raleway', sans-serif;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #444;
          padding: 7px 0;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .vg-tab:hover { color: #888; }
        .vg-tab.active {
          background: #1e1e1e;
          color: #A8C800;
        }

        /* Section label */
        .vg-section-label {
          display: block;
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #555;
          margin-bottom: 12px;
        }

        /* Leefstijl: metric rows */
        .vg-metric-row {
          display: grid;
          grid-template-columns: 90px 1fr auto;
          align-items: center;
          gap: 16px;
          padding: 10px 0;
          border-bottom: 1px solid #161616;
        }
        .vg-metric-row:last-child { border-bottom: none; }
        .vg-metric-name {
          font-size: 0.72rem;
          font-weight: 500;
          color: #888;
          letter-spacing: 0.04em;
        }
        .vg-metric-cycles {
          display: flex;
          align-items: center;
          gap: 4px;
          overflow-x: auto;
        }
        .vg-cycle-dot {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          min-width: 28px;
        }
        .vg-cycle-pip {
          width: 20px;
          height: 20px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.62rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
          text-decoration: none;
        }
        .vg-cycle-pip:hover { opacity: 0.8; }
        .vg-cycle-num {
          font-size: 0.52rem;
          color: #333;
          letter-spacing: 0.04em;
        }
        .vg-metric-sparkline {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .vg-metric-latest {
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .vg-metric-delta {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        /* Fysiek table */
        .vg-fysiek-table {
          width: 100%;
          border-collapse: collapse;
        }
        .vg-fysiek-table th {
          font-size: 0.58rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #444;
          padding: 6px 10px;
          border-bottom: 1px solid #1e1e1e;
          text-align: right;
        }
        .vg-fysiek-table th:first-child { text-align: left; }
        .vg-fysiek-table td {
          font-size: 0.78rem;
          font-weight: 500;
          color: #888;
          padding: 10px 10px;
          border-bottom: 1px solid #161616;
          text-align: right;
        }
        .vg-fysiek-table td:first-child { text-align: left; color: #666; font-size: 0.7rem; letter-spacing: 0.04em; }
        .vg-fysiek-table tr:last-child td { border-bottom: none; }
        .vg-fysiek-val { color: #B4B4B4; font-weight: 700; }
        .vg-fysiek-empty { color: #2a2a2a; }

        /* Overzicht: cycle cards */
        .vg-cycle-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .vg-cycle-card {
          background: #161616;
          border: 1px solid #1e1e1e;
          border-radius: 4px;
          padding: 14px 16px;
          cursor: pointer;
          transition: border-color 0.15s;
          text-decoration: none;
          display: block;
        }
        .vg-cycle-card:hover { border-color: rgba(168,200,0,0.2); }
        .vg-cycle-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .vg-cycle-card-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: #B4B4B4;
          letter-spacing: 0.04em;
        }
        .vg-cycle-card-date {
          font-size: 0.62rem;
          color: #444;
          letter-spacing: 0.04em;
        }
        .vg-cycle-pips {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }
        .vg-ov-pip {
          font-size: 0.58rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 2px;
          letter-spacing: 0.04em;
        }
        .vg-doelen-row {
          margin-top: 8px;
          font-size: 0.62rem;
          color: #444;
          letter-spacing: 0.04em;
        }

        /* Divider */
        .vg-divider {
          height: 1px;
          background: #1a1a1a;
          margin: 2rem 0;
        }

        @keyframes vgFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vg-body > * { animation: vgFadeUp 0.35s ease-out both; }
      `}</style>

      <div className="vg-root">
        <header className="vg-header">
          <div className="vg-header-inner">
            <button className="vg-back" onClick={() => router.push(`/leden/${id}`)}>
              ← {lid.voornaam} {lid.achternaam}
            </button>
            <span className="vg-header-title">Vooruitgang</span>
          </div>
        </header>

        <div className="vg-body">

          {/* Identity */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 className="vg-name">{lid.voornaam} {lid.achternaam}</h1>
            <div className="vg-meta-row">
              <span className="vg-tag vg-tag-highlight">{evals.length} {evals.length === 1 ? 'cyclus' : 'cycli'}</span>
              <span className="vg-tag">{lid.lid_id}</span>
              <span className="vg-tag">Start: {formatDate(first.datum)}</span>
              <span className="vg-tag">Laatste: {formatDate(latest.datum)}</span>
            </div>
          </div>

          {/* Summary cards */}
          {hasPrev && (
            <div className="vg-summary-grid">
              <div className="vg-summary-card">
                <div className="vg-summary-label">Trend leefstijl</div>
                <div className="vg-summary-value" style={{ color: trendColor, fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.02em' }}>{trendLabel}</div>
                <div className="vg-summary-sub">cyclus {first.cyclus} → {latest.cyclus}</div>
              </div>
              <div className="vg-summary-card">
                <div className="vg-summary-label">Doelen behaald</div>
                <div className="vg-summary-value" style={{ color: doelen_ja > 0 ? '#4ade80' : '#555' }}>
                  {doelen_ja}<span style={{ fontSize: '0.75rem', color: '#444', fontWeight: 400 }}>/{doelen_total}</span>
                </div>
                <div className="vg-summary-sub">evaluaties</div>
              </div>
              {latest.gewicht_kg !== null && first.gewicht_kg !== null && (() => {
                const d = latest.gewicht_kg - first.gewicht_kg
                const col = Math.abs(d) < 0.5 ? '#555' : d < 0 ? '#4ade80' : '#fbbf24'
                return (
                  <div className="vg-summary-card">
                    <div className="vg-summary-label">Gewicht Δ</div>
                    <div className="vg-summary-value" style={{ color: col }}>
                      {d > 0 ? '+' : ''}{d.toFixed(1)}<span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 400 }}> kg</span>
                    </div>
                    <div className="vg-summary-sub">{first.gewicht_kg} → {latest.gewicht_kg} kg</div>
                  </div>
                )
              })()}
              {latest.spiermassa_kg !== null && first.spiermassa_kg !== null && (() => {
                const d = latest.spiermassa_kg - first.spiermassa_kg
                const col = Math.abs(d) < 0.3 ? '#555' : d > 0 ? '#4ade80' : '#f87171'
                return (
                  <div className="vg-summary-card">
                    <div className="vg-summary-label">Spiermassa Δ</div>
                    <div className="vg-summary-value" style={{ color: col }}>
                      {d > 0 ? '+' : ''}{d.toFixed(1)}<span style={{ fontSize: '0.65rem', color: '#444', fontWeight: 400 }}> kg</span>
                    </div>
                    <div className="vg-summary-sub">{first.spiermassa_kg} → {latest.spiermassa_kg} kg</div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Tab bar */}
          <div className="vg-tabs">
            {(['leefstijl', 'fysiek', 'overzicht'] as const).map(tab => (
              <button
                key={tab}
                className={`vg-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'leefstijl' ? 'Leefstijl' : tab === 'fysiek' ? 'Fysiek' : 'Cycli'}
              </button>
            ))}
          </div>

          {/* Tab: Leefstijl */}
          {activeTab === 'leefstijl' && (
            <div>
              <span className="vg-section-label">Leefstijl per cyclus</span>
              {SLIDERS.map(({ key, label }) => {
                const values = evals.map(e => e[key as keyof Evaluatie] as number | null)
                const latestVal = values[values.length - 1]
                const prevVal = hasPrev ? values[values.length - 2] : null
                if (values.every(v => v === null)) return null

                const sig = latestVal !== null ? STOPLIGHT(key, latestVal) : 'green'
                const col = COLORS[sig as keyof typeof COLORS]
                const d = delta(latestVal, prevVal, key === 'stress')

                return (
                  <div key={key} className="vg-metric-row">
                    <div className="vg-metric-name">{label}</div>
                    <div className="vg-metric-cycles">
                      {evals.map((ev, i) => {
                        const val = ev[key as keyof Evaluatie] as number | null
                        if (val === null) return (
                          <div key={ev.id} className="vg-cycle-dot">
                            <div className="vg-cycle-pip" style={{ background: '#1a1a1a', color: '#333' }}>—</div>
                            <span className="vg-cycle-num">C{ev.cyclus}</span>
                          </div>
                        )
                        const s = STOPLIGHT(key, val)
                        const c = COLORS[s as keyof typeof COLORS]
                        return (
                          <div key={ev.id} className="vg-cycle-dot">
                            <a
                              href={`/leden/${id}/evaluatie/${ev.cyclus}`}
                              className="vg-cycle-pip"
                              style={{ background: c.bg, color: c.label, border: `1px solid ${c.track}` }}
                              title={`Cyclus ${ev.cyclus}: ${val}`}
                            >
                              {val}
                            </a>
                            <span className="vg-cycle-num">C{ev.cyclus}</span>
                          </div>
                        )
                      })}
                      {values.filter((v): v is number => v !== null).length >= 2 && (
                        <div style={{ marginLeft: 8 }}>
                          <Sparkline values={values} isStress={key === 'stress'} />
                        </div>
                      )}
                    </div>
                    <div className="vg-metric-sparkline">
                      {latestVal !== null && (
                        <span className="vg-metric-latest" style={{ color: col.label }}>{latestVal}</span>
                      )}
                      {d && (
                        <span className="vg-metric-delta" style={{ color: d.color }}>{d.sign}{d.val}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tab: Fysiek */}
          {activeTab === 'fysiek' && (
            <div>
              <span className="vg-section-label">Fysieke metingen per cyclus</span>
              <table className="vg-fysiek-table">
                <thead>
                  <tr>
                    <th>Meting</th>
                    {evals.map(ev => (
                      <th key={ev.id}>C{ev.cyclus}</th>
                    ))}
                    <th>Δ totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {FYSIEK.map(({ key, label, unit, lowerIsBetter }) => {
                    const values = evals.map(e => e[key as keyof Evaluatie] as number | null)
                    const first = values.find(v => v !== null) ?? null
                    const last = [...values].reverse().find(v => v !== null) ?? null
                    const d = delta(last, first, lowerIsBetter)

                    return (
                      <tr key={key}>
                        <td>{label}</td>
                        {evals.map(ev => {
                          const val = ev[key as keyof Evaluatie] as number | null
                          return (
                            <td key={ev.id}>
                              {val !== null
                                ? <span className="vg-fysiek-val">{val}{unit && <span style={{ fontSize: '0.58rem', color: '#555', marginLeft: 2 }}>{unit}</span>}</span>
                                : <span className="vg-fysiek-empty">—</span>
                              }
                            </td>
                          )
                        })}
                        <td>
                          {d
                            ? <span style={{ color: d.color, fontWeight: 700, fontSize: '0.75rem' }}>{d.sign}{d.val}{unit && <span style={{ fontSize: '0.58rem', marginLeft: 2 }}>{unit}</span>}</span>
                            : <span className="vg-fysiek-empty">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Overzicht (all cycles) */}
          {activeTab === 'overzicht' && (
            <div>
              <span className="vg-section-label">Alle evaluaties</span>
              <div className="vg-cycle-cards">
                {[...evals].reverse().map((ev, idx) => {
                  const isLatest = idx === 0
                  const sliderVals = SLIDERS.map(({ key }) => {
                    const val = ev[key as keyof Evaluatie] as number | null
                    if (val === null) return null
                    const sig = STOPLIGHT(key, val)
                    return { key, label: SLIDERS.find(s => s.key === key)!.label, val, sig }
                  }).filter(Boolean) as { key: string; label: string; val: number; sig: string }[]

                  return (
                    <a key={ev.id} href={`/leden/${id}/evaluatie/${ev.cyclus}`} className="vg-cycle-card"
                      style={{ borderColor: isLatest ? 'rgba(168,200,0,0.2)' : '#1e1e1e' }}>
                      <div className="vg-cycle-card-header">
                        <span className="vg-cycle-card-title">
                          Cyclus {ev.cyclus}
                          {isLatest && <span style={{ marginLeft: 8, fontSize: '0.58rem', color: '#A8C800', fontWeight: 600, letterSpacing: '0.1em' }}>LAATSTE</span>}
                        </span>
                        <span className="vg-cycle-card-date">{formatDate(ev.datum)}</span>
                      </div>
                      <div className="vg-cycle-pips">
                        {sliderVals.map(({ key, label, val, sig }) => {
                          const col = COLORS[sig as keyof typeof COLORS]
                          return (
                            <span key={key} className="vg-ov-pip"
                              style={{ background: col.bg, color: col.label, border: `1px solid ${col.track}` }}
                              title={label}>
                              {label.slice(0, 3).toUpperCase()} {val}
                            </span>
                          )
                        })}
                      </div>
                      {ev.doelen_behaald !== null && (
                        <div className="vg-doelen-row">
                          Doelen behaald: <span style={{ color: ev.doelen_behaald ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                            {ev.doelen_behaald ? 'Ja' : 'Nee'}
                          </span>
                        </div>
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
