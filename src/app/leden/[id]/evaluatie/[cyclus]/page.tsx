'use client'

/*
 * Evaluatiedetail
 *
 * Wat doet deze pagina:
 * Deze pagina toont een enkele evaluatiecyclus van een lid. De pagina vergelijkt waar mogelijk met de vorige cyclus.
 *
 * Data:
 * Leest uit: leden, evaluaties, trainers.
 *
 * Toegang:
 * management / trainer
 *
 * Gerelateerde API routes:
 * Geen.
 */

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
  trainer: { voornaam: string; achternaam: string }[] | null
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

type CyclusNotitie = {
  id: string
  lid_id: string
  evaluatie_id: string | null
  auteur_id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  auteur_naam: string
  tekst: string
  aangemaakt_op: string
  toon_aan_trainer: boolean
  gezien: boolean
}

const STOPLIGHT = (key: string, val: number) => {
  if (key === 'stress') return val > 7 ? 'red' : val > 5 ? 'amber' : 'green'
  return val < 6 ? 'red' : val < 7 ? 'amber' : 'green'
}

const COLORS = {
  red:   { thumb: 'var(--red-danger)', label: 'var(--red-text)', track: 'rgba(220,38,38,0.18)',  bg: 'rgba(220,38,38,0.06)'  },
  amber: { thumb: 'var(--amber)', label: 'var(--amber-text)', track: 'rgba(217,119,6,0.18)', bg: 'rgba(217,119,6,0.06)'  },
  green: { thumb: 'var(--green-signal)', label: 'var(--green-signal-text)', track: 'rgba(22,163,74,0.18)', bg: 'rgba(22,163,74,0.06)'  },
}

const SLIDERS = [
  { key: 'slaap',        label: 'Slaap',        low: 'Slecht',     high: 'Uitstekend'   },
  { key: 'energie',      label: 'Energie',      low: 'Leeg',       high: 'Vol energie'  },
  { key: 'stress',       label: 'Stress',       low: 'Geen',       high: 'Extreem'      },
  { key: 'voeding',      label: 'Voeding',      low: 'Slecht',     high: 'Zeer goed'    },
  { key: 'beweging',     label: 'Beweging',     low: 'Weinig',     high: 'Veel'         },
  { key: 'motivatie',    label: 'Motivatie',    low: 'Geen',       high: 'Hoog'         },
  { key: 'tevredenheid', label: 'Tevredenheid', low: 'Ontevreden', high: 'Zeer tevreden'},
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
    color: diff > 0 ? 'var(--green-signal-text)' : 'var(--red-text)',
  }
}

