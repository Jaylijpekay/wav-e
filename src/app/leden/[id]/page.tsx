'use client'

/*
 * Liddetail
 *
 * Wat doet deze pagina:
 * Deze pagina toont het dossier van een lid met contactmomenten, evaluaties en acties. Trainers en management kunnen contactmomenten en acties toevoegen of afronden.
 *
 * Data:
 * Leest en schrijft: leden, trainers, evaluaties, contact_momenten, acties.
 *
 * Toegang:
 * management / trainer
 *
 * Gerelateerde API routes:
 * Geen.
 */

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { daysSince, getLatestContactDatum } from '@/lib/stoplight'

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
  trainer_id: string
}

type Evaluatie = {
  id: string
  cyclus: number
  datum: string
  slaap: number | null
  energie: number | null
  stress: number | null
  voeding: number | null
  beweging: number | null
  tevredenheid: number | null
  motivatie: number | null
  gewicht_kg: number | null
  vetpercentage: number | null
  spiermassa_kg: number | null
  visceraal_vet: number | null
  buikomvang_cm: number | null
}

type ContactMoment = {
  id: string
  datum: string
  type: string | null
  notities: string | null
  contact_door: string | null
}

type Actie = {
  id: string
  omschrijving: string
  status: string
  aangemaakt: string
  deadline: string | null
}

type Notitie = {
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
    make('slaap',        'Slaap',        ev?.slaap        ?? null, '/10', false),
    make('energie',      'Energie',      ev?.energie      ?? null, '/10', false),
    make('stress',       'Stress',       ev?.stress       ?? null, '/10', true),
    // voeding and beweging: populated via evaluatie form — valid signals
    make('voeding',      'Voeding',      ev?.voeding      ?? null, '/10', false),
    make('beweging',     'Beweging',     ev?.beweging     ?? null, '/10', false),
    make('tevredenheid', 'Tevredenheid', ev?.tevredenheid ?? null, '/10', false),
    make('motivatie',    'Motivatie',    ev?.motivatie    ?? null, '/10', false),
  ]
}

const HEALTH = {
  red:   {
    bg:     'rgba(var(--color-red-rgb, 220,38,38), 0.07)',
    border: 'rgba(var(--color-red-rgb, 220,38,38), 0.18)',
    dot:    'var(--color-red, var(--red-danger))',
    text:   'var(--color-red-text, var(--red-text))',
    dim:    'var(--color-red-dim, var(--red-dim))',
  },
  amber: {
    bg:     'rgba(var(--color-amber-rgb, 217,119,6), 0.07)',
    border: 'rgba(var(--color-amber-rgb, 217,119,6), 0.18)',
    dot:    'var(--color-amber, var(--amber))',
    text:   'var(--color-amber-text, var(--amber-text))',
    dim:    'var(--color-amber-dim, var(--amber-dim))',
  },
  green: {
    bg:     'rgba(var(--color-success-rgb, 22,163,74), 0.07)',
    border: 'rgba(var(--color-success-rgb, 22,163,74), 0.18)',
    dot:    'var(--color-success, var(--green-signal))',
    text:   'var(--color-success-text, var(--green-signal-text))',
    dim:    'var(--color-success-dim, var(--green-signal-dim))',
  },
  empty: {
    bg:     'var(--bg-surface)',
    border: 'var(--border-subtle)',
    dot:    'var(--border-strong)',
    text:   'var(--border-strong)',
    dim:    'var(--bg-raised)',
  },
}

const scoreColor = (score: number | null, inverted = false): string => {
  if (score === null) return 'var(--border-strong)'
  const bad = inverted ? score > 7 : score < 6
  const ok  = inverted ? score <= 5 : score > 7
  if (bad) return 'var(--color-red, var(--red))'
  if (ok)  return 'var(--color-success, var(--green-signal-bright))'
  return 'var(--text-muted)'
}

