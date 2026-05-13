'use client'

/*
 * Nieuw gesprek
 *
 * Wat doet deze pagina:
 * Deze pagina legt een nieuwe evaluatie of gesprek vast voor een actief lid. De ingevoerde scores worden opgeslagen als volgende evaluatiecyclus.
 *
 * Data:
 * Leest uit: leden, evaluaties. Schrijft naar: evaluaties.
 *
 * Toegang:
 * trainer
 *
 * Gerelateerde API routes:
 * Geen.
 */

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  trainer_id: string
}

type SliderField = {
  key: string
  label: string
  low: string
  high: string
}

const SLIDERS: SliderField[] = [
  { key: 'slaap',     label: 'Slaap',     low: 'Slecht',  high: 'Uitstekend' },
  { key: 'energie',   label: 'Energie',   low: 'Leeg',    high: 'Vol energie' },
  { key: 'stress',    label: 'Stress',    low: 'Geen',    high: 'Extreem' },
  { key: 'voeding',   label: 'Voeding',   low: 'Slecht',  high: 'Zeer goed' },
  { key: 'beweging',  label: 'Beweging',  low: 'Weinig',  high: 'Veel' },
  { key: 'motivatie', label: 'Motivatie', low: 'Geen',    high: 'Hoog' },
]

const STOPLIGHT = (key: string, val: number) => {
  if (key === 'stress') return val > 7 ? 'red' : val > 5 ? 'amber' : 'green'
  return val < 6 ? 'red' : val < 7 ? 'amber' : 'green'
}

const COLORS = {
  red:   { thumb: 'var(--red-danger)', label: 'var(--red-text)', track: 'rgba(220,38,38,0.25)',  glow: 'rgba(220,38,38,0.12)'  },
  amber: { thumb: 'var(--amber)', label: 'var(--amber-text)', track: 'rgba(217,119,6,0.25)', glow: 'rgba(217,119,6,0.10)'  },
  green: { thumb: 'var(--green-signal)', label: 'var(--green-signal-text)', track: 'rgba(22,163,74,0.25)', glow: 'rgba(22,163,74,0.10)'  },
}

