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
  red:   { thumb: '#dc2626', label: '#dc2626', track: '#fca5a5' },
  amber: { thumb: '#d97706', label: '#d97706', track: '#fcd34d' },
  green: { thumb: '#16a34a', label: '#16a34a', track: '#86efac' },
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
    const supabase = getSupabase()
    supabase
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

    // Get next cyclus for this member
    const { data: evalData } = await supabase
      .from('evaluaties')
      .select('cyclus')
      .eq('lid_id', lidId)
      .order('cyclus', { ascending: false })
      .limit(1)
    const cyclus = evalData && evalData.length > 0 ? evalData[0].cyclus + 1 : 1

    const { error: insertError } = await supabase.from('evaluaties').insert({
      lid_id: lidId,
      trainer_id: trainerId,
      cyclus,
      datum,
      slaap: scores.slaap,
      energie: scores.energie,
      stress: scores.stress,
      voeding: scores.voeding,
      beweging: scores.beweging,
      motivatie: scores.motivatie,
      gewicht_kg: gewicht ? parseFloat(gewicht) : null,
      vetpercentage: vetpercentage ? parseFloat(vetpercentage) : null,
      doelen_behaald: doelen,
      notities: notities || null,
    })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/'), 1200)
  }

  if (loading) return (
    <div style={styles.loadWrap}>
      <span style={styles.loadDot} />
    </div>
  )

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.wordmark} onClick={() => router.push('/')}>WAV-E</span>
          <span style={styles.pageTitle}>Nieuw gesprek</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} style={styles.form}>

        <section style={styles.section}>
          <h2 style={styles.sectionLabel}>Lid & datum</h2>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Lid</label>
              <select
                style={styles.select}
                value={lidId}
                onChange={e => setLidId(e.target.value)}
                required
              >
                <option value="">— selecteer lid —</option>
                {leden.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.voornaam} {l.achternaam} · {l.lid_id}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ ...styles.field, maxWidth: 180 }}>
              <label style={styles.label}>Datum</label>
              <input
                type="date"
                style={styles.input}
                value={datum}
                onChange={e => setDatum(e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <div style={styles.divider} />

        <section style={styles.section}>
          <h2 style={styles.sectionLabel}>Leefstijl scores</h2>
          <div style={styles.sliderGrid}>
            {SLIDERS.map(({ key, label, low, high }) => {
              const val = scores[key]
              const sig = STOPLIGHT(key, val)
              const col = COLORS[sig as keyof typeof COLORS]
              return (
                <div key={key} style={styles.sliderCard}>
                  <div style={styles.sliderTop}>
                    <span style={styles.sliderLabel}>{label}</span>
                    <span style={{ ...styles.sliderValue, color: col.label }}>{val}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={val}
                    onChange={e => setScores(s => ({ ...s, [key]: Number(e.target.value) }))}
                    style={{ ...styles.slider, accentColor: col.thumb }}
                  />
                  <div style={styles.sliderMeta}>
                    <span style={styles.sliderHint}>{low}</span>
                    <span style={styles.sliderHint}>{high}</span>
                  </div>
                  <div style={{ ...styles.stoplightBar, background: col.track }} />
                </div>
              )
            })}
          </div>
        </section>

        <div style={styles.divider} />

        <section style={styles.section}>
          <h2 style={styles.sectionLabel}>Fysiek (optioneel)</h2>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Gewicht (kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="300"
                placeholder="82.5"
                style={styles.input}
                value={gewicht}
                onChange={e => setGewicht(e.target.value)}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Vetpercentage (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="18.0"
                style={styles.input}
                value={vetpercentage}
                onChange={e => setVetpercentage(e.target.value)}
              />
            </div>
          </div>
        </section>

        <div style={styles.divider} />

        <section style={styles.section}>
          <h2 style={styles.sectionLabel}>Doelen & notities</h2>
          <div style={styles.field}>
            <label style={styles.label}>Doelen behaald?</label>
            <div style={styles.toggleGroup}>
              {([true, false, null] as (boolean | null)[]).map((v) => (
                <button
                  type="button"
                  key={String(v)}
                  style={{
                    ...styles.toggleBtn,
                    ...(doelen === v ? styles.toggleBtnActive : {}),
                  }}
                  onClick={() => setDoelen(v)}
                >
                  {v === true ? 'Ja' : v === false ? 'Nee' : 'N.v.t.'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ ...styles.field, marginTop: 20 }}>
            <label style={styles.label}>Notities</label>
            <textarea
              style={styles.textarea}
              placeholder="Wat viel op? Wat heeft de aandacht nodig?"
              value={notities}
              onChange={e => setNotities(e.target.value)}
              rows={5}
            />
          </div>
        </section>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.submitRow}>
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={() => router.back()}
          >
            Annuleren
          </button>
          <button
            type="submit"
            style={{
              ...styles.submitBtn,
              ...(success ? styles.submitSuccess : {}),
            }}
            disabled={saving}
          >
            {success ? '✓ Opgeslagen' : saving ? 'Opslaan...' : 'Gesprek opslaan'}
          </button>
        </div>

      </form>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#e8e6e0',
    fontFamily: '"DM Mono", "Courier New", monospace',
  },
  header: {
    borderBottom: '1px solid #222',
    padding: '0 32px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    background: '#0a0a0a',
    zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 20,
    maxWidth: 860,
    width: '100%',
    margin: '0 auto',
  },
  wordmark: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.2em',
    color: '#fff',
    cursor: 'pointer',
  },
  pageTitle: {
    fontSize: 13,
    color: '#555',
    letterSpacing: '0.05em',
  },
  form: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '48px 32px 120px',
  },
  section: { marginBottom: 0 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: '#555',
    textTransform: 'uppercase' as const,
    marginBottom: 24,
    marginTop: 0,
  },
  divider: {
    height: 1,
    background: '#1a1a1a',
    margin: '40px 0',
  },
  row: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap' as const,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    minWidth: 200,
  },
  label: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
    letterSpacing: '0.05em',
  },
  select: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 6,
    color: '#e8e6e0',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  },
  input: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 6,
    color: '#e8e6e0',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  },
  sliderGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 20,
  },
  sliderCard: {
    background: '#111',
    border: '1px solid #1c1c1c',
    borderRadius: 10,
    padding: '18px 20px 14px',
  },
  sliderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#ccc',
    fontWeight: 500,
  },
  sliderValue: {
    fontSize: 22,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    transition: 'color 0.2s',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    height: 4,
    marginBottom: 8,
  },
  sliderMeta: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  sliderHint: {
    fontSize: 11,
    color: '#444',
  },
  stoplightBar: {
    height: 3,
    borderRadius: 2,
    marginTop: 12,
    transition: 'background 0.3s',
  },
  toggleGroup: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  toggleBtn: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 6,
    color: '#555',
    padding: '8px 20px',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  toggleBtnActive: {
    background: '#1a1a1a',
    border: '1px solid #444',
    color: '#e8e6e0',
  },
  textarea: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 6,
    color: '#e8e6e0',
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical' as const,
    lineHeight: 1.6,
  },
  errorBox: {
    background: '#1a0808',
    border: '1px solid #441010',
    borderRadius: 6,
    color: '#f87171',
    padding: '12px 16px',
    fontSize: 13,
    marginBottom: 24,
  },
  submitRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 48,
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid #222',
    borderRadius: 6,
    color: '#555',
    padding: '12px 24px',
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  submitBtn: {
    background: '#fff',
    border: 'none',
    borderRadius: 6,
    color: '#000',
    padding: '12px 32px',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.2s',
  },
  submitSuccess: {
    background: '#16a34a',
    color: '#fff',
  },
  loadWrap: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#333',
  },
}
