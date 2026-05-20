'use client'

/*
 * Trainerdashboard
 *
 * Wat doet deze pagina:
 * Deze pagina toont het dashboard van een trainer met leden, stoplichten en acties. De trainer kan vanuit hier leden openen en nieuwe leden toevoegen.
 *
 * Data:
 * Leest en schrijft: trainers, leden, contact_momenten, evaluaties, acties.
 *
 * Toegang:
 * trainer
 *
 * Gerelateerde API routes:
 * Geen.
 */

import { useState, useEffect, useRef } from 'react'
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

type UrgenteMelding = {
  id: string
  lid_id: string
  lid_naam: string
  tekst: string
  auteur_naam: string
  aangemaakt_op: string
}

type TrainerNotitie = {
  id: string
  trainer_id: string
  lid_id: string | null
  auteur_id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  auteur_naam: string
  tekst: string
  aangemaakt_op: string
  gelezen_door_management: boolean
  gelezen_op: string | null
}

interface MomentumProps {
  gesprekken: number
  actiesAfgerond: number
  // v0.2: sessiesGegeven will be added here when Onlineafspraken.nl integration lands
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for planned action deadline UI.
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for planned action deadline UI.
const getActieDeadlineLabel = (actie: Actie, today = todayIsoDate()) => {
  if (actie.status === 'afgerond') return null
  const deadline = getIsoDatePart(actie.deadline)
  if (!deadline) return null
  if (actie.status === 'open' && deadline < today) return { text: 'VERLOPEN', tone: 'overdue' as const }
  if (deadline === today) return { text: 'Vandaag', tone: 'today' as const }
  const formatted = formatDeadlineDate(deadline)
  return formatted ? { text: `Deadline: ${formatted}`, tone: 'neutral' as const } : null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for planned action sorting UI.
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

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function MomentumStrip({ gesprekken, actiesAfgerond }: MomentumProps) {
  const [dispGesprekken, setDispGesprekken] = useState(0)
  const [dispActies, setDispActies] = useState(0)

  useEffect(() => {
    if (gesprekken === 0 && actiesAfgerond === 0) return
    const duration = 800
    const steps = 40
    const interval = duration / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      const t = step / steps
      const eased = 1 - Math.pow(1 - t, 3)
      setDispGesprekken(Math.round(eased * gesprekken))
      setDispActies(Math.round(eased * actiesAfgerond))
      if (step >= steps) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [gesprekken, actiesAfgerond])

  const maand = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][new Date().getMonth()]

  return (
    <div className="td-momentum">
      <div className="td-momentum-label">Deze maand · {maand}</div>
      <div className="td-momentum-counters">
        <div className="td-momentum-item">
          <span className="td-momentum-number">{dispGesprekken}</span>
          <span className="td-momentum-sublabel">Gesprekken</span>
        </div>
        <div className="td-momentum-divider" />
        <div className="td-momentum-item">
          <span className="td-momentum-number">{dispActies}</span>
          <span className="td-momentum-sublabel">Acties afgerond</span>
        </div>
        {/* v0.2 slot: sessiesGegeven counter goes here */}
      </div>
    </div>
  )
}

// ── Add Lid Modal (trainer version) ───────────────────────────────────

function AddLidModal({
  trainerId,
  onClose,
  onSaved,
}: {
  trainerId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [nextLidId,   setNextLidId]   = useState('')
  const [lidId,       setLidId]       = useState('')
  const [voornaam,    setVoornaam]    = useState('')
  const [achternaam,  setAchternaam]  = useState('')
  const [email,       setEmail]       = useState('')
  const [telefoon,    setTelefoon]    = useState('')
  const [startdatum,  setStartdatum]  = useState(new Date().toISOString().split('T')[0])
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [loadingId,   setLoadingId]   = useState(true)

  useEffect(() => {
    const fetchNextId = async () => {
      const res = await fetch(`/api/trainer/${trainerId}/next-lid-id`)
      const data = res.ok ? await res.json() : { nextLidId: 'WE-001' }
      const next = data.nextLidId ?? 'WE-001'
      setNextLidId(next)
      setLidId(next)
      setLoadingId(false)
    }
    fetchNextId()
  }, [])

  const save = async () => {
    setError(null)
    if (!lidId.trim())      { setError('Lid-ID is verplicht'); return }
    if (!voornaam.trim())   { setError('Voornaam is verplicht'); return }
    if (!achternaam.trim()) { setError('Achternaam is verplicht'); return }

    setSaving(true)
    const res = await fetch(`/api/trainer/${trainerId}/leden`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lid_id: lidId,
        voornaam,
        achternaam,
        email,
        telefoon,
        startdatum,
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Lid aanmaken mislukt')
      return
    }
    onSaved()
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-pressed)',
    border: '1px solid var(--border-muted-dark)',
    borderRadius: 3,
    padding: '10px 12px',
    color: 'var(--text-warm)',
    fontSize: '1rem',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: "'Raleway', sans-serif",
    minHeight: 44,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 600,
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface-dark)', border: '1px solid var(--border-muted-dark)', borderRadius: 6, padding: '28px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-warm)' }}>Nieuw lid toevoegen</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: 4, letterSpacing: '0.05em' }}>Dit lid wordt aan jou gekoppeld</div>
        </div>

        {loadingId ? (
          <div style={{ color: 'var(--text-faint)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>Laden…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Lid-ID</label>
                <input type="text" value={lidId} onChange={e => setLidId(e.target.value)} placeholder={nextLidId} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Startdatum</label>
                <input type="date" value={startdatum} onChange={e => setStartdatum(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Voornaam</label>
                <input type="text" value={voornaam} onChange={e => setVoornaam(e.target.value)} placeholder="Jana" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Achternaam</label>
                <input type="text" value={achternaam} onChange={e => setAchternaam(e.target.value)} placeholder="de Wit" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Email (optioneel)</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jana@example.com" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Telefoon (optioneel)</label>
                <input type="tel" value={telefoon} onChange={e => setTelefoon(e.target.value)} placeholder="06 12345678" style={inputStyle} />
              </div>
            </div>

            {error && (
              <div style={{ fontSize: '0.8rem', color: 'var(--red-text)', padding: '10px 14px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 3 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                className="td-btn-secondary"
              >
                Annuleren
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="td-btn-primary"
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Opslaan…' : 'Lid toevoegen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function TrainerDashboard() {
  const { trainerId } = useParams()
  const router = useRouter()

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [leden, setLeden] = useState<Lid[]>([])
  const [acties, setActies] = useState<Actie[]>([])
  const [ledenDropdown, setLedenDropdown] = useState<LidDropdown[]>([])
  const [loading, setLoading] = useState(true)
  const [gesprekOpen, setGesprekOpen] = useState(false)
  const [openStoplight, setOpenStoplight] = useState<'red' | 'amber' | 'green' | null>(null)
  const [showAddLid, setShowAddLid] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [momentum, setMomentum] = useState<MomentumProps>({ gesprekken: 0, actiesAfgerond: 0 })
  const [meldingen, setMeldingen] = useState<UrgenteMelding[]>([])
  const [meldingenLoading, setMeldingenLoading] = useState(true)
  const [berichten, setBerichten] = useState<TrainerNotitie[]>([])
  const [berichtenLoading, setBerichtenLoading] = useState(true)
  const [berichtTekst, setBerichtTekst] = useState('')
  const [berichtenMax, setBerichtenMax] = useState(5)
  const [berichtPosting, setBerichtPosting] = useState(false)

  const gesprekRef = useRef<HTMLDivElement>(null)
  const stoplichtRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/trainer/${trainerId}/dashboard`)
        if (!res.ok) throw new Error('Dashboard ophalen mislukt')
        const data = await res.json()
        setTrainer(data.trainer)
        setLedenDropdown(data.ledenDropdown ?? [])
        setLeden(data.leden ?? [])
        setActies(data.acties ?? [])
        setMomentum(data.momentum ?? { gesprekken: 0, actiesAfgerond: 0 })
        setMeldingen(data.meldingen ?? [])
      } catch {
        setTrainer(null)
        setLedenDropdown([])
        setLeden([])
        setActies([])
        setMomentum({ gesprekken: 0, actiesAfgerond: 0 })
        setMeldingen([])
      } finally {
        setMeldingenLoading(false)
        setLoading(false)
      }
    }
    if (trainerId) load()
  }, [trainerId, refreshKey])

  useEffect(() => {
    const fetchBerichten = async () => {
      setBerichtenLoading(true)
      try {
        const res = await fetch(`/api/trainer-notities/${trainerId}`)
        if (!res.ok) throw new Error('Ophalen mislukt')
        const data = await res.json()
        setBerichten(data.notities ?? [])
      } catch {
        setBerichten([])
      } finally {
        setBerichtenLoading(false)
      }
    }

    if (trainerId) fetchBerichten()
  }, [trainerId])

  // Close dropdowns on outside tap/click
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (gesprekRef.current && !gesprekRef.current.contains(e.target as Node)) setGesprekOpen(false)
      if (stoplichtRef.current && !stoplichtRef.current.contains(e.target as Node)) setOpenStoplight(null)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const handleGesprekSelect = (lid: LidDropdown) => {
    setGesprekOpen(false)
    router.push(`/gesprek/new?lid_id=${lid.id}`)
  }

  const markGezien = async (notitieId: string, lidId: string) => {
    setMeldingen(prev => prev.filter(m => m.id !== notitieId))
    try {
      const res = await fetch(`/api/notities/${lidId}/${notitieId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gezien: true }),
      })
      if (!res.ok) throw new Error('Markeren mislukt')
    } catch {
      // Optimistic removal is acceptable for this dashboard; a refresh will reconcile state.
    }
  }

  const postBericht = async () => {
    if (!berichtTekst.trim() || berichtTekst.length > 1000) return
    setBerichtPosting(true)

    try {
      const res = await fetch(`/api/trainer-notities/${trainerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tekst: berichtTekst.trim() }),
      })
      if (!res.ok) return

      const data = await res.json()
      const bericht = (data.notitie ?? data) as TrainerNotitie
      setBerichten(prev => [...prev, bericht])
      setBerichtTekst('')
    } finally {
      setBerichtPosting(false)
    }
  }

  const deleteBericht = async (notitieId: string) => {
    const previous = berichten
    setBerichten(prev => prev.filter(b => b.id !== notitieId))
    try {
      const res = await fetch(`/api/trainer-notities/${trainerId}/${notitieId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
    } catch {
      setBerichten(previous)
    }
  }

  const counts = {
    red:   leden.filter(l => getLidStoplight(l) === 'red').length,
    amber: leden.filter(l => getLidStoplight(l) === 'amber').length,
    green: leden.filter(l => getLidStoplight(l) === 'green').length,
  }

  const ledenByStoplight = (sig: 'red' | 'amber' | 'green') => leden.filter(l => getLidStoplight(l) === sig)

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

        /* ── Buttons ── */
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

        .td-btn-primary {
          font-family: 'Raleway', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 16px;
          min-height: 44px;
          border-radius: 3px;
          border: 1px solid var(--wave-green);
          background: var(--wave-green);
          color: var(--color-black-soft);
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
          white-space: nowrap;
          touch-action: manipulation;
        }
        .td-btn-primary:hover {
          background: var(--wave-green-hover);
          box-shadow: 0 4px 14px rgba(168,200,0,0.3);
        }
        .td-btn-primary:active {
          background: var(--wave-green-active);
          transform: scale(0.97);
        }

        /* ── Dropdown ── */
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

        /* ── Body ── */
        .td-body {
          max-width: var(--app-shell-max);
          margin: 0 auto;
          padding: 32px var(--app-shell-padding) 6rem;
          position: relative;
          z-index: 1;
        }

        .td-greeting {
          margin-bottom: 2rem;
          animation: fadeUp 0.5s ease-out both;
        }

        .td-greeting-text {
          font-size: 1.55rem; font-weight: 700; color: var(--text-warm);
          letter-spacing: -0.01em; line-height: 1.2;
        }

        .td-greeting-sub {
          font-size: 0.72rem; color: var(--text-faint);
          letter-spacing: 0.08em; margin-top: 4px; text-transform: uppercase;
        }

        .td-momentum {
          margin-bottom: 2rem;
          padding: 20px 24px;
          border-radius: 4px;
          border: 1px solid rgba(168,200,0,0.18);
          background: rgba(168,200,0,0.05);
          animation: fadeUp 0.5s ease-out 0.08s both;
          position: relative;
          overflow: hidden;
        }

        .td-momentum::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(168,200,0,0.5), transparent);
        }

        .td-momentum-label {
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--wave-green); margin-bottom: 12px; opacity: 0.7;
        }

        .td-momentum-counters {
          display: flex; align-items: center;
        }

        .td-momentum-item {
          display: flex; flex-direction: column; gap: 3px; flex: 1;
        }

        .td-momentum-number {
          font-size: 2.4rem; font-weight: 700; letter-spacing: -0.03em;
          line-height: 1; color: var(--wave-green); font-variant-numeric: tabular-nums;
        }

        .td-momentum-sublabel {
          font-size: 0.68rem; color: var(--text-faint);
          letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;
        }

        .td-momentum-divider {
          width: 1px; height: 48px;
          background: rgba(168,200,0,0.15); margin: 0 28px; flex-shrink: 0;
        }

        /* ── Stoplight bar ── */
        .td-summary-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          align-items: flex-start;
          animation: fadeUp 0.4s ease-out 0.14s both;
          position: relative;
          z-index: 10;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .td-summary-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          min-height: 48px;
          border-radius: 3px;
          font-family: 'Raleway', sans-serif;
          transition: all 0.2s ease;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.03);
          touch-action: manipulation;
        }

        .td-summary-card.clickable:active {
          transform: scale(0.97);
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
          color: var(--text-faint);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 500;
        }

        .td-summary-chevron {
          font-size: 0.6rem;
          color: var(--border-muted-dark);
          margin-left: 2px;
        }

        .td-summary-total {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          margin-left: auto;
        }

        /* ── Stoplight dropdown panel ── */
        .td-stoplight-panel {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          background: var(--surface-dark);
          border: 1px solid var(--border-muted-dark);
          border-radius: 4px;
          min-width: 220px;
          z-index: 200;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          animation: dropIn 0.15s ease-out both;
        }

        /* Portal action grid */
        .td-portal-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 2rem;
          animation: fadeUp 0.5s ease-out 0.18s both;
        }

        .td-portal-tile {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 22px;
          min-height: 72px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          text-align: left;
          font-family: 'Raleway', sans-serif;
          transition: border-color 0.15s, background 0.15s, transform 0.1s;
          touch-action: manipulation;
          width: 100%;
          position: relative;
        }

        .td-portal-tile:hover {
          border-color: rgba(168,200,0,0.25);
          background: rgba(168,200,0,0.05);
        }

        .td-portal-tile:active {
          transform: scale(0.98);
          background: rgba(168,200,0,0.08);
        }

        .td-portal-tile--primary {
          border-color: rgba(168,200,0,0.3);
          background: rgba(168,200,0,0.07);
        }

        .td-portal-tile--primary:hover {
          border-color: rgba(168,200,0,0.5);
          background: rgba(168,200,0,0.11);
          box-shadow: 0 4px 20px rgba(168,200,0,0.12);
        }

        .td-portal-tile-icon {
          font-size: 1.3rem;
          color: var(--wave-green);
          flex-shrink: 0;
          width: 28px;
          text-align: center;
          opacity: 0.8;
        }

        .td-portal-tile-body {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .td-portal-tile-label {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-warm);
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        .td-portal-tile-sub {
          font-size: 0.65rem;
          color: var(--text-faint);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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

        .td-empty {
          font-size: 0.85rem;
          color: var(--text-faint);
          letter-spacing: 0.04em;
        }

        .td-melding-card {
          padding: 14px 18px;
          margin-bottom: 8px;
          border-radius: 3px;
          background: rgba(217,119,6,0.06);
          border: 1px solid rgba(217,119,6,0.2);
          border-left: 3px solid rgba(217,119,6,0.6);
          animation: fadeUp 0.3s ease-out both;
        }

        .td-melding-lid {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--amber-text);
          margin-bottom: 4px;
        }

        .td-melding-tekst {
          font-size: 0.88rem;
          color: var(--text-warm);
          line-height: 1.5;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .td-melding-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 8px;
        }

        .td-melding-meta {
          font-size: 0.62rem;
          color: var(--text-faint);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .td-melding-gezien {
          font-family: 'Raleway', sans-serif;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--wave-green);
          background: rgba(168,200,0,0.08);
          border: 1px solid rgba(168,200,0,0.25);
          border-radius: 2px;
          padding: 4px 10px;
          cursor: pointer;
          min-height: 32px;
          touch-action: manipulation;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .td-melding-gezien:hover { background: rgba(168,200,0,0.14); }
        .td-melding-gezien:active { background: rgba(168,200,0,0.20); }

        .td-bericht-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin-bottom: 1rem;
        }

        .td-bericht-card {
          padding: 12px 16px;
          border-radius: 3px;
          border: 1px solid rgba(255,255,255,0.04);
          position: relative;
        }

        .td-bericht-card-self {
          background: rgba(168,200,0,0.04);
          border-left: 3px solid rgba(168,200,0,0.35);
        }

        .td-bericht-card-other {
          background: rgba(99,102,241,0.05);
          border-left: 3px solid rgba(99,102,241,0.5);
        }

        .td-bericht-tekst {
          font-size: 0.85rem;
          color: var(--text-dim);
          line-height: 1.5;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .td-bericht-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 6px;
        }

        .td-bericht-meta,
        .td-bericht-older {
          font-size: 0.62rem;
          color: var(--text-faint);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .td-bericht-older {
          padding: 6px 0;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
        }

        .td-bericht-delete {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.72rem;
          color: var(--text-faint);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-family: inherit;
          padding: 4px 0;
          min-height: 32px;
          touch-action: manipulation;
        }

        .td-bericht-form {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .td-bericht-input {
          flex: 1;
          resize: none;
          background: var(--surface-pressed);
          border: 1px solid var(--border-muted-dark);
          border-radius: 3px;
          padding: 10px 12px;
          color: var(--text-warm);
          font-size: 1rem;
          font-family: inherit;
          min-height: 44px;
        }

        .td-bericht-count {
          width: 100%;
          text-align: right;
          font-size: 0.62rem;
          color: var(--text-faint);
          letter-spacing: 0.06em;
        }

        /* ── Tablet breakpoint ── */
        @media (min-width: 768px) and (pointer: coarse) {
          .td-header { height: 64px; padding: 0 2rem; }

          .td-btn-secondary,
          .td-btn-primary {
            padding: 12px 20px;
            min-height: 48px;
            font-size: 0.78rem;
          }

          .td-body { padding: 32px 24px 6rem; }

          .td-momentum-number { font-size: 3rem; }

          .td-summary-card { padding: 16px 20px; min-height: 56px; }

          .td-dropdown-item { padding: 16px 20px; min-height: 54px; }
          .td-dropdown-name { font-size: 0.95rem; }

          .td-portal-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .td-portal-tile { padding: 24px 26px; min-height: 80px; }
          .td-portal-tile-label { font-size: 0.95rem; }
          .td-portal-tile-icon { font-size: 1.5rem; width: 32px; }

          .td-melding-card { padding: 16px 20px; }
          .td-melding-tekst { font-size: 0.92rem; }

          .td-stoplight-panel { min-width: 260px; }
          .td-dropdown { min-width: 280px; }
        }

        /* ── Landscape tablet ── */
        @media (min-width: 900px) and (pointer: coarse) and (orientation: landscape) {
          .td-trainer-name { display: inline; }
        }

        /* ── Portrait tablet ── */
        @media (max-width: 899px) and (pointer: coarse) and (orientation: portrait) {
          .td-trainer-name { display: none; }
          .td-header-right { gap: 8px; }
          .td-btn-secondary,
          .td-btn-primary { padding: 10px 12px; font-size: 0.7rem; }
          .td-portal-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .td-portal-tile { padding: 18px 16px; min-height: 68px; gap: 12px; }
        }
      `}</style>

      <div className="td-root">
        <Navigation />

        {/* Add Lid Modal */}
        {showAddLid && (
          <AddLidModal
            trainerId={trainerId as string}
            onClose={() => setShowAddLid(false)}
            onSaved={() => setRefreshKey(k => k + 1)}
          />
        )}

        <div className="td-body">
          {!loading && trainer && (
            <div className="td-greeting">
              <div className="td-greeting-text">{greeting()}, {trainer.naam.split(' ')[0]}.</div>
              <div className="td-greeting-sub">Hier is je overzicht voor vandaag</div>
            </div>
          )}

          {!loading && (
            <MomentumStrip
              gesprekken={momentum.gesprekken}
              actiesAfgerond={momentum.actiesAfgerond}
            />
          )}

          {/* Stoplight summary bar */}
          {!loading && (
            <div className="td-summary-bar" ref={stoplichtRef}>
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
                        background: isOpen ? col.bg : 'rgba(255,255,255,0.03)',
                        borderColor: isOpen ? col.border : 'rgba(255,255,255,0.06)',
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

              {/* Green */}
              {(() => {
                const col = STOPLIGHT.green
                const isOpen = openStoplight === 'green'
                const members = ledenByStoplight('green')
                const isClickable = counts.green > 0
                return (
                  <div style={{ position: 'relative' }}>
                    <button
                      className={`td-summary-card${isClickable ? ' clickable' : ''}`}
                      style={{
                        background: isOpen ? col.bg : 'rgba(255,255,255,0.03)',
                        borderColor: isOpen ? col.border : 'rgba(255,255,255,0.06)',
                        cursor: isClickable ? 'pointer' : 'default',
                      }}
                      onClick={() => isClickable && setOpenStoplight(isOpen ? null : 'green')}
                    >
                      <span className="td-dot" style={{ background: col.dot }} />
                      <span className="td-summary-count" style={{ color: col.text }}>{counts.green}</span>
                      <span className="td-summary-label">Op koers</span>
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
              })()}

              <div className="td-summary-total">
                <span className="td-summary-count" style={{ color: 'var(--text-faint)' }}>{leden.length}</span>
                <span className="td-summary-label">Actieve leden</span>
              </div>
            </div>
          )}

          {/* Portal action grid */}
          {!loading && (
            <div className="td-portal-grid">
              <div style={{ position: 'relative' }} ref={gesprekRef}>
                <button
                  className="td-portal-tile td-portal-tile--primary"
                  onClick={() => setGesprekOpen(o => !o)}
                >
                  <span className="td-portal-tile-icon">↗</span>
                  <div className="td-portal-tile-body">
                    <span className="td-portal-tile-label">Nieuw gesprek</span>
                    <span className="td-portal-tile-sub">Start een cyclus</span>
                  </div>
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

              <button
                className="td-portal-tile"
                onClick={() => router.push(`/trainer/${trainerId}/acties`)}
              >
                <span className="td-portal-tile-icon">✓</span>
                <div className="td-portal-tile-body">
                  <span className="td-portal-tile-label">Open acties</span>
                  <span className="td-portal-tile-sub">
                    {acties.length === 0
                      ? 'Alles afgerond'
                      : `${acties.length} open${acties.some(a => {
                          const d = a.deadline?.slice(0, 10) ?? null
                          return d !== null && d < todayIsoDate()
                        }) ? ' · let op verlopen' : ''}`
                    }
                  </span>
                </div>
              </button>

              <button
                className="td-portal-tile"
                onClick={() => router.push(`/trainer/${trainerId}/leden`)}
              >
                <span className="td-portal-tile-icon">◈</span>
                <div className="td-portal-tile-body">
                  <span className="td-portal-tile-label">Mijn leden</span>
                  <span className="td-portal-tile-sub">{leden.length} actief</span>
                </div>
              </button>

              <button
                className="td-portal-tile"
                onClick={() => setShowAddLid(true)}
              >
                <span className="td-portal-tile-icon">+</span>
                <div className="td-portal-tile-body">
                  <span className="td-portal-tile-label">Nieuw lid</span>
                  <span className="td-portal-tile-sub">Lid toevoegen</span>
                </div>
              </button>
            </div>
          )}

          {/* Urgente meldingen */}
          {!meldingenLoading && meldingen.length > 0 && (
            <div style={{ marginBottom: '2rem', animation: 'fadeUp 0.5s ease-out 0.22s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
                <span className="td-section-title">Urgente meldingen</span>
                <span className="td-section-count">{meldingen.length}</span>
              </div>
              {meldingen.map(melding => (
                <div key={melding.id} className="td-melding-card">
                  <div className="td-melding-lid">{melding.lid_naam}</div>
                  <div className="td-melding-tekst">{melding.tekst}</div>
                  <div className="td-melding-footer">
                    <span className="td-melding-meta">
                      {melding.auteur_naam} · {new Date(melding.aangemaakt_op).toLocaleDateString('nl-NL')}
                    </span>
                    <button
                      className="td-melding-gezien"
                      onClick={() => markGezien(melding.id, melding.lid_id)}
                    >
                      ✓ Gezien
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Berichten - twee-weg thread met management */}
          {!loading && (
            <div style={{ marginBottom: '2rem', animation: 'fadeUp 0.5s ease-out 0.26s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
                <span className="td-section-title">Berichten</span>
                {berichten.length > 0 && <span className="td-section-count">{berichten.length}</span>}
              </div>

              {berichtenLoading ? (
                <div className="td-empty" style={{ padding: '1.5rem 0' }}>Laden…</div>
              ) : berichten.length === 0 ? (
                <div className="td-empty" style={{ padding: '1.5rem 0' }}>Geen berichten.</div>
              ) : (
                <div className="td-bericht-list">
                  {berichten.slice(0, berichtenMax).map(bericht => {
                    const isSelf = bericht.auteur_type === 'trainer'
                    const date = new Date(bericht.aangemaakt_op)
                    const dateLabel = `${date.getDate()} ${DUTCH_MONTHS[date.getMonth()]}`

                    return (
                      <div
                        key={bericht.id}
                        className={`td-bericht-card ${isSelf ? 'td-bericht-card-self' : 'td-bericht-card-other'}`}
                      >
                        <div className="td-bericht-tekst">{bericht.tekst}</div>
                        <div className="td-bericht-footer">
                          <span className="td-bericht-meta">
                            {bericht.auteur_naam} · {dateLabel}
                          </span>
                          <button
                            className="td-bericht-delete"
                            onClick={() => deleteBericht(bericht.id)}
                            aria-label="Bericht verwijderen"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {berichten.length > berichtenMax && (
                    <button className="td-bericht-older" onClick={() => setBerichtenMax(n => n + 10)}>
                      Toon meer
                    </button>
                  )}
                </div>
              )}

              <div className="td-bericht-form">
                <textarea
                  value={berichtTekst}
                  onChange={e => setBerichtTekst(e.target.value)}
                  placeholder="Schrijf een bericht aan management…"
                  maxLength={1000}
                  rows={2}
                  className="td-bericht-input"
                />
                {berichtTekst.length >= 800 && (
                  <div className="td-bericht-count" style={{ color: berichtTekst.length >= 1000 ? 'var(--red-text)' : undefined }}>
                    {berichtTekst.length}/1000
                  </div>
                )}
                <button
                  onClick={postBericht}
                  disabled={berichtPosting || !berichtTekst.trim()}
                  className="td-btn-secondary"
                  style={{ opacity: berichtPosting || !berichtTekst.trim() ? 0.4 : 1, flexShrink: 0 }}
                >
                  {berichtPosting ? '…' : 'Versturen'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
