'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
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
  red:   { thumb: '#dc2626', label: '#f87171', track: 'rgba(220,38,38,0.25)',  glow: 'rgba(220,38,38,0.12)'  },
  amber: { thumb: '#d97706', label: '#fbbf24', track: 'rgba(217,119,6,0.25)', glow: 'rgba(217,119,6,0.10)'  },
  green: { thumb: '#16a34a', label: '#4ade80', track: 'rgba(22,163,74,0.25)', glow: 'rgba(22,163,74,0.10)'  },
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
  const [doelen, setDoelen] = useState<boolean | null>(null)
  const [notities, setNotities] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({
    slaap: 5, energie: 5, stress: 5, voeding: 5, beweging: 5, motivatie: 5,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('lid_id')
    if (prefill) setLidId(prefill)

    getSupabase()
      .from('leden')
      .select('id, lid_id, voornaam, achternaam')
      .eq('actief', true)
      .order('achternaam')
      .then(({ data }) => {
        setLeden(data ?? [])
        setLoading(false)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lidId) { setError('Selecteer een lid.'); return }
    setSaving(true)
    setError(null)

    const supabase = getSupabase()
    const { data: trainerData } = await supabase.from('trainers').select('id').limit(1)
    const trainerId = trainerData?.[0]?.id
    if (!trainerId) { setError('Geen trainer gevonden.'); setSaving(false); return }

    const { data: evalData } = await supabase
      .from('evaluaties').select('cyclus').eq('lid_id', lidId)
      .order('cyclus', { ascending: false }).limit(1)
    const cyclus = evalData && evalData.length > 0 ? evalData[0].cyclus + 1 : 1

    const { error: insertError } = await supabase.from('evaluaties').insert({
      lid_id: lidId, trainer_id: trainerId, cyclus, datum,
      slaap: scores.slaap, energie: scores.energie, stress: scores.stress,
      voeding: scores.voeding, beweging: scores.beweging, motivatie: scores.motivatie,
      gewicht_kg: gewicht ? parseFloat(gewicht) : null,
      vetpercentage: vetpercentage ? parseFloat(vetpercentage) : null,
      doelen_behaald: doelen,
      notities: notities || null,
    })

    if (insertError) { setError(insertError.message); setSaving(false); return }
    setSuccess(true)
    setTimeout(() => router.push('/'), 1200)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#A8C800', boxShadow: '0 0 12px rgba(168,200,0,0.5)' }} />
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        .gn-root {
          min-height: 100vh;
          background: #111;
          color: #c8c6c0;
          font-family: 'Raleway', sans-serif;
          position: relative;
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

        /* Header */
        .gn-header {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 2rem;
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
        .gn-wordmark-wav { font-size: 1rem; font-weight: 700; color: #B4B4B4; letter-spacing: -0.01em; }
        .gn-wordmark-e   { font-size: 1rem; font-weight: 700; color: #A8C800; letter-spacing: -0.01em; }

        .gn-page-title {
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #B4B4B4;
        }

        /* Form */
        .gn-form {
          max-width: 860px;
          margin: 0 auto;
          padding: 2.5rem 2rem 6rem;
          position: relative;
          z-index: 1;
        }

        /* Section */
        .gn-section { margin-bottom: 0; animation: gnFadeUp 0.4s ease-out both; }

        .gn-section-label {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: #B4B4B4;
          text-transform: uppercase;
          margin-bottom: 1.25rem;
          margin-top: 0;
          display: block;
        }

        .gn-divider {
          height: 1px;
          background: #2a2a2a;
          margin: 2.5rem 0;
        }

        /* Row / Field */
        .gn-row { display: flex; gap: 16px; flex-wrap: wrap; }
        .gn-field { display: flex; flex-direction: column; flex: 1; min-width: 200px; }
        .gn-field-narrow { max-width: 200px; }

        .gn-label {
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #B4B4B4;
          margin-bottom: 7px;
        }

        .gn-select, .gn-input, .gn-textarea {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          color: #c8c6c0;
          padding: 10px 12px;
          font-size: 0.875rem;
          font-family: 'Raleway', sans-serif;
          font-weight: 400;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .gn-select:focus, .gn-input:focus, .gn-textarea:focus {
          border-color: #A8C800;
          box-shadow: 0 0 0 3px rgba(168,200,0,0.08);
        }
        .gn-select option { background: #141414; }
        .gn-textarea { resize: vertical; line-height: 1.6; }

        /* Slider grid */
        .gn-slider-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 12px;
        }

        .gn-slider-card {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          padding: 18px 18px 14px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }

        .gn-slider-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        }

        .gn-slider-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 14px;
        }

        .gn-slider-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: #B4B4B4;
          letter-spacing: 0.02em;
        }

        .gn-slider-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          transition: color 0.2s;
        }

        .gn-slider {
          width: 100%;
          cursor: pointer;
          height: 3px;
          margin-bottom: 8px;
          appearance: none;
          -webkit-appearance: none;
          background: #1e1e1e;
          border-radius: 2px;
          outline: none;
        }
        .gn-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--thumb-color, #A8C800);
          cursor: pointer;
          transition: transform 0.15s;
          box-shadow: 0 0 6px rgba(0,0,0,0.5);
        }
        .gn-slider::-webkit-slider-thumb:hover { transform: scale(1.25); }
        .gn-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: none;
          background: var(--thumb-color, #A8C800);
          cursor: pointer;
        }

        .gn-slider-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .gn-slider-hint {
          font-size: 0.6rem;
          color: #B4B4B4;
          letter-spacing: 0.04em;
        }

        .gn-stoplight-bar {
          height: 2px;
          border-radius: 1px;
          transition: background 0.3s;
        }

        /* Toggle */
        .gn-toggle-group { display: flex; gap: 6px; margin-top: 4px; }

        .gn-toggle-btn {
          background: #141414;
          border: 1px solid #1e1e1e;
          border-radius: 3px;
          color: #B4B4B4;
          padding: 8px 20px;
          font-size: 0.8rem;
          font-family: 'Raleway', sans-serif;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: all 0.15s;
        }
        .gn-toggle-btn:hover { border-color: rgba(168,200,0,0.3); color: #B4B4B4; }
        .gn-toggle-btn.active {
          background: #1a1a1a;
          border-color: rgba(168,200,0,0.5);
          color: #A8C800;
        }

        /* Error */
        .gn-error {
          background: rgba(220,38,38,0.07);
          border: 1px solid rgba(220,38,38,0.2);
          border-radius: 3px;
          color: #f87171;
          padding: 12px 16px;
          font-size: 0.82rem;
          margin-bottom: 1.5rem;
          letter-spacing: 0.02em;
        }

        /* Submit row */
        .gn-submit-row {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 3rem;
        }

        .gn-cancel-btn {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 22px;
          border-radius: 3px;
          border: 1px solid #1e1e1e;
          background: transparent;
          color: #B4B4B4;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .gn-cancel-btn:hover { border-color: rgba(168,200,0,0.3); color: #666; }

        .gn-submit-btn {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 10px 28px;
          border-radius: 3px;
          border: 1px solid #A8C800;
          background: #A8C800;
          color: #111;
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .gn-submit-btn:hover:not(:disabled) {
          background: #95B400;
          box-shadow: 0 4px 16px rgba(168,200,0,0.35);
          transform: translateY(-1px);
        }
        .gn-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .gn-submit-btn.success {
          background: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }

        @keyframes gnFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
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
                  <div key={key} className="gn-slider-card" style={{ borderColor: col.glow !== 'rgba(168,200,0,0.10)' ? col.glow : '#1e1e1e' }}>
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
            </div>
          </section>

          <div className="gn-divider" />

          {/* Doelen & notities */}
          <section className="gn-section" style={{ animationDelay: '0.15s' }}>
            <span className="gn-section-label">Doelen & notities</span>
            <div className="gn-field" style={{ marginBottom: '1.5rem' }}>
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