export default function EvaluatieDetail() {
  const { id, cyclus } = useParams()
  const router = useRouter()

  const [ev, setEv] = useState<Evaluatie | null>(null)
  const [lid, setLid] = useState<Lid | null>(null)
  const [prev, setPrev] = useState<PrevEval | null>(null)
  const [loading, setLoading] = useState(true)
  const [cyclusNotities, setCyclusNotities] = useState<CyclusNotitie[]>([])
  const [cyclusNotitiesLoading, setCyclusNotitiesLoading] = useState(true)
  const [cyclusNotitieTekst, setCyclusNotitieTekst] = useState('')
  const [cyclusNotitiePosting, setCyclusNotitiePosting] = useState(false)
  const [cyclusNotitieError, setCyclusNotitieError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/leden/${id}`)
        if (res.ok) {
          const { lid: lidData, evaluaties: allEvals } = await res.json()
          setLid(lidData ?? null)
          const n = Number(cyclus)
          const evData = (allEvals ?? []).find((e: { cyclus: number }) => e.cyclus === n) ?? null
          setEv(evData)
          if (evData && n > 1) {
            setPrev((allEvals ?? []).find((e: { cyclus: number }) => e.cyclus === n - 1) ?? null)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    if (id && cyclus) load()
  }, [id, cyclus])

  useEffect(() => {
    if (!ev?.id || !id) return

    const fetchCyclusNotities = async () => {
      setCyclusNotitiesLoading(true)
      try {
        const res = await fetch(`/api/notities/${id}?evaluatie_id=${ev.id}`)
        if (!res.ok) throw new Error('Ophalen mislukt')
        const data = await res.json()
        setCyclusNotities(data.notities ?? [])
      } catch {
        setCyclusNotities([])
      } finally {
        setCyclusNotitiesLoading(false)
      }
    }

    fetchCyclusNotities()
  }, [ev?.id, id])

  const postCyclusNotitie = async () => {
    if (!cyclusNotitieTekst.trim() || !ev?.id) return
    setCyclusNotitiePosting(true)
    setCyclusNotitieError(null)

    try {
      const res = await fetch(`/api/notities/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tekst: cyclusNotitieTekst.trim(),
          evaluatie_id: ev.id,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setCyclusNotitieError(err.error ?? 'Opslaan mislukt')
        return
      }

      const data = await res.json()
      const notitie = (data.notitie ?? data) as CyclusNotitie
      setCyclusNotities(prev => [notitie, ...prev])
      setCyclusNotitieTekst('')
    } catch {
      setCyclusNotitieError('Verbindingsfout')
    } finally {
      setCyclusNotitiePosting(false)
    }
  }

  const deleteCyclusNotitie = async (notitieId: string) => {
    const previous = cyclusNotities
    setCyclusNotities(prev => prev.filter(n => n.id !== notitieId))

    try {
      const res = await fetch(`/api/notities/${id}/${notitieId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
    } catch {
      setCyclusNotities(previous)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-black-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wave-green)', boxShadow: '0 0 12px rgba(168,200,0,0.5)' }} />
    </div>
  )

  if (!ev || !lid) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-black-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontFamily: 'Raleway, sans-serif', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
      Evaluatie niet gevonden.
    </div>
  )

  const trainerName = ev.trainer?.[0] ? `${ev.trainer[0].voornaam} ${ev.trainer[0].achternaam}` : '—'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .ev-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--color-black-soft);
          color: var(--text-warm);
          font-family: 'Raleway', sans-serif;
          position: relative;
          -webkit-tap-highlight-color: transparent;
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

        /* ── Header ── */
        .ev-header {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 52px;
          display: flex;
          align-items: center;
          padding: 0 1.5rem;
          background: rgba(17,17,17,0.92);
          border-bottom: 1px solid rgba(168,200,0,0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .ev-header-inner {
          max-width: var(--app-shell-form);
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .ev-back {
          background: none;
          border: none;
          color: var(--text-dim);
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          cursor: pointer;
          /* Tap target */
          padding: 10px 0;
          min-height: 44px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
          touch-action: manipulation;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 60%;
        }
        .ev-back:hover  { color: var(--wave-green); }
        .ev-back:active { color: var(--wave-green); }

        .ev-header-title {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--wave-gray-light);
          flex-shrink: 0;
        }

        /* ── Body ── */
        .ev-body {
          max-width: var(--app-shell-form);
          margin: 0 auto;
          padding: 2rem var(--app-shell-padding) 6rem;
          position: relative;
          z-index: 1;
        }

        /* ── Identity ── */
        .ev-identity {
          margin-bottom: 2.5rem;
          animation: evFadeUp 0.35s ease-out both;
        }
        .ev-name {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--color-white);
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
          color: var(--text-dim);
          border: 1px solid var(--bg-base);
          border-radius: 2px;
          padding: 4px 8px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .ev-tag-highlight {
          color: var(--wave-green);
          border-color: rgba(168,200,0,0.2);
        }

        /* ── Divider ── */
        .ev-divider {
          height: 1px;
          background: var(--bg-base);
          margin: 2rem 0;
        }

        /* ── Section label ── */
        .ev-section-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: var(--wave-gray-light);
          text-transform: uppercase;
          margin-bottom: 1.25rem;
          display: block;
        }

        /* ── Slider cards — read-only display ── */
        .ev-slider-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .ev-slider-card {
          background: var(--surface-dark);
          border: 1px solid var(--bg-base);
          border-radius: 4px;
          padding: 16px 16px 14px;
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
          color: var(--text-soft);
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

        /* ── Read-only track ── */
        .ev-track-wrap {
          position: relative;
          height: 6px;
          border-radius: 3px;
          background: var(--bg-base);
          margin: 6px 0 10px;
        }
        .ev-track-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .ev-track-thumb {
          position: absolute;
          top: 50%;
          /* Larger thumb on tablet */
          width: 16px;
          height: 16px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 4px rgba(0,0,0,0.4);
        }
        .ev-slider-hints {
          display: flex;
          justify-content: space-between;
        }
        .ev-slider-hint {
          font-size: 0.58rem;
          color: var(--text-quieter);
          letter-spacing: 0.04em;
        }

        /* ── Fysiek grid ── */
        .ev-fysiek-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }
        .ev-fysiek-card {
          background: var(--surface-dark);
          border: 1px solid var(--bg-base);
          border-radius: 4px;
          padding: 14px 14px;
        }
        .ev-fysiek-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-dim);
          margin-bottom: 6px;
        }
        .ev-fysiek-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--wave-gray-light);
          letter-spacing: -0.01em;
        }
        .ev-fysiek-empty {
          color: var(--text-very-faint);
          font-size: 0.75rem;
        }

        /* ── Doelen ── */
        .ev-doelen-pill {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 8px 16px;
          border-radius: 3px;
          border: 1px solid;
        }
        .ev-doelen-ja  { color: var(--green-signal-text); border-color: rgba(22,163,74,0.3);  background: rgba(22,163,74,0.06); }
        .ev-doelen-nee { color: var(--red-text); border-color: rgba(220,38,38,0.3);  background: rgba(220,38,38,0.06); }
        .ev-doelen-nvt { color: var(--text-dim);    border-color: var(--bg-base);              background: var(--surface-dark); }

        /* ── Notities ── */
        .ev-notities {
          background: var(--surface-dark);
          border: 1px solid var(--bg-base);
          border-radius: 4px;
          padding: 16px 16px;
          font-size: 0.85rem;
          color: var(--text-warm);
          line-height: 1.7;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .ev-notities-empty {
          color: var(--text-very-faint);
          font-style: italic;
        }

        @keyframes evFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Tablet: iPad 7th gen ── */
        @media (min-width: 768px) and (pointer: coarse) {
          .ev-header { height: 60px; padding: 0 2rem; }
          .ev-body   { padding: 2rem 2rem 6rem; }

          /* Slider grid: 2 cols on portrait, auto on landscape */
          .ev-slider-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }

          .ev-slider-card { padding: 20px 18px 16px; }
          .ev-slider-value { font-size: 1.5rem; }

          /* Bigger thumb */
          .ev-track-thumb { width: 20px; height: 20px; }
          .ev-track-wrap  { height: 6px; margin: 8px 0 12px; }

          /* Fysiek cards: taller */
          .ev-fysiek-card { padding: 16px; }
          .ev-fysiek-value { font-size: 1.25rem; }

          /* Notities */
          .ev-notities { padding: 18px 20px; font-size: 0.9rem; }
        }

        /* Landscape tablet: 3-col sliders */
        @media (min-width: 900px) and (pointer: coarse) and (orientation: landscape) {
          .ev-slider-grid { grid-template-columns: repeat(3, 1fr); }
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
                { label: 'Gewicht',       val: ev.gewicht_kg,    unit: 'kg' },
                { label: 'Vetpercentage', val: ev.vetpercentage,  unit: '%'  },
                { label: 'Spiermassa',    val: ev.spiermassa_kg,  unit: 'kg' },
                { label: 'Visceraal vet', val: ev.visceraal_vet, unit: ''   },
                { label: 'Buikomvang',    val: ev.buikomvang_cm,  unit: 'cm' },
              ].map(({ label, val, unit }) => (
                <div key={label} className="ev-fysiek-card">
                  <div className="ev-fysiek-label">{label}</div>
                  {val !== null
                    ? <div className="ev-fysiek-value">{val}{unit && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: 3 }}>{unit}</span>}</div>
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
              <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>Doelen behaald</div>
              <span className={`ev-doelen-pill ${ev.doelen_behaald === true ? 'ev-doelen-ja' : ev.doelen_behaald === false ? 'ev-doelen-nee' : 'ev-doelen-nvt'}`}>
                {ev.doelen_behaald === true ? 'Ja' : ev.doelen_behaald === false ? 'Nee' : 'N.v.t.'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10 }}>Notities</div>
              {ev.notities
                ? <div className="ev-notities">{ev.notities}</div>
                : <div className="ev-notities ev-notities-empty">Geen notities</div>
              }
            </div>
          </section>

          {ev.notities?.trim() && (
            <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
              <div style={{
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
              }}>
                Historische aantekening
              </div>
              <div style={{
                padding: '12px 16px', borderRadius: 3,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeft: '3px solid rgba(255,255,255,0.1)',
                fontSize: '0.8rem', color: 'var(--text-faint)',
                lineHeight: 1.6, fontStyle: 'italic',
                whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
              }}>
                {ev.notities}
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-faint)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Opgeslagen tijdens gesprek · niet bewerkbaar
              </div>
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <div style={{
              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>Aantekeningen bij deze cyclus</span>
              {cyclusNotities.length > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 2, fontWeight: 600 }}>
                  {cyclusNotities.length}
                </span>
              )}
            </div>

            {cyclusNotitiesLoading ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', padding: '0.5rem 0' }}>Laden…</div>
            ) : (
              <>
                {cyclusNotities.map(n => {
                  const isMgmt = n.auteur_type === 'management' || n.auteur_type === 'admin'
                  const borderColor = isMgmt ? 'rgba(99,102,241,0.5)' : 'rgba(168,200,0,0.25)'
                  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
                  const date = new Date(n.aangemaakt_op)
                  const dateLabel = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`

                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px 14px', marginBottom: 6, borderRadius: 3,
                        background: isMgmt ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: `3px solid ${borderColor}`,
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.tekst}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, gap: 12 }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {n.auteur_naam} · {dateLabel}
                        </span>
                        <button
                          onClick={() => deleteCyclusNotitie(n.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', color: 'var(--text-faint)', fontFamily: 'inherit', padding: '2px 0' }}
                          aria-label="Aantekening verwijderen"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )
                })}
                {cyclusNotities.length === 0 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', padding: '0.5rem 0' }}>
                    Nog geen aantekeningen bij deze cyclus.
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={cyclusNotitieTekst}
                onChange={e => setCyclusNotitieTekst(e.target.value)}
                placeholder="Aantekening toevoegen aan deze cyclus…"
                maxLength={1000}
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 3, padding: '10px 12px',
                  color: 'var(--text-warm)', fontSize: '1rem', fontFamily: 'inherit', minHeight: 44,
                }}
              />
              {cyclusNotitieError && (
                <div style={{ fontSize: '0.8rem', color: 'var(--red-text)' }}>{cyclusNotitieError}</div>
              )}
              <button
                onClick={postCyclusNotitie}
                disabled={cyclusNotitiePosting || !cyclusNotitieTekst.trim()}
                style={{
                  alignSelf: 'flex-end', padding: '10px 18px', minHeight: 44,
                  background: 'rgba(168,200,0,0.9)', color: '#111',
                  border: 'none', borderRadius: 3,
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', fontFamily: 'inherit',
                  cursor: cyclusNotitiePosting || !cyclusNotitieTekst.trim() ? 'default' : 'pointer',
                  opacity: cyclusNotitiePosting || !cyclusNotitieTekst.trim() ? 0.5 : 1,
                  touchAction: 'manipulation',
                }}
              >
                {cyclusNotitiePosting ? 'Opslaan…' : 'Toevoegen'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