function NotitieCard({ notitie, onDelete }: { notitie: Notitie; onDelete: () => void }) {
  const isMgmt = notitie.auteur_type === 'management' || notitie.auteur_type === 'admin'
  const date = new Date(notitie.aangemaakt_op)
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const dateLabel = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`

  return (
    <div className={`ld-note-card${isMgmt ? ' ld-note-card-mgmt' : ''}`}>
      {notitie.toon_aan_trainer && (
        <span className="ld-note-badge">Urgent voor trainer</span>
      )}
      <div className="ld-note-text">{notitie.tekst}</div>
      <div className="ld-note-footer">
        <div className="ld-note-meta">
          {notitie.auteur_naam} · {dateLabel}
        </div>
        <button className="ld-note-delete" onClick={onDelete}>
          Verwijder
        </button>
      </div>
    </div>
  )
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
  const [contactType, setContactType] = useState('gesprek')
  const [contactNotities, setContactNotities] = useState('')
  const [contactDoor, setContactDoor] = useState('')
  const [trainerNaam, setTrainerNaam] = useState<string | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [notities, setNotities] = useState<Notitie[]>([])
  const [notitiesLoading, setNotitiesLoading] = useState(true)
  const [notitiesTekst, setNotitiesTekst] = useState('')
  const [notitiesPosting, setNotitiesPosting] = useState(false)
  const [notitiesError, setNotitiesError] = useState<string | null>(null)
  const [notitiesMax, setNotitiesMax] = useState(10)
  const [showAddActie, setShowAddActie] = useState(false)
  const [actieTekst, setActieTekst] = useState('')
  const [actieDeadline, setActieDeadline] = useState('')
  const [actiePosting, setActiePosting] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Role via auth-context — works for both Supabase and console sessions
      const authRes = await fetch('/api/auth-context')
      const authData = authRes.ok ? await authRes.json() : {}
      const roleData = authData.role ?? null
      const authMode = authData.authMode ?? null
      setRole(roleData)

      // Trainer name — only fetchable for Supabase sessions (console sessions
      // have no auth.users entry; contact form contactDoor will be empty)
      if (roleData === 'trainer' && authMode === 'session') {
        try {
          const supabase = getSupabase()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: trainerData } = await supabase.from('trainers').select('naam').eq('id', user.id).single()
            if (trainerData?.naam) setTrainerNaam(trainerData.naam)
          }
        } catch { /* non-critical */ }
      }

      // Lid, evaluaties, contacten via server-side API
      const lidRes = await fetch(`/api/leden/${id}`)
      if (lidRes.ok) {
        const { lid: lidData, evaluaties: evalData, contacten: contactData } = await lidRes.json()
        setLid(lidData ?? null)
        setEvaluaties(evalData ?? [])
        setContacten(contactData ?? [])
      }
      setLoading(false)
    }
    if (id) load()
  }, [id])

  useEffect(() => {
    const fetchNotities = async () => {
      setNotitiesLoading(true)
      try {
        const res = await fetch(`/api/notities/${id}`)
        if (!res.ok) throw new Error('Ophalen mislukt')
        const data = await res.json()
        setNotities(data.notities ?? [])
      } catch {
        setNotities([])
      } finally {
        setNotitiesLoading(false)
      }
    }

    if (id) fetchNotities()
  }, [id])

  useEffect(() => {
    const fetchActies = async () => {
      const res = await fetch(`/api/acties?lid_id=${id}`)
      if (res.ok) {
        const data = await res.json()
        setActies(data.acties ?? [])
      }
    }
    if (id) fetchActies()
  }, [id])

  const markActieAfgerond = async (actieId: string) => {
    const res = await fetch(`/api/acties/${actieId}`, { method: 'PATCH' })
    if (res.ok) setActies(prev => prev.filter(a => a.id !== actieId))
  }

  const addActie = async () => {
    if (!actieTekst.trim() || actiePosting) return
    setActiePosting(true)
    try {
      const res = await fetch('/api/acties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lid_id: id, omschrijving: actieTekst.trim(), deadline: actieDeadline || null }),
      })
      if (res.ok) {
        const data = await res.json()
        setActies(prev => [...prev, data.actie])
        setActieTekst('')
        setActieDeadline('')
        setShowAddActie(false)
      }
    } finally {
      setActiePosting(false)
    }
  }

  const logContact = async () => {
    if (!lid) return
    setSavingContact(true)
    const resolvedDoor = role === 'trainer' ? trainerNaam : (contactDoor.trim() || null)
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lid_id:       lid.id,
        trainer_id:   lid.trainer_id,
        datum:        contactDatum,
        type:         contactType,
        notities:     contactNotities || null,
        contact_door: resolvedDoor,
      }),
    })
    if (!res.ok) {
      console.error('logContact failed', await res.json().catch(() => null))
      setSavingContact(false)
      return
    }
    const lidRes = await fetch(`/api/leden/${lid.id}`)
    if (lidRes.ok) {
      const { contacten: fresh } = await lidRes.json()
      setContacten(fresh ?? [])
    }
    setContactOpen(false)
    setContactNotities('')
    setContactDoor('')
    setSavingContact(false)
  }

  const postNotitie = async () => {
    if (!notitiesTekst.trim() || notitiesTekst.length > 1000) return
    setNotitiesPosting(true)
    setNotitiesError(null)

    try {
      const res = await fetch(`/api/notities/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tekst: notitiesTekst.trim() }),
      })

      if (!res.ok) {
        const err = await res.json()
        setNotitiesError(err.error ?? 'Opslaan mislukt')
        return
      }

      const data = await res.json()
      const notitie = (data.notitie ?? data) as Notitie
      setNotities(prev => [notitie, ...prev])
      setNotitiesTekst('')
    } catch {
      setNotitiesError('Verbindingsfout')
    } finally {
      setNotitiesPosting(false)
    }
  }

  const deleteNotitie = async (notitieId: string) => {
    const previous = notities
    setNotities(prev => prev.filter(n => n.id !== notitieId))

    try {
      const res = await fetch(`/api/notities/${id}/${notitieId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
    } catch {
      try {
        const res = await fetch(`/api/notities/${id}`)
        if (!res.ok) throw new Error('Ophalen mislukt')
        const data = await res.json()
        setNotities(data.notities ?? [])
      } catch {
        setNotities(previous)
      }
    }
  }

  const latestEval = evaluaties[0] ?? null
  const healthSignals = buildHealthSignals(latestEval)
  const lastContactDatum = getLatestContactDatum(contacten[0]?.datum, latestEval?.datum)
  const lastContactDays = daysSince(lastContactDatum)

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-primary)',
      color: 'var(--border-strong)',
      fontSize: '0.8rem',
      letterSpacing: '0.1em',
    }}>
      Laden…
    </div>
  )

  if (!lid) return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-primary)',
      color: 'var(--border-strong)',
      fontSize: '0.8rem',
      letterSpacing: '0.1em',
    }}>
      Lid niet gevonden.
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        /* ─── Root ─────────────────────────────────────────────────── */
        .ld-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--bg-base);
          color: var(--text-secondary);
          font-family: var(--font-primary);
          position: relative;
          -webkit-tap-highlight-color: transparent;
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

        /* ─── Header ────────────────────────────────────────────────── */
        .ld-header {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 52px;
          display: flex;
          align-items: center;
          padding: 0 1.5rem;
          background: rgba(17,17,17,0.92);
          border-bottom: 1px solid var(--border-accent);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .ld-header-inner {
          max-width: var(--app-shell-max);
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .ld-back {
          background: none;
          border: none;
          color: var(--border-strong);
          font-family: var(--font-primary);
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          cursor: pointer;
          /* Larger tap target */
          padding: 10px 0;
          min-height: 44px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
          touch-action: manipulation;
        }
        .ld-back:hover  { color: var(--wave-green); }
        .ld-back:active { color: var(--wave-green); }

        .ld-header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: nowrap;
        }

        .ld-btn-ghost {
          font-family: var(--font-primary);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 14px;
          min-height: 44px;
          border-radius: var(--radius);
          border: 1px solid var(--border-subtle);
          background: transparent;
          color: var(--border-strong);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
          white-space: nowrap;
          touch-action: manipulation;
        }
        .ld-btn-ghost:hover  { border-color: rgba(168,200,0,0.3); color: var(--wave-green); }
        .ld-btn-ghost:active { border-color: rgba(168,200,0,0.5); color: var(--wave-green); }

        .ld-btn-primary {
          font-family: var(--font-primary);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 14px;
          min-height: 44px;
          border-radius: var(--radius);
          border: 1px solid var(--wave-green);
          background: var(--wave-green);
          color: var(--bg-base);
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
          white-space: nowrap;
          touch-action: manipulation;
        }
        .ld-btn-primary:hover    { background: var(--wave-green-hover); box-shadow: var(--shadow-green); }
        .ld-btn-primary:active   { background: var(--wave-green-active); transform: scale(0.97); }
        .ld-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* ─── Body ──────────────────────────────────────────────────── */
        .ld-body {
          max-width: var(--app-shell-max);
          margin: 0 auto;
          padding: 2rem var(--app-shell-padding) 6rem;
          position: relative;
          z-index: 1;
        }

        /* ─── Identity ──────────────────────────────────────────────── */
        .ld-identity {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 2.5rem;
          gap: 16px;
          flex-wrap: wrap;
          animation: ldFadeUp 0.4s ease-out both;
        }

        .ld-identity-left { display: flex; align-items: flex-start; gap: 16px; }

        .ld-avatar {
          width: 48px;
          height: 48px;
          border-radius: var(--radius);
          background: var(--bg-raised);
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--wave-green);
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }

        .ld-member-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 10px;
          letter-spacing: -0.02em;
        }

        .ld-meta-tags { display: flex; flex-wrap: wrap; gap: 6px; }

        .ld-meta-tag {
          font-size: 0.65rem;
          font-weight: 500;
          color: var(--border-strong);
          border: 1px solid var(--border-subtle);
          border-radius: 2px;
          padding: 3px 8px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .ld-meta-tag-warn  { color: var(--color-amber, var(--amber)); border-color: rgba(217,119,6,0.25); }
        .ld-meta-tag-alert { color: var(--color-red, var(--red-danger));   border-color: rgba(220,38,38,0.25); }

        .ld-identity-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
        .ld-contact-link {
          font-size: 0.75rem;
          color: var(--border-strong);
          text-decoration: none;
          letter-spacing: 0.03em;
          /* Easier to tap */
          padding: 4px 0;
          min-height: 36px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
        }
        .ld-contact-link:hover  { color: var(--wave-green); }
        .ld-contact-link:active { color: var(--wave-green); }

        /* ─── Grid ──────────────────────────────────────────────────── */
        .ld-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 2.5rem;
          align-items: flex-start;
        }

        .ld-col { display: flex; flex-direction: column; gap: 2.5rem; }

        /* ─── Section ───────────────────────────────────────────────── */
        .ld-section {
          display: flex;
          flex-direction: column;
          gap: 3px;
          animation: ldFadeUp 0.4s ease-out 0.08s both;
        }

        .ld-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .ld-section-label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--border-strong);
        }

        .ld-section-badge {
          font-size: 0.65rem;
          color: var(--border-subtle);
          background: var(--bg-surface);
          padding: 2px 7px;
          border-radius: 2px;
          font-weight: 600;
        }

        .ld-section-meta {
          font-size: 0.65rem;
          color: var(--border-strong);
          letter-spacing: 0.04em;
        }

        .ld-section-action {
          background: none;
          border: none;
          color: var(--border-strong);
          font-family: var(--font-primary);
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          /* Tap target */
          padding: 8px 0;
          min-height: 36px;
          display: flex;
          align-items: center;
          transition: color 0.15s;
          touch-action: manipulation;
        }
        .ld-section-action:hover  { color: var(--wave-green); }
        .ld-section-action:active { color: var(--wave-green); }

        /* ─── Notities ──────────────────────────────────────────────── */
        .ld-notes-thread {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ld-note-card {
          padding: 12px 16px;
          border-radius: var(--radius);
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-left: 3px solid rgba(168,200,0,0.25);
          position: relative;
        }

        .ld-note-card-mgmt {
          background: rgba(99,102,241,0.05);
          border-left-color: rgba(99,102,241,0.5);
        }

        .ld-note-badge {
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-amber-text, var(--amber-text));
          background: rgba(217,119,6,0.1);
          border: 1px solid rgba(217,119,6,0.2);
          border-radius: 2px;
          padding: 2px 6px;
          margin-bottom: 6px;
          display: inline-block;
        }

        .ld-note-text {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .ld-note-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 6px;
        }

        .ld-note-meta {
          font-size: 0.62rem;
          color: var(--border-strong);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ld-note-delete {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.62rem;
          color: var(--color-red-text, var(--red-text));
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 600;
          padding: 6px 0;
          min-height: 32px;
          font-family: var(--font-primary);
          opacity: 0;
          transition: opacity 0.15s;
          touch-action: manipulation;
        }

        .ld-note-card:hover .ld-note-delete,
        .ld-note-delete:focus-visible {
          opacity: 1;
        }

        .ld-notes-more {
          align-self: flex-start;
          background: none;
          border: none;
          color: var(--border-strong);
          cursor: pointer;
          font-family: var(--font-primary);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 10px 0;
          min-height: 44px;
          touch-action: manipulation;
        }

        .ld-notes-form {
          margin-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ld-notes-count {
          font-size: 0.62rem;
          color: var(--border-strong);
          text-align: right;
          letter-spacing: 0.06em;
        }

        .ld-notes-error {
          font-size: 0.8rem;
          color: var(--color-red-text, var(--red-text));
        }

        /* ─── Empty state ───────────────────────────────────────────── */
        .ld-empty {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 0;
          color: var(--border-subtle);
          font-size: 0.8rem;
          letter-spacing: 0.04em;
        }

        /* ─── Table block ───────────────────────────────────────────── */
        .ld-table-block {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius);
          overflow: hidden;
        }

        /* ─── Eval rows ─────────────────────────────────────────────── */
        .ld-eval-row {
          display: flex;
          align-items: center;
          gap: 16px;
          /* Taller for tap */
          padding: 16px 16px;
          min-height: 56px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--bg-raised);
          cursor: pointer;
          transition: background 0.15s;
          touch-action: manipulation;
        }
        .ld-eval-row:last-child { border-bottom: none; }
        .ld-eval-row:hover  { background: var(--bg-raised); }
        .ld-eval-row:active { background: var(--bg-raised); }

        .ld-eval-left { flex: 1; }
        .ld-eval-cyclus {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 2px;
        }
        .ld-eval-datum {
          font-size: 0.7rem;
          color: var(--border-strong);
          letter-spacing: 0.04em;
        }

        .ld-eval-scores { display: flex; gap: 14px; }
        .ld-eval-score  { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .ld-eval-score-label {
          font-size: 0.55rem;
          color: var(--border-subtle);
          letter-spacing: 0.1em;
          font-weight: 600;
          text-transform: uppercase;
        }
        .ld-eval-score-val {
          font-size: 0.9rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .ld-eval-arrow {
          font-size: 1.1rem;
          color: var(--border-subtle);
        }

        /* ─── Contact rows ──────────────────────────────────────────── */
        .ld-contact-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 4px 12px;
          padding: 14px 16px;
          min-height: 48px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--bg-raised);
        }
        .ld-contact-row:last-child { border-bottom: none; }
        .ld-contact-type {
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: capitalize;
        }
        .ld-contact-datum {
          font-size: 0.7rem;
          color: var(--border-strong);
          letter-spacing: 0.04em;
          text-align: right;
        }
        .ld-contact-note {
          font-size: 0.75rem;
          color: var(--border-strong);
          grid-column: 1 / -1;
          margin-top: 2px;
          letter-spacing: 0.02em;
        }

        /* ─── Form card ─────────────────────────────────────────────── */
        .ld-form-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius);
          padding: 16px;
          margin-bottom: 3px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          animation: ldFadeUp 0.2s ease-out both;
        }

        .ld-form-row   { display: flex; flex-direction: column; gap: 5px; }
        .ld-form-label {
          font-size: 0.6rem;
          font-weight: 600;
          color: var(--border-strong);
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .ld-input {
          background: var(--bg-base);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-family: var(--font-primary);
          font-size: 1rem;
          font-weight: 400;
          /* Taller input for fat-finger tapping */
          padding: 12px 12px;
          min-height: 44px;
          border-radius: var(--radius);
          width: 100%;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ld-input:focus {
          border-color: var(--wave-green);
          box-shadow: 0 0 0 3px rgba(168,200,0,0.08);
        }

        /* ─── Health grid ───────────────────────────────────────────── */
        .ld-health-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .ld-health-card {
          border-radius: var(--radius);
          border: 1px solid;
          padding: 14px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .ld-health-card:active {
          transform: scale(0.97);
        }

        .ld-health-card-top { display: flex; align-items: center; gap: 7px; }
        .ld-health-dot      { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .ld-health-label {
          font-size: 0.58rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .ld-health-value-row { display: flex; align-items: baseline; gap: 3px; }
        .ld-health-value {
          font-size: 1.75rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }
        .ld-health-unit  { font-size: 0.7rem; font-weight: 400; }
        .ld-health-reden { font-size: 0.6rem; letter-spacing: 0.04em; line-height: 1.4; }
        .ld-health-empty-note {
          font-size: 0.65rem;
          color: var(--border-subtle);
          letter-spacing: 0.04em;
          padding: 10px 0 4px;
          text-align: center;
        }

        /* ─── Acties ────────────────────────────────────────────────── */
        .ld-actie-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 16px;
          min-height: 56px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--bg-raised);
          border-left: 3px solid transparent;
          transition: background 0.15s;
        }
        .ld-actie-row:last-child { border-bottom: none; }
        .ld-actie-row:hover { background: var(--bg-raised); }

        .ld-actie-content { flex: 1; }
        .ld-actie-name {
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 3px;
          line-height: 1.4;
        }
        .ld-actie-meta {
          font-size: 0.68rem;
          color: var(--border-strong);
          letter-spacing: 0.03em;
        }

        /* Done button — much larger on tablet */
        .ld-done-btn {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--border-strong);
          font-family: var(--font-primary);
          font-size: 0.9rem;
          /* Was 28×28 — now 44×44 minimum for touch */
          width: 44px;
          height: 44px;
          border-radius: var(--radius);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
          touch-action: manipulation;
        }
        .ld-done-btn:hover {
          border-color: rgba(22,163,74,0.4);
          color: var(--color-success, var(--green-signal));
          background: rgba(22,163,74,0.06);
        }
        .ld-done-btn:active {
          border-color: rgba(22,163,74,0.6);
          color: var(--color-success, var(--green-signal));
          background: rgba(22,163,74,0.12);
          transform: scale(0.93);
        }

        /* ─── Animation ─────────────────────────────────────────────── */
        @keyframes ldFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── Tablet: iPad 7th gen (768px+, coarse pointer) ─────────── */
        @media (min-width: 768px) and (pointer: coarse) {
          .ld-header { height: 60px; padding: 0 2rem; }

          .ld-btn-ghost,
          .ld-btn-primary {
            padding: 12px 18px;
            min-height: 48px;
            font-size: 0.78rem;
          }

          .ld-body { padding: 2rem 2rem 6rem; }

          .ld-eval-row    { padding: 18px 20px; min-height: 64px; }
          .ld-actie-row   { padding: 18px 20px; min-height: 64px; }
          .ld-contact-row { padding: 16px 20px; min-height: 52px; }

          .ld-input { padding: 14px 14px; min-height: 48px; font-size: 1rem; }

          .ld-note-delete { opacity: 1; min-height: 44px; }

          .ld-done-btn { width: 48px; height: 48px; font-size: 1rem; }

          /* Health cards — slightly taller on tablet */
          .ld-health-card { padding: 16px 14px 14px; }
          .ld-health-value { font-size: 2rem; }
        }

        /* ─── Tablet portrait: stack grid to single column ──────────── */
        @media (max-width: 899px) and (pointer: coarse) {
          .ld-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
          /* Health grid: 4 cols on portrait tablet for compact layout */
          .ld-health-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .ld-identity { flex-direction: column; }
          .ld-identity-right { align-items: flex-start; }
        }

        /* ─── Tablet landscape: keep 2-col but widen right col ──────── */
        @media (min-width: 900px) and (pointer: coarse) and (orientation: landscape) {
          .ld-grid { grid-template-columns: 1fr 360px; }
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
              {lid.email    && <a href={`mailto:${lid.email}`}   className="ld-contact-link">{lid.email}</a>}
              {lid.telefoon && <a href={`tel:${lid.telefoon}`}   className="ld-contact-link">{lid.telefoon}</a>}
            </div>
          </div>

          {/* Main grid */}
          <div className="ld-grid">

            {/* Left column */}
            <div className="ld-col">

              {/* Notities */}
              <section className="ld-section">
                <div className="ld-section-head">
                  <span className="ld-section-label">Notities</span>
                  {notities.length > 0 && (
                    <span className="ld-section-badge">{notities.length}</span>
                  )}
                </div>

                {notitiesLoading ? (
                  <div className="ld-empty"><span>○</span><span>Laden…</span></div>
                ) : (
                  <>
                    {notities.length === 0 ? (
                      <div className="ld-empty"><span>○</span><span>Nog geen notities.</span></div>
                    ) : (
                      <div className="ld-notes-thread">
                        {notities.slice(0, notitiesMax).map(notitie => (
                          <NotitieCard
                            key={notitie.id}
                            notitie={notitie}
                            onDelete={() => deleteNotitie(notitie.id)}
                          />
                        ))}
                        {notities.length > notitiesMax && (
                          <button className="ld-notes-more" onClick={() => setNotitiesMax(n => n + 10)}>
                            Toon meer
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="ld-notes-form">
                  <textarea
                    value={notitiesTekst}
                    onChange={e => setNotitiesTekst(e.target.value)}
                    placeholder="Schrijf een notitie…"
                    maxLength={1000}
                    rows={3}
                    className="ld-input"
                    style={{ resize: 'vertical', minHeight: 88 }}
                  />
                  {notitiesTekst.length >= 800 && (
                    <div
                      className="ld-notes-count"
                      style={{ color: notitiesTekst.length >= 1000 ? 'var(--color-red-text, var(--red-text))' : undefined }}
                    >
                      {notitiesTekst.length}/1000
                    </div>
                  )}
                  {notitiesError && (
                    <div className="ld-notes-error">{notitiesError}</div>
                  )}
                  <button
                    className="ld-btn-primary"
                    onClick={postNotitie}
                    disabled={notitiesPosting || !notitiesTekst.trim()}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {notitiesPosting ? 'Opslaan…' : 'Toevoegen'}
                  </button>
                </div>
              </section>

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
                                <span className="ld-eval-score-val" style={{ color: 'var(--text-muted)' }}>{ev.gewicht_kg}</span>
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
                        <option value="gesprek">Gesprek</option>
                        <option value="training">Training</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="telefoon">Telefoon</option>
                        <option value="overig">Overig</option>
                      </select>
                    </div>
                    <div className="ld-form-row">
                      <label className="ld-form-label">Door</label>
                      {role === 'trainer'
                        ? <div className="ld-input" style={{ color: 'var(--text-muted)', cursor: 'default', opacity: 0.7 }}>{trainerNaam ?? '—'}</div>
                        : <input
                            type="text"
                            value={contactDoor}
                            onChange={e => setContactDoor(e.target.value)}
                            placeholder="Naam van de contactpersoon…"
                            className="ld-input"
                          />
                      }
                    </div>
                    <div className="ld-form-row">
                      <label className="ld-form-label">Notities</label>
                      <textarea
                        value={contactNotities}
                        onChange={e => setContactNotities(e.target.value)}
                        placeholder="Optioneel…"
                        className="ld-input"
                        style={{ height: 88, resize: 'vertical' }}
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
                          {c.contact_door && <div className="ld-contact-note" style={{ color: 'var(--text-muted)' }}>{c.contact_door}</div>}
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
                    : <span className="ld-section-meta" style={{ color: 'var(--border-subtle)' }}>geen data</span>
                  }
                </div>
                <div className="ld-health-grid">
                  {healthSignals
                    .filter(sig => sig.key !== 'tevredenheid' || role === 'management' || role === 'admin')
                    .map(sig => {
                      const col = HEALTH[sig.status]
                      const isInternal = sig.key === 'tevredenheid'
                      return (
                        <div
                          key={sig.key}
                          className="ld-health-card"
                          style={{ background: col.bg, borderColor: isInternal ? 'rgba(99,102,241,0.25)' : col.border }}
                        >
                          <div className="ld-health-card-top">
                            <span className="ld-health-dot" style={{ background: col.dot }} />
                            <span
                              className="ld-health-label"
                              style={{ color: sig.status === 'empty' ? 'var(--border-subtle)' : 'var(--text-muted)' }}
                            >
                              {sig.label}
                            </span>
                          </div>
                          {isInternal && (
                            <span style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent-text)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 2, padding: '1px 5px', display: 'inline-block', marginBottom: 2 }}>
                              intern
                            </span>
                          )}
                          <div className="ld-health-value-row">
                            <span className="ld-health-value" style={{ color: col.text }}>{sig.value ?? '—'}</span>
                            <span className="ld-health-unit"  style={{ color: col.dim }}>{sig.value !== null ? sig.unit : ''}</span>
                          </div>
                          <div className="ld-health-reden" style={{ color: col.dim }}>{sig.reden}</div>
                        </div>
                      )
                    })
                  }
                </div>
                {!latestEval && (
                  <div className="ld-health-empty-note">
                    Scores verschijnen na het eerste evaluatiegesprek
                  </div>
                )}
              </section>

              {/* Open acties */}
              <section className="ld-section">
                <div className="ld-section-head">
                  <span className="ld-section-label">Open acties</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="ld-section-badge">{acties.length}</span>
                    <button
                      onClick={() => { setShowAddActie(o => !o); setActieTekst(''); setActieDeadline('') }}
                      style={{ background: 'none', border: '1px solid var(--border-muted-dark)', borderRadius: 3, color: showAddActie ? 'var(--text-faint)' : 'var(--wave-green)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '1px 8px', minHeight: 26, minWidth: 26 }}
                    >
                      {showAddActie ? '×' : '+'}
                    </button>
                  </div>
                </div>
                {showAddActie && (
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Omschrijving van de actie…"
                      value={actieTekst}
                      onChange={e => setActieTekst(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addActie() }}
                      autoFocus
                      style={{ background: 'var(--surface-pressed)', border: '1px solid var(--border-muted-dark)', borderRadius: 3, color: 'var(--text-warm)', fontSize: '0.88rem', padding: '8px 10px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="date"
                        value={actieDeadline}
                        onChange={e => setActieDeadline(e.target.value)}
                        style={{ background: 'var(--surface-pressed)', border: '1px solid var(--border-muted-dark)', borderRadius: 3, color: 'var(--text-warm)', fontSize: '0.82rem', padding: '7px 10px', fontFamily: 'inherit' }}
                      />
                      <button
                        onClick={addActie}
                        disabled={!actieTekst.trim() || actiePosting}
                        style={{ background: 'var(--wave-green)', border: 'none', borderRadius: 3, color: 'var(--color-black-soft)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', padding: '8px 14px', opacity: !actieTekst.trim() || actiePosting ? 0.5 : 1, textTransform: 'uppercase', fontFamily: 'inherit', minHeight: 34 }}
                      >
                        {actiePosting ? 'Opslaan…' : 'Toevoegen'}
                      </button>
                    </div>
                  </div>
                )}
                {acties.length === 0 && !showAddActie
                  ? <div className="ld-empty"><span>✓</span><span>Geen open acties</span></div>
                  : acties.length > 0 && (
                    <div className="ld-table-block">
                      {acties.map(actie => {
                        const isOverdue = actie.deadline && new Date(actie.deadline) < new Date()
                        return (
                          <div
                            key={actie.id}
                            className="ld-actie-row"
                            style={{
                              borderLeftColor: isOverdue
                                ? 'var(--color-red, var(--red-danger))'
                                : 'rgba(22,163,74,0.3)',
                            }}
                          >
                            <div className="ld-actie-content">
                              <div className="ld-actie-name">{actie.omschrijving}</div>
                              <div className="ld-actie-meta">
                                {formatDate(actie.aangemaakt)}
                                {actie.deadline && (
                                  <span style={{ color: isOverdue ? 'var(--color-red, var(--red-danger))' : 'var(--border-strong)' }}>
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
