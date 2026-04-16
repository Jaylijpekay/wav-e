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
  notities: string | null
  trainer: { voornaam: string; achternaam: string } | null
}

type Lid = {
  voornaam: string
  achternaam: string
  lid_id: string
}

type PrevEval = {
  cyclus: number
  slaap: number | null
  energie: number | null
  stress: number | null
  voeding: number | null
  beweging: number | null
  motivatie: number | null
  tevredenheid: number | null
  gewicht_kg: number | null
}

const STOPLIGHT = (key: string, val: number) => {
  if (key === 'stress') return val > 7 ? 'red' : val > 5 ? 'amber' : 'green'
  return val < 6 ? 'red' : val < 7 ? 'amber' : 'green'
}

const COLORS = {
  red:   { thumb: '#dc2626', label: '#f87171', track: 'rgba(220,38,38,0.18)',  bg: 'rgba(220,38,38,0.06)'  },
  amber: { thumb: '#d97706', label: '#fbbf24', track: 'rgba(217,119,6,0.18)', bg: 'rgba(217,119,6,0.06)'  },
  green: { thumb: '#16a34a', label: '#4ade80', track: 'rgba(22,163,74,0.18)', bg: 'rgba(22,163,74,0.06)'  },
}

const SLIDERS = [
  { key: 'slaap',        label: 'Slaap',        low: 'Slecht',  high: 'Uitstekend' },
  { key: 'energie',      label: 'Energie',      low: 'Leeg',    high: 'Vol energie' },
  { key: 'stress',       label: 'Stress',       low: 'Geen',    high: 'Extreem' },
  { key: 'voeding',      label: 'Voeding',      low: 'Slecht',  high: 'Zeer goed' },
  { key: 'beweging',     label: 'Beweging',     low: 'Weinig',  high: 'Veel' },
  { key: 'motivatie',    label: 'Motivatie',    low: 'Geen',    high: 'Hoog' },
  { key: 'tevredenheid', label: 'Tevredenheid', low: 'Ontevreden', high: 'Zeer tevreden' },
]

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const delta = (curr: number | null, prev: number | null): { val: number; sign: string; color: string } | null => {
  if (curr === null || prev === null) return null
  const diff = curr - prev
  if (diff === 0) return null
  return {
    val: Math.abs(diff),
    sign: diff > 0 ? '+' : '−',
    color: diff > 0 ? '#4ade80' : '#f87171',
  }
}