export default function GesprekNew() {
  const router = useRouter()
  const [leden, setLeden] = useState<Lid[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [lidId, setLidId] = useState('')
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [gewicht, setGewicht] = useState('')
  const [vetpercentage, setVetpercentage] = useState('')
  const [spiermassa, setSpiermassa] = useState('')
  const [doelen, setDoelen] = useState<boolean | null>(null)
  const [notities, setNotities] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({
    slaap: 5, energie: 5, stress: 5, voeding: 5, beweging: 5, motivatie: 5,
  })
  const [tevredenheid, setTevredenheid] = useState<number>(5)

  useEffect(() => {
    const load = async () => {
      const params = new URLSearchParams(window.location.search)
      const prefill = params.get('lid_id')
      if (prefill) setLidId(prefill)

      const supabase = getSupabase()
      const [{ data: ledenData }] = await Promise.all([
        supabase.from('leden').select('id, lid_id, voornaam, achternaam, trainer_id').eq('actief', true).order('achternaam'),
      ])
      setLeden(ledenData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lidId) { setError('Selecteer een lid.'); return }
    setSaving(true)
    setError(null)

    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const selectedLid = leden.find(l => l.id === lidId)
    const trainerId = selectedLid?.trainer_id
    if (!trainerId) { setError('Geen trainer gekoppeld aan dit lid.'); setSaving(false); return }

    const { data: evalData } = await supabase
      .from('evaluaties').select('cyclus').eq('lid_id', lidId)
      .order('cyclus', { ascending: false }).limit(1)
    const cyclus = evalData && evalData.length > 0 ? evalData[0].cyclus + 1 : 1

    const { error: insertError } = await supabase.from('evaluaties').insert({
      lid_id: lidId, trainer_id: trainerId, cyclus, datum,
      slaap: scores.slaap, energie: scores.energie, stress: scores.stress,
      voeding: scores.voeding, beweging: scores.beweging, motivatie: scores.motivatie,
      tevredenheid,
      gewicht_kg: gewicht ? parseFloat(gewicht) : null,
      vetpercentage: vetpercentage ? parseFloat(vetpercentage) : null,
      spiermassa_kg: spiermassa ? parseFloat(spiermassa) : null,
      doelen_behaald: doelen,
      notities: notities || null,
      aangemaakt_door: user?.id ?? null,
    })

    if (insertError) { setError(insertError.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/'), 1200)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--color-black-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wave-green)', boxShadow: '0 0 12px rgba(168,200,0,0.5)' }} />
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .gn-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--color-black-soft);
          color: var(--text-warm);
          font-family: 'Raleway', sans-serif;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }

        .gn-root::before {
          content: '';
          position: fixed;
          top: -10%;
          right: -10%;
          width: 50%;
          height: 50%;
          background: radial-gradient(ellipse, rgba(168,200,0,0.05) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Header ── */
        .gn-header {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 1.5rem;
          background: rgba(17,17,17,0.92);
          border-bottom: 1px solid rgba(168,200,0,0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .gn-header-inner {
          max-width: 860px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: baseline;
          gap: 18px;
        }

        .gn-wordmark {
          display: flex;
          align-items: baseline;
          gap: 0;
          cursor: pointer;
          text-decoration: none;
        }
        .gn-wordmark-wav { font-size: 1rem; font-weight: 700; color: var(--wave-gray-light); letter-spacing: -0.01em; }
        .gn-wordmark-e   { font-size: 1rem; font-weight: 700; color: var(--wave-green); letter-spacing: -0.01em; }

        .gn-page-title {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--wave-gray-light);
        }

        /* ── Form ── */
        .gn-form {
          max-width: 860px;
          margin: 0 auto;
          padding: 2.5rem 1.5rem 6rem;
          position: relative;
          z-index: 1;
        }

        .gn-section { margin-bottom: 0; animation: gnFadeUp 0.4s ease-out both; }

        .gn-section-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: var(--wave-gray-light);
          text-transform: uppercase;
          margin-bottom: 1.25rem;
          margin-top: 0;
          display: block;
        }

        .gn-divider {
          height: 1px;
          background: var(--border-muted-dark);
          margin: 2.5rem 0;
        }

        /* ── Row / Field ── */
        .gn-row   { display: flex; gap: 16px; flex-wrap: wrap; }
        .gn-field { display: flex; flex-direction: column; flex: 1; min-width: 200px; }
        .gn-field-narrow { max-width: 200px; }

        .gn-label {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--wave-gray-light);
          margin-bottom: 7px;
        }

        /* ── Inputs — min-height 44px, font ≥ 16px prevents iOS zoom ── */
        .gn-select, .gn-input, .gn-textarea {
          background: var(--surface-deep);
          border: 1px solid var(--bg-base);
          border-radius: 3px;
          color: var(--text-warm);
          padding: 12px 12px;
          min-height: 44px;
          font-size: 1rem;
          font-family: 'Raleway', sans-serif;
          font-weight: 400;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .gn-select:focus, .gn-input:focus, .gn-textarea:focus {
          border-color: var(--wave-green);
          box-shadow: 0 0 0 3px rgba(168,200,0,0.08);
        }
        .gn-select option { background: var(--surface-deep); }
        .gn-textarea { resize: vertical; line-height: 1.6; min-height: 120px; }

        /* ── Slider grid ── */
        .gn-slider-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 12px;
        }

        .gn-slider-card {
          background: var(--surface-deep);
          border: 1px solid var(--bg-base);
          border-radius: 3px;
          padding: 18px 18px 14px;
          transition: border-color 0.25s ease;
        }

        .gn-slider-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 16px;
        }

        .gn-slider-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--wave-gray-light);
          letter-spacing: 0.02em;
        }

        .gn-slider-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          transition: color 0.2s;
        }

        /* ── Range slider — large thumb for touch ── */
        .gn-slider {
          width: 100%;
          cursor: pointer;
          /* Taller hit area on tablet */
          height: 28px;
          margin-bottom: 4px;
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          outline: none;
          /* Centre the track vertically */
          display: flex;
          align-items: center;
        }

        /* Track */
        .gn-slider::-webkit-slider-runnable-track {
          height: 4px;
          background: var(--bg-base);
          border-radius: 2px;
        }
        .gn-slider::-moz-range-track {
          height: 4px;
          background: var(--bg-base);
          border-radius: 2px;
        }

        /* Thumb — 28px on mobile, 36px on tablet for reliable touch */
        .gn-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--thumb-color, var(--wave-green));
          cursor: pointer;
          margin-top: -12px;
          box-shadow: 0 0 6px rgba(0,0,0,0.5);
          transition: transform 0.12s;
        }
        .gn-slider::-webkit-slider-thumb:active { transform: scale(1.15); }

        .gn-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: var(--thumb-color, var(--wave-green));
          cursor: pointer;
          box-shadow: 0 0 6px rgba(0,0,0,0.5);
        }

        .gn-slider-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          margin-top: 4px;
        }

        .gn-slider-hint {
          font-size: 0.6rem;
          color: var(--wave-gray-light);
          letter-spacing: 0.04em;
        }

        .gn-stoplight-bar {
          height: 2px;
          border-radius: 1px;
          transition: background 0.3s;
        }

        /* ── Toggle ── */
        .gn-toggle-group { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }

        .gn-toggle-btn {
          background: var(--surface-deep);
          border: 1px solid var(--bg-base);
          border-radius: 3px;
          color: var(--wave-gray-light);
          /* Larger tap target */
          padding: 12px 20px;
          min-height: 44px;
          font-size: 0.85rem;
          font-family: 'Raleway', sans-serif;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: all 0.15s;
          touch-action: manipulation;
          flex: 1;
        }
        .gn-toggle-btn:hover  { border-color: rgba(168,200,0,0.3); }
        .gn-toggle-btn:active { border-color: rgba(168,200,0,0.4); background: var(--surface-pressed); }
        .gn-toggle-btn.active {
          background: var(--surface-pressed);
          border-color: rgba(168,200,0,0.5);
          color: var(--wave-green);
        }

        /* ── Internal block ── */
        .gn-internal-block {
          background: var(--color-black-soft);
          border: 1px solid var(--bg-base);
          border-radius: 3px;
          padding: 18px 18px 14px;
        }

        .gn-internal-tag {
          display: inline-block;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--color-accent-text);
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 2px;
          padding: 2px 7px;
          margin-bottom: 12px;
        }

        /* ── Error ── */
        .gn-error {
          background: rgba(220,38,38,0.07);
          border: 1px solid rgba(220,38,38,0.2);
          border-radius: 3px;
          color: var(--red-text);
          padding: 12px 16px;
          font-size: 0.82rem;
          margin-bottom: 1.5rem;
          letter-spacing: 0.02em;
        }

        /* ── Submit row ── */
        .gn-submit-row {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 3rem;
          flex-wrap: wrap;
        }

        .gn-cancel-btn {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 12px 22px;
          min-height: 48px;
          border-radius: 3px;
          border: 1px solid var(--bg-base);
          background: transparent;
          color: var(--wave-gray-light);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
          touch-action: manipulation;
        }
        .gn-cancel-btn:hover  { border-color: rgba(168,200,0,0.3); color: var(--text-mid); }
        .gn-cancel-btn:active { border-color: rgba(168,200,0,0.4); }

        .gn-submit-btn {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 12px 28px;
          min-height: 48px;
          border-radius: 3px;
          border: 1px solid var(--wave-green);
          background: var(--wave-green);
          color: var(--color-black-soft);
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
          touch-action: manipulation;
        }
        .gn-submit-btn:hover:not(:disabled) {
          background: var(--wave-green-hover);
          box-shadow: 0 4px 16px rgba(168,200,0,0.35);
        }
        .gn-submit-btn:active:not(:disabled) {
          background: var(--wave-green-active);
          transform: scale(0.97);
        }
        .gn-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .gn-submit-btn.success  { background: var(--green-signal); border-color: var(--green-signal); color: var(--color-white); }

        @keyframes gnFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Tablet: iPad 7th gen (768px+, coarse pointer) ── */
        @media (min-width: 768px) and (pointer: coarse) {
          .gn-header { height: 64px; padding: 0 2rem; }
          .gn-form   { padding: 2.5rem 2rem 6rem; }

          /* Slider grid: 2 cols on portrait, 3 on landscape */
          .gn-slider-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }

          /* Even bigger thumb on tablet */
          .gn-slider::-webkit-slider-thumb { width: 36px; height: 36px; margin-top: -16px; }
          .gn-slider::-moz-range-thumb     { width: 36px; height: 36px; }
          .gn-slider { height: 36px; }

          .gn-slider-card { padding: 22px 20px 16px; }

          /* Doelen + tevredenheid: stack on portrait, side-by-side on landscape */
          .gn-doelen-row { grid-template-columns: 1fr; gap: 16px; }

          .gn-toggle-btn { padding: 14px 20px; min-height: 52px; font-size: 0.9rem; }

          .gn-select,
          .gn-input { min-height: 52px; padding: 14px 14px; }

          .gn-cancel-btn,
          .gn-submit-btn { min-height: 56px; padding: 14px 28px; font-size: 0.78rem; }
        }

        /* Landscape tablet: restore 2-col doelen row and 3-col slider grid */
        @media (min-width: 900px) and (pointer: coarse) and (orientation: landscape) {
          .gn-slider-grid  { grid-template-columns: repeat(3, 1fr); }
          .gn-doelen-row   { grid-template-columns: 1fr 1fr !important; }
        }

        /* Portrait tablet: full-width field-narrow */
        @media (max-width: 899px) and (pointer: coarse) and (orientation: portrait) {
          .gn-field-narrow { max-width: 100%; }
          .gn-row { flex-direction: column; }
        }
      `}</style>

      <div className="gn-root">
        <header className="gn-header">
          <div className="gn-header-inner">
            <div className="gn-wordmark" onClick={() => router.push('/')}>
              <span className="gn-wordmark-wav">wav-e</span>
              <span className="gn-wordmark-e"> studios</span>
            </div>
            <span className="gn-page-title">Nieuw gesprek</span>
          </div>
        </header>

        <form className="gn-form" onSubmit={handleSubmit}>

          {/* Lid & datum */}
          <section className="gn-section">
            <span className="gn-section-label">Lid & datum</span>
            <div className="gn-row">
              <div className="gn-field">
                <label className="gn-label">Lid</label>
                <select className="gn-select" value={lidId} onChange={e => setLidId(e.target.value)} required>
                  <option value="">— selecteer lid —</option>
                  {leden.map(l => (
                    <option key={l.id} value={l.id}>{l.voornaam} {l.achternaam} · {l.lid_id}</option>
                  ))}
                </select>
              </div>
              <div className="gn-field gn-field-narrow">
                <label className="gn-label">Datum</label>
                <input type="date" className="gn-input" value={datum} onChange={e => setDatum(e.target.value)} required />
              </div>
            </div>
          </section>

          <div className="gn-divider" />

          {/* Leefstijl scores */}
          <section className="gn-section" style={{ animationDelay: '0.05s' }}>
            <span className="gn-section-label">Leefstijl scores</span>
            <div className="gn-slider-grid">
              {SLIDERS.map(({ key, label, low, high }) => {
                const val = scores[key]
                const sig = STOPLIGHT(key, val)
                const col = COLORS[sig as keyof typeof COLORS]
                return (
                  <div key={key} className="gn-slider-card" style={{ borderColor: col.glow !== 'rgba(168,200,0,0.10)' ? col.glow : 'var(--bg-base)' }}>
                    <div className="gn-slider-top">
                      <span className="gn-slider-label">{label}</span>
                      <span className="gn-slider-value" style={{ color: col.label }}>{val}</span>
                    </div>
                    <input
                      type="range"
                      min={1} max={10}
                      value={val}
                      onChange={e => setScores(s => ({ ...s, [key]: Number(e.target.value) }))}
                      className="gn-slider"
                      style={{ ['--thumb-color' as string]: col.thumb } as React.CSSProperties}
                    />
                    <div className="gn-slider-meta">
                      <span className="gn-slider-hint">{low}</span>
                      <span className="gn-slider-hint">{high}</span>
                    </div>
                    <div className="gn-stoplight-bar" style={{ background: col.track }} />
                  </div>
                )
              })}
            </div>
          </section>

          <div className="gn-divider" />

          {/* Fysiek */}
          <section className="gn-section" style={{ animationDelay: '0.1s' }}>
            <span className="gn-section-label">Fysiek (optioneel)</span>
            <div className="gn-row">
              <div className="gn-field">
                <label className="gn-label">Gewicht (kg)</label>
                <input type="number" step="0.1" min="0" max="300" placeholder="82.5" className="gn-input" value={gewicht} onChange={e => setGewicht(e.target.value)} />
              </div>
              <div className="gn-field">
                <label className="gn-label">Vetpercentage (%)</label>
                <input type="number" step="0.1" min="0" max="100" placeholder="18.0" className="gn-input" value={vetpercentage} onChange={e => setVetpercentage(e.target.value)} />
              </div>
              <div className="gn-field">
                <label className="gn-label">Spiermassa (kg)</label>
                <input type="number" step="0.1" min="0" max="200" placeholder="35.0" className="gn-input" value={spiermassa} onChange={e => setSpiermassa(e.target.value)} />
              </div>
            </div>
          </section>

          <div className="gn-divider" />

          {/* Doelen & notities */}
          <section className="gn-section" style={{ animationDelay: '0.15s' }}>
            <span className="gn-section-label">Doelen & notities</span>

            <div className="gn-doelen-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>

              {/* Doelen behaald */}
              <div className="gn-field">
                <label className="gn-label">Doelen behaald?</label>
                <div className="gn-toggle-group">
                  {([true, false, null] as (boolean | null)[]).map(v => (
                    <button
                      type="button"
                      key={String(v)}
                      className={`gn-toggle-btn${doelen === v ? ' active' : ''}`}
                      onClick={() => setDoelen(v)}
                    >
                      {v === true ? 'Ja' : v === false ? 'Nee' : 'N.v.t.'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tevredenheid */}
              <div className="gn-internal-block" style={{ margin: 0 }}>
                <span className="gn-internal-tag">intern · management</span>
                <div className="gn-slider-top">
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--wave-gray-light)' }}>
                    Tevredenheid over Wav-e
                  </span>
                  <span className="gn-slider-value" style={{ color: tevredenheid >= 7 ? 'var(--green-signal-text)' : tevredenheid >= 5 ? 'var(--amber-text)' : 'var(--red-text)' }}>
                    {tevredenheid}
                  </span>
                </div>
                <input
                  type="range"
                  min={1} max={10}
                  value={tevredenheid}
                  onChange={e => setTevredenheid(Number(e.target.value))}
                  className="gn-slider"
                  style={{ ['--thumb-color' as string]: tevredenheid >= 7 ? 'var(--green-signal)' : tevredenheid >= 5 ? 'var(--amber)' : 'var(--red-danger)' } as React.CSSProperties}
                />
                <div className="gn-slider-meta">
                  <span className="gn-slider-hint">Ontevreden</span>
                  <span className="gn-slider-hint">Zeer tevreden</span>
                </div>
              </div>

            </div>

            <div className="gn-field">
              <label className="gn-label">Notities</label>
              <textarea
                className="gn-textarea"
                placeholder="Wat viel op? Wat heeft de aandacht nodig?"
                value={notities}
                onChange={e => setNotities(e.target.value)}
                rows={5}
              />
            </div>
          </section>

          {error && <div className="gn-error">{error}</div>}

          <div className="gn-submit-row">
            <button type="button" className="gn-cancel-btn" onClick={() => router.back()}>Annuleren</button>
            <button
              type="submit"
              className={`gn-submit-btn${success ? ' success' : ''}`}
              disabled={saving}
            >
              {success ? '✓ Opgeslagen' : saving ? 'Opslaan…' : 'Gesprek opslaan'}
            </button>
          </div>

        </form>
      </div>
    </>
  )
}