export default function EvaluatieDetail() {
  const { id, cyclus } = useParams()
  const router = useRouter()

  const [ev, setEv] = useState<Evaluatie | null>(null)
  const [lid, setLid] = useState<Lid | null>(null)
  const [prev, setPrev] = useState<PrevEval | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()

      const { data: lidData } = await supabase
        .from('leden')
        .select('voornaam, achternaam, lid_id')
        .eq('id', id)
        .single()
      setLid(lidData)

      const { data: evData } = await supabase
        .from('evaluaties')
        .select('id, cyclus, datum, slaap, energie, stress, voeding, beweging, motivatie, tevredenheid, gewicht_kg, vetpercentage, spiermassa_kg, visceraal_vet, buikomvang_cm, doelen_behaald, notities, trainer:trainer_id(voornaam, achternaam)')
        .eq('lid_id', id)
        .eq('cyclus', Number(cyclus))
        .single()
      setEv(evData)

      if (evData && Number(cyclus) > 1) {
        const { data: prevData } = await supabase
          .from('evaluaties')
          .select('cyclus, slaap, energie, stress, voeding, beweging, motivatie, tevredenheid, gewicht_kg')
          .eq('lid_id', id)
          .eq('cyclus', Number(cyclus) - 1)
          .single()
        setPrev(prevData)
      }

      setLoading(false)
    }
    if (id && cyclus) load()
  }, [id, cyclus])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A8C800', boxShadow: '0 0 12px rgba(168,200,0,0.5)' }} />
    </div>
  )

  if (!ev || !lid) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontFamily: 'Raleway, sans-serif', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
      Evaluatie niet gevonden.
    </div>
  )

  const trainerName = ev.trainer ? `${ev.trainer.voornaam} ${ev.trainer.achternaam}` : '—'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .ev-root {
          min-height: 100vh;
          background: #111;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          position: relative;
        }
        .ev-root::before {
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
        .ev-header {
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
        .ev-header-inner {
          max-width: 860px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ev-back {
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
        .ev-back:hover { color: #A8C800; }
        .ev-header-title {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #B4B4B4;
        }

        /* Body */
        .ev-body {
          max-width: 860px;
          margin: 0 auto;
          padding: 2.5rem 2rem 6rem;
          position: relative;
          z-index: 1;
        }

        /* Identity block */
        .ev-identity {
          margin-bottom: 2.5rem;
          animation: evFadeUp 0.35s ease-out both;
        }
        .ev-name {
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .ev-meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .ev-tag {
          font-size: 0.62rem;
          font-weight: 500;
          color: #555;
          border: 1px solid #1e1e1e;
          border-radius: 2px;
          padding: 3px 8px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .ev-tag-highlight {
          color: #A8C800;
          border-color: rgba(168,200,0,0.2);
        }

        /* Divider */
        .ev-divider {
          height: 1px;
          background: #1e1e1e;
          margin: 2rem 0;
        }

        /* Section label */
        .ev-section-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: #B4B4B4;
          text-transform: uppercase;
          margin-bottom: 1.25rem;
          display: block;
        }

        /* Slider cards — read-only */
        .ev-slider-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .ev-slider-card {
          background: #161616;
          border: 1px solid #1e1e1e;
          border-radius: 4px;
          padding: 14px 16px 12px;
          animation: evFadeUp 0.4s ease-out both;
        }
        .ev-slider-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 10px;
        }
        .ev-slider-label {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #777;
        }
        .ev-slider-right {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .ev-slider-value {
          font-size: 1.3rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .ev-delta {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        /* Read-only track */
        .ev-track-wrap {
          position: relative;
          height: 4px;
          border-radius: 2px;
          background: #1e1e1e;
          margin: 4px 0 8px;
        }
        .ev-track-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .ev-track-thumb {
          position: absolute;
          top: 50%;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .ev-slider-hints {
          display: flex;
          justify-content: space-between;
        }
        .ev-slider-hint {
          font-size: 0.58rem;
          color: #444;
          letter-spacing: 0.04em;
        }

        /* Fysiek grid */
        .ev-fysiek-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }
        .ev-fysiek-card {
          background: #161616;
          border: 1px solid #1e1e1e;
          border-radius: 4px;
          padding: 12px 14px;
        }
        .ev-fysiek-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #555;
          margin-bottom: 4px;
        }
        .ev-fysiek-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #B4B4B4;
          letter-spacing: -0.01em;
        }
        .ev-fysiek-empty {
          color: #333;
          font-size: 0.75rem;
        }

        /* Doelen */
        .ev-doelen-pill {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 14px;
          border-radius: 3px;
          border: 1px solid;
        }
        .ev-doelen-ja    { color: #4ade80; border-color: rgba(22,163,74,0.3); background: rgba(22,163,74,0.06); }
        .ev-doelen-nee   { color: #f87171; border-color: rgba(220,38,38,0.3); background: rgba(220,38,38,0.06); }
        .ev-doelen-nvt   { color: #555;    border-color: #1e1e1e;             background: #161616; }

        /* Notities */
        .ev-notities {
          background: #161616;
          border: 1px solid #1e1e1e;
          border-radius: 4px;
          padding: 14px 16px;
          font-size: 0.82rem;
          color: #c8c6c0;
          line-height: 1.65;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .ev-notities-empty {
          color: #333;
          font-style: italic;
        }

        @keyframes evFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="ev-root">
        <header className="ev-header">
          <div className="ev-header-inner">
            <button className="ev-back" onClick={() => router.push(`/leden/${id}`)}>
              ← {lid.voornaam} {lid.achternaam}
            </button>
            <span className="ev-header-title">Cyclus {ev.cyclus}</span>
          </div>
        </header>

        <div className="ev-body">

          {/* Identity */}
          <div className="ev-identity">
            <h1 className="ev-name">{lid.voornaam} {lid.achternaam}</h1>
            <div className="ev-meta-row">
              <span className="ev-tag ev-tag-highlight">Cyclus {ev.cyclus}</span>
              <span className="ev-tag">{formatDate(ev.datum)}</span>
              <span className="ev-tag">{lid.lid_id}</span>
              <span className="ev-tag">Trainer: {trainerName}</span>
              {prev && <span className="ev-tag">vs. cyclus {prev.cyclus}</span>}
            </div>
          </div>

          {/* Leefstijl */}
          <section style={{ animationDelay: '0.05s' }}>
            <span className="ev-section-label">Leefstijl scores</span>
            <div className="ev-slider-grid">
              {SLIDERS.map(({ key, label, low, high }) => {
                const val = ev[key as keyof Evaluatie] as number | null
                const prevVal = prev ? prev[key as keyof PrevEval] as number | null : null
                if (val === null) return null
                const sig = STOPLIGHT(key, val)
                const col = COLORS[sig as keyof typeof COLORS]
                const d = delta(val, prevVal)
                const pct = ((val - 1) / 9) * 100

                return (
                  <div key={key} className="ev-slider-card" style={{ borderColor: col.track }}>
                    <div className="ev-slider-top">
                      <span className="ev-slider-label">{label}</span>
                      <div className="ev-slider-right">
                        {d && (
                          <span className="ev-delta" style={{ color: d.color }}>
                            {d.sign}{d.val}
                          </span>
                        )}
                        <span className="ev-slider-value" style={{ color: col.label }}>{val}</span>
                      </div>
                    </div>
                    <div className="ev-track-wrap">
                      <div className="ev-track-fill" style={{ width: `${pct}%`, background: col.track }} />
                      <div className="ev-track-thumb" style={{ left: `${pct}%`, background: col.thumb }} />
                    </div>
                    <div className="ev-slider-hints">
                      <span className="ev-slider-hint">{low}</span>
                      <span className="ev-slider-hint">{high}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="ev-divider" />

          {/* Fysiek */}
          <section style={{ animationDelay: '0.1s' }}>
            <span className="ev-section-label">Fysiek</span>
            <div className="ev-fysiek-grid">
              {[
                { label: 'Gewicht',      val: ev.gewicht_kg,     unit: 'kg'  },
                { label: 'Vetpercentage', val: ev.vetpercentage,  unit: '%'   },
                { label: 'Spiermassa',   val: ev.spiermassa_kg,  unit: 'kg'  },
                { label: 'Visceraal vet', val: ev.visceraal_vet, unit: ''    },
                { label: 'Buikomvang',   val: ev.buikomvang_cm,  unit: 'cm'  },
              ].map(({ label, val, unit }) => (
                <div key={label} className="ev-fysiek-card">
                  <div className="ev-fysiek-label">{label}</div>
                  {val !== null
                    ? <div className="ev-fysiek-value">{val}{unit && <span style={{ fontSize: '0.65rem', color: '#555', marginLeft: 3 }}>{unit}</span>}</div>
                    : <div className="ev-fysiek-value ev-fysiek-empty">—</div>
                  }
                </div>
              ))}
            </div>
          </section>

          <div className="ev-divider" />

          {/* Doelen & notities */}
          <section style={{ animationDelay: '0.15s' }}>
            <span className="ev-section-label">Doelen & notities</span>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>Doelen behaald</div>
              <span className={`ev-doelen-pill ${ev.doelen_behaald === true ? 'ev-doelen-ja' : ev.doelen_behaald === false ? 'ev-doelen-nee' : 'ev-doelen-nvt'}`}>
                {ev.doelen_behaald === true ? 'Ja' : ev.doelen_behaald === false ? 'Nee' : 'N.v.t.'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>Notities</div>
              {ev.notities
                ? <div className="ev-notities">{ev.notities}</div>
                : <div className="ev-notities ev-notities-empty">Geen notities</div>
              }
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
