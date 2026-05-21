'use client'

/*
 * Management
 *
 * Wat doet deze pagina:
 * Deze pagina geeft management een studio-overzicht van trainers, leden, statussen en open acties. Management kan leden, trainers, acties en consoletoegang beheren.
 *
 * Data:
 * Leest en schrijft: trainers, leden, contact_momenten, evaluaties, acties, console_tokens.
 *
 * Toegang:
 * management
 *
 * Gerelateerde API routes:
 * /api/management/trainers, /api/admin/pins, /api/admin/pin, /api/admin/pin-management
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { getSupabase } from '@/lib/supabase'
import { isActieOpen } from '@/lib/actieUrgency'
import { daysSince, getLatestContactDatum, getStoplight } from '@/lib/stoplight'
import Navigation from '@/app/components/Navigation'

// ── Types ──────────────────────────────────────────────────────────────

type Trainer = {
  id: string
  voornaam: string
  achternaam: string
  naam: string
  email: string
  actief: boolean
}

type TrainerPin = {
  trainer_id: string
  naam: string
  has_pin: boolean
  type: 'trainer' | 'management'
}

const CURRENT_MANAGEMENT_PIN: TrainerPin = {
  trainer_id: '__current__',
  naam: 'Eigen PIN',
  has_pin: false,
  type: 'management',
}

type TrainerStats = {
  trainer_id: string
  totaal: number
  rood: number
  amber: number
  open_acties: number
}

type ConsoleToken = {
  id: string
  token: string
  naam: string
  actief: boolean
  aangemaakt_op: string
  laatst_gebruikt: string | null
}

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  actief: boolean
  status: string | null
  trainer_id: string
  gestopt_op: string | null
  laatste_contact: string | null
  laatste_evaluatie: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
}

type StudioCounts = {
  actief: number
  on_hold: number
  gestopt: number
}

// ── Helpers ────────────────────────────────────────────────────────────

const toUiStoplight = (stoplight: ReturnType<typeof getStoplight>): 'red' | 'amber' | 'green' => {
  if (stoplight === 'rood') return 'red'
  if (stoplight === 'oranje') return 'amber'
  return 'green'
}

const getLidStoplight = (lid: Lid): 'red' | 'amber' | 'green' =>
  toUiStoplight(getStoplight(daysSince(getLatestContactDatum(lid.laatste_contact, lid.laatste_evaluatie))))

const daysSinceLabel = (date: string | null, neverLabel = 'Nooit gebruikt'): string => {
  const d = daysSince(date)
  if (d === null) return neverLabel
  if (d === 0) return 'Vandaag'
  if (d === 1) return 'Gisteren'
  return `${d} dagen geleden`
}

const consoleUrl = (token: string): string => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/console?token=${token}`
}

const STATUS_COLOR: Record<string, string> = {
  actief:    'var(--green-signal-text)',
  bevroren:  'var(--color-info)',
  'on hold': 'var(--amber-text)',
  on_hold:   'var(--amber-text)',
  stopt:     'var(--red-text)',
  inactief:  'var(--text-dim)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '9px 12px',
  minHeight: 44,
  color: 'var(--text-primary)',
  fontSize: '1rem',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const touchButtonStyle: React.CSSProperties = {
  minHeight: 44,
  minWidth: 44,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

// ── Add Lid Modal ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained while the PIN editor moves from inline rows to modal buttons.
function PinRow({ person, onSaved }: { person: TrainerPin; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const reset = () => {
    setPin('')
    setConfirm('')
    setError(null)
    setOk(false)
    setOpen(false)
  }

  const save = async () => {
    setError(null)
    if (!/^\d{4}$/.test(pin)) { setError('PIN moet exact 4 cijfers zijn'); return }
    if (pin !== confirm) { setError('PINs komen niet overeen'); return }

    setSaving(true)
    const endpoint = person.type === 'management' ? '/api/admin/pin-management' : '/api/admin/pin'
    const body = person.type === 'management'
      ? { management_id: person.trainer_id, pin }
      : { trainer_id: person.trainer_id, pin }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'PIN opslaan mislukt')
      return
    }

    setOk(true)
    setTimeout(() => { reset(); onSaved() }, 800)
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.naam}</div>
            {person.type === 'management' && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--amber-text)', background: 'rgba(217,119,6,0.10)', padding: '2px 7px', borderRadius: 4 }}>
                management
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: person.has_pin ? 'var(--green-signal-text)' : 'var(--text-faint)', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: person.has_pin ? 'var(--green-signal-text)' : 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            {person.has_pin ? 'PIN ingesteld' : 'Geen PIN'}
          </span>
        </div>

        <button
          onClick={() => { setOpen(o => !o); setError(null); setOk(false) }}
          style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {open ? 'Annuleren' : person.has_pin ? 'PIN wijzigen' : 'Stel in'}
        </button>
      </div>

      {open && (
        <div style={{ padding: '16px 24px 20px', background: 'var(--bg-raised)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nieuwe PIN (4 cijfers)">
              <input type="text" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }} />
            </Field>
            <Field label="Bevestig PIN">
              <input type="text" inputMode="numeric" maxLength={4} value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }} />
            </Field>
          </div>

          {error && <div style={{ fontSize: 12, color: 'var(--red-text)', padding: '6px 10px', background: 'rgba(220,38,38,0.07)', borderRadius: 6 }}>{error}</div>}
          {ok && <div style={{ fontSize: 12, color: 'var(--green-signal-text)', padding: '6px 10px', background: 'rgba(22,163,74,0.07)', borderRadius: 6 }}>PIN opgeslagen</div>}

          <button
            onClick={save}
            disabled={saving || pin.length < 4 || confirm.length < 4}
            style={{ ...touchButtonStyle, background: 'var(--color-accent)', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving || pin.length < 4 || confirm.length < 4 ? 0.5 : 1, alignSelf: 'flex-start' }}
          >
            {saving ? 'Opslaan…' : 'PIN opslaan'}
          </button>
        </div>
      )}
    </div>
  )
}

function PinDialog({ person, onClose, onSaved }: { person: TrainerPin; onClose: () => void; onSaved: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const save = async () => {
    setError(null)
    if (!/^\d{4}$/.test(pin)) { setError('PIN moet exact 4 cijfers zijn'); return }
    if (pin !== confirm) { setError('PINs komen niet overeen'); return }

    setSaving(true)
    const endpoint = person.type === 'management' ? '/api/admin/pin-management' : '/api/admin/pin'
    const body = person.type === 'management'
      ? { management_id: person.trainer_id, pin }
      : { trainer_id: person.trainer_id, pin }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'PIN opslaan mislukt')
      return
    }

    setOk(true)
    setTimeout(() => { onSaved(); onClose() }, 700)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{person.has_pin ? 'PIN wijzigen' : 'PIN instellen'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{person.naam} · {person.type === 'management' ? 'management' : 'trainer'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nieuwe PIN (4 cijfers)">
            <input type="text" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }} />
          </Field>
          <Field label="Bevestig PIN">
            <input type="text" inputMode="numeric" maxLength={4} value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }} />
          </Field>
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--red-text)', padding: '6px 10px', background: 'rgba(220,38,38,0.07)', borderRadius: 6 }}>{error}</div>}
        {ok && <div style={{ fontSize: 12, color: 'var(--green-signal-text)', padding: '6px 10px', background: 'rgba(22,163,74,0.07)', borderRadius: 6 }}>PIN opgeslagen</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Annuleren
          </button>
          <button
            onClick={save}
            disabled={saving || pin.length < 4 || confirm.length < 4}
            style={{ ...touchButtonStyle, background: 'var(--color-accent)', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving || pin.length < 4 || confirm.length < 4 ? 0.5 : 1 }}
          >
            {saving ? 'Opslaan...' : 'PIN opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddLidModal({
  trainers,
  nextLidId,
  onClose,
  onSaved,
}: {
  trainers: Trainer[]
  nextLidId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [lidId,      setLidId]      = useState(nextLidId)
  const [voornaam,   setVoornaam]   = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [email,      setEmail]      = useState('')
  const [telefoon,   setTelefoon]   = useState('')
  const [trainerId,  setTrainerId]  = useState('')
  const [startdatum, setStartdatum] = useState(new Date().toISOString().split('T')[0])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const save = async () => {
    setError(null)
    if (!lidId.trim())      { setError('Lid-ID is verplicht'); return }
    if (!voornaam.trim())   { setError('Voornaam is verplicht'); return }
    if (!achternaam.trim()) { setError('Achternaam is verplicht'); return }
    if (!trainerId)         { setError('Selecteer een trainer'); return }

    setSaving(true)
    const res = await fetch(`/api/trainer/${trainerId}/leden`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lid_id:     lidId.trim().toUpperCase(),
        voornaam:   voornaam.trim(),
        achternaam: achternaam.trim(),
        email:      email.trim() || null,
        telefoon:   telefoon.trim() || null,
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

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>

        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Nieuw lid toevoegen</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Handmatige invoer · bron: manual</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Lid-ID">
            <input type="text" value={lidId} onChange={e => setLidId(e.target.value)} placeholder="WE-006" style={inputStyle} />
          </Field>
          <Field label="Startdatum">
            <input type="date" value={startdatum} onChange={e => setStartdatum(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Voornaam">
            <input type="text" value={voornaam} onChange={e => setVoornaam(e.target.value)} placeholder="Jana" style={inputStyle} />
          </Field>
          <Field label="Achternaam">
            <input type="text" value={achternaam} onChange={e => setAchternaam(e.target.value)} placeholder="de Wit" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Email (optioneel)">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jana@example.com" style={inputStyle} />
          </Field>
          <Field label="Telefoon (optioneel)">
            <input type="tel" value={telefoon} onChange={e => setTelefoon(e.target.value)} placeholder="06 12345678" style={inputStyle} />
          </Field>
        </div>

        <Field label="Trainer">
          <select value={trainerId} onChange={e => setTrainerId(e.target.value)} style={{ ...inputStyle, color: trainerId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <option value="">Selecteer trainer…</option>
            {trainers.filter(t => t.actief).map(t => (
              <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>
            ))}
          </select>
        </Field>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red-text)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Annuleren
          </button>
          <button onClick={save} disabled={saving} style={{ ...touchButtonStyle, background: 'var(--color-accent, var(--color-accent))', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Lid toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Actie Modal ────────────────────────────────────────────────────────
// Two entry points:
// 1. From trainer row: trainer is set, user picks a lid from that trainer's members
// 2. From member row: lid + trainer are both pre-filled

function ActieModal({
  trainer,
  leden,
  prefillLid,
  onClose,
  onSaved,
}: {
  trainer: Trainer
  leden: Lid[]
  prefillLid?: Lid | null
  onClose: () => void
  onSaved: () => void
}) {
  const [omschrijving, setOmschrijving] = useState('')
  const [deadline,     setDeadline]     = useState('')
  const [lidId,        setLidId]        = useState(prefillLid?.id ?? '')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const trainerLeden = leden.filter(l => l.trainer_id === trainer.id && l.actief)

  const save = async () => {
    setError(null)
    if (!omschrijving.trim()) { setError('Omschrijving is verplicht'); return }
    if (!deadline) { setError('Deadline is verplicht'); return }
    setSaving(true)
    const res = await fetch('/api/acties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainer_id:  trainer.id,
        lid_id:      lidId || null,
        omschrijving: omschrijving.trim(),
        deadline:    deadline || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Opslaan mislukt'); return }
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Actie toewijzen</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>→ {trainer.voornaam} {trainer.achternaam}</div>
        </div>
        <Field label="Lid (optioneel)">
          <select
            value={lidId}
            onChange={e => setLidId(e.target.value)}
            disabled={!!prefillLid}
            style={{ ...inputStyle, color: lidId ? 'var(--text-primary)' : 'var(--text-muted)', opacity: prefillLid ? 0.7 : 1 }}
          >
            <option value="">— geen lid —</option>
            {trainerLeden.map(l => (
              <option key={l.id} value={l.id}>{l.voornaam} {l.achternaam}</option>
            ))}
          </select>
        </Field>
        <Field label="Omschrijving">
          <textarea value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Wat moet deze trainer doen?" rows={3}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
        <Field label="Deadline">
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} required style={inputStyle} />
        </Field>
        {error && <div style={{ fontSize: 13, color: 'var(--red-text)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuleren</button>
          <button onClick={save} disabled={saving} style={{ ...touchButtonStyle, background: 'var(--color-accent, var(--color-accent))', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Toewijzen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotitieModal({
  trainer,
  leden,
  onClose,
  onSaved,
}: {
  trainer: Trainer
  leden: Lid[]
  onClose: () => void
  onSaved: () => void
}) {
  const [modus, setModus] = useState<'lid' | 'trainer'>('lid')
  const [lidId, setLidId] = useState('')
  const [tekst, setTekst] = useState('')
  const [toonAanTrainer, setToonAanTrainer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trainerLeden = leden.filter(l => l.trainer_id === trainer.id && l.actief)

  const switchModus = (m: 'lid' | 'trainer') => {
    setModus(m)
    setLidId('')
    setTekst('')
    setToonAanTrainer(false)
    setError(null)
  }

  const save = async () => {
    setError(null)

    if (modus === 'lid') {
      if (!lidId) { setError('Selecteer een lid'); return }
      if (!tekst.trim()) { setError('Tekst is verplicht'); return }
      if (tekst.length > 1000) { setError('Maximaal 1000 tekens'); return }

      setSaving(true)
      try {
        const res = await fetch(`/api/notities/${lidId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tekst: tekst.trim(),
            toon_aan_trainer: toonAanTrainer,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          setError(err.error ?? 'Opslaan mislukt')
          return
        }
      } catch {
        setError('Verbindingsfout')
        return
      } finally {
        setSaving(false)
      }
    }

    if (modus === 'trainer') {
      if (!tekst.trim()) { setError('Tekst is verplicht'); return }
      if (tekst.length > 1000) { setError('Maximaal 1000 tekens'); return }

      setSaving(true)
      try {
        const res = await fetch(`/api/trainer-notities/${trainer.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tekst: tekst.trim() }),
        })
        if (!res.ok) {
          const err = await res.json()
          setError(err.error ?? 'Opslaan mislukt')
          return
        }
      } catch {
        setError('Verbindingsfout')
        return
      } finally {
        setSaving(false)
      }
    }

    onSaved()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Notitie toevoegen</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>→ {trainer.voornaam} {trainer.achternaam}</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => switchModus('lid')}
            style={{
              ...touchButtonStyle,
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: modus === 'lid' ? 'var(--color-accent)' : 'var(--border-subtle)',
              background: modus === 'lid' ? 'rgba(99,102,241,0.08)' : 'transparent',
              color: modus === 'lid' ? 'var(--color-accent-text)' : 'var(--text-muted)',
            }}
          >
            Notitie bij lid
          </button>
          <button
            onClick={() => switchModus('trainer')}
            style={{
              ...touchButtonStyle,
              flex: 1,
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: modus === 'trainer' ? 'var(--color-accent)' : 'var(--border-subtle)',
              background: modus === 'trainer' ? 'rgba(99,102,241,0.08)' : 'transparent',
              color: modus === 'trainer' ? 'var(--color-accent-text)' : 'var(--text-muted)',
            }}
          >
            Notitie voor trainer
          </button>
        </div>

        {modus === 'lid' && (
          <Field label="Lid">
            <select
              value={lidId}
              onChange={e => setLidId(e.target.value)}
              style={{ ...inputStyle, color: lidId ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              <option value="">Selecteer lid…</option>
              {trainerLeden.map(l => (
                <option key={l.id} value={l.id}>{l.voornaam} {l.achternaam}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Notitie">
          <textarea
            value={tekst}
            onChange={e => setTekst(e.target.value)}
            placeholder={modus === 'lid' ? 'Aantekening bij dit lid…' : 'Bericht aan trainer…'}
            rows={4}
            maxLength={1000}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          {tekst.length >= 800 && (
            <div style={{ fontSize: 11, color: tekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
              {tekst.length}/1000
            </div>
          )}
        </Field>

        {modus === 'lid' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', ...touchButtonStyle }}>
            <input
              type="checkbox"
              checked={toonAanTrainer}
              onChange={e => setToonAanTrainer(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--amber-text)' }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Urgent voor trainer
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Verschijnt als melding op het trainer dashboard totdat de trainer het bevestigt. De notitie is altijd zichtbaar op de ledenpagina.
              </div>
            </div>
          </label>
        )}

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red-text)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Annuleren
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{ ...touchButtonStyle, background: 'var(--color-accent)', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Trainer Modal ─────────────────────────────────────────────────

function AddTrainerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [voornaam,   setVoornaam]   = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const save = async () => {
    setError(null)
    if (!voornaam.trim())   { setError('Voornaam is verplicht'); return }
    if (!achternaam.trim()) { setError('Achternaam is verplicht'); return }
    if (!email.trim())      { setError('Email is verplicht'); return }
    if (!password.trim() || password.trim().length < 6) { setError('Wachtwoord is verplicht (min. 6 tekens)'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voornaam: voornaam.trim(),
          achternaam: achternaam.trim(),
          email: email.trim(),
          password: password.trim(),
          role: 'trainer',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Trainer aanmaken mislukt')
        return
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Nieuwe trainer toevoegen</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Trainer wordt direct actief met login</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Voornaam">
            <input type="text" value={voornaam} onChange={e => setVoornaam(e.target.value)} placeholder="Karim" style={inputStyle} />
          </Field>
          <Field label="Achternaam">
            <input type="text" value={achternaam} onChange={e => setAchternaam(e.target.value)} placeholder="Bakker" style={inputStyle} />
          </Field>
        </div>
        <Field label="Email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="karim@wave-studios.nl" style={inputStyle} />
        </Field>
        <Field label="Wachtwoord">
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 tekens" style={inputStyle} />
        </Field>
        {error && <div style={{ fontSize: 13, color: 'var(--red-text)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuleren</button>
          <button onClick={save} disabled={saving} style={{ ...touchButtonStyle, background: 'var(--color-accent, var(--color-accent))', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Trainer toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Console Panel ──────────────────────────────────────────────────────

function ConsolePanel() {
  const [tokens,     setTokens]     = useState<ConsoleToken[]>([])
  const [loading,    setLoading]    = useState(true)
  const [formOpen,   setFormOpen]   = useState(false)
  const [newNaam,    setNewNaam]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [copiedId,   setCopiedId]   = useState<string | null>(null)
  const [qrToken,    setQrToken]    = useState<ConsoleToken | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/management/console-tokens')
      const { tokens } = res.ok ? await res.json() : { tokens: [] }
      setTokens(tokens ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTokens() }, [loadTokens])

  const createToken = async () => {
    if (!newNaam.trim()) return
    setSaving(true)
    const res = await fetch('/api/management/console-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naam: newNaam.trim() }),
    })
    const data = res.ok ? await res.json() : null
    setNewNaam('')
    setFormOpen(false)
    setSaving(false)
    await loadTokens()
    if (data?.token) setQrToken(data.token)
  }

  const revokeToken = async (id: string) => {
    await fetch(`/api/management/console-tokens/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actief: false }) })
    loadTokens()
  }
  const reactivateToken = async (id: string) => {
    await fetch(`/api/management/console-tokens/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actief: true }) })
    loadTokens()
  }

  const deleteToken = async (t: ConsoleToken) => {
    if (t.actief) return
    if (!window.confirm(`Console "${t.naam}" definitief verwijderen?`)) return
    setDeletingId(t.id)
    await fetch(`/api/management/console-tokens/${t.id}`, { method: 'DELETE' })
    setDeletingId(null)
    loadTokens()
  }

  const copyUrl = (t: ConsoleToken) => {
    navigator.clipboard.writeText(consoleUrl(t.token))
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
      {qrToken && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setQrToken(null) }}
        >
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Console verifieren</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{qrToken.naam}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--color-white)', borderRadius: 10, padding: 16 }}>
              <QRCodeSVG value={consoleUrl(qrToken.token)} size={220} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Scan deze QR-code met de camera van de console of iPad om de console direct te openen en te verifieren.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => copyUrl(qrToken)}
                style={{ ...touchButtonStyle, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: copiedId === qrToken.id ? 'var(--green-signal-text)' : 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {copiedId === qrToken.id ? 'Gekopieerd' : 'Kopieer URL'}
              </button>
              <button
                onClick={() => setQrToken(null)}
                style={{ ...touchButtonStyle, background: 'var(--color-accent, var(--color-accent))', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: formOpen || tokens.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Studio consoles</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Apparaten met toegang zonder trainer-login</div>
        </div>
        <button
          onClick={() => { setFormOpen(o => !o); setNewNaam('') }}
          style={{ ...touchButtonStyle, background: formOpen ? 'none' : 'var(--color-accent, var(--color-accent))', color: formOpen ? 'var(--text-muted)' : 'var(--color-white)', border: formOpen ? '1px solid var(--border-subtle)' : 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {formOpen ? '× Annuleren' : '+ Nieuwe console'}
        </button>
      </div>

      {formOpen && (
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={labelStyle}>Naam apparaat</label>
            <input
              type="text"
              value={newNaam}
              onChange={e => setNewNaam(e.target.value)}
              placeholder="bijv. iPad Studio Vloer"
              style={{ ...inputStyle, width: 'auto' }}
              onKeyDown={e => { if (e.key === 'Enter' && newNaam.trim()) createToken() }}
            />
          </div>
          <button
            onClick={createToken}
            disabled={saving || !newNaam.trim()}
            style={{ ...touchButtonStyle, background: 'var(--color-accent, var(--color-accent))', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', opacity: saving || !newNaam.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >
            {saving ? 'Aanmaken…' : 'Aanmaken'}
          </button>
        </div>
      )}

      {!loading && tokens.length === 0 && !formOpen && (
        <div style={{ padding: '20px 24px', fontSize: 13, color: 'var(--text-muted)' }}>Geen consoles aangemaakt.</div>
      )}

      {!loading && tokens.map((t, i) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: i < tokens.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: t.actief ? 1 : 0.45 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.naam}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {daysSinceLabel(t.laatst_gebruikt)}
            </div>
          </div>
          <button
            onClick={() => copyUrl(t)}
            style={{ ...touchButtonStyle, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: copiedId === t.id ? 'var(--green-signal-text)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {copiedId === t.id ? '✓ Gekopieerd' : 'Kopieer URL'}
          </button>
          {t.actief && (
            <button
              onClick={() => setQrToken(t)}
              style={{ ...touchButtonStyle, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              QR-code
            </button>
          )}
          {t.actief
            ? <button onClick={() => revokeToken(t.id)} style={{ ...touchButtonStyle, background: 'none', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, padding: '5px 12px', color: 'var(--red-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Intrekken</button>
            : (
              <>
                <button onClick={() => reactivateToken(t.id)} style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Heractiveren</button>
                <button
                  onClick={() => deleteToken(t)}
                  disabled={deletingId === t.id}
                  style={{ ...touchButtonStyle, background: 'none', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, padding: '5px 12px', color: 'var(--red-text)', fontSize: 12, fontWeight: 600, cursor: deletingId === t.id ? 'default' : 'pointer', opacity: deletingId === t.id ? 0.5 : 1, whiteSpace: 'nowrap' }}
                >
                  {deletingId === t.id ? 'Verwijderen...' : 'Verwijderen'}
                </button>
              </>
            )
          }
        </div>
      ))}
    </section>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ManagementPage() {
  const router = useRouter()
  const [trainers, setTrainers]           = useState<Trainer[]>([])
  const [leden, setLeden]                 = useState<Lid[]>([])
  const [trainerStats, setTrainerStats]   = useState<Record<string, TrainerStats>>({})
  const [consolePins, setConsolePins]     = useState<TrainerPin[]>([])
  const [ownPinPerson, setOwnPinPerson]   = useState<TrainerPin | null>(null)
  const [pinPerson, setPinPerson]         = useState<TrainerPin | null>(null)
  const [unreadCounts, setUnreadCounts]   = useState<Record<string, number>>({})
  const [totalUnread, setTotalUnread]     = useState(0)
  const [nextLidId, setNextLidId]         = useState('WE-001')
  const [loading, setLoading]             = useState(true)
  const [trainerFilter, setTrainerFilter] = useState<string>('allen')
  const [statusFilter,  setStatusFilter]  = useState<string>('allen')
  const [memberSearch, setMemberSearch]   = useState('')
  const [actieTrainer, setActieTrainer]   = useState<Trainer | null>(null)
  const [actieLid,     setActieLid]       = useState<Lid | null>(null)
  const [notitieTrainer, setNotitieTrainer] = useState<Trainer | null>(null)
  const [showAddLid, setShowAddLid]       = useState(false)
  const [showAddTrainer, setShowAddTrainer] = useState(false)
  const [showGestopt, setShowGestopt]     = useState(false)
  const [refreshKey, setRefreshKey]       = useState(0)
  const [deactivating, setDeactivating]   = useState<string | null>(null)
  const [reactivating, setReactivating]   = useState<string | null>(null)
  const [deletingLid,  setDeletingLid]    = useState<string | null>(null)
  const [reassigningLid, setReassigningLid] = useState<string | null>(null)

  // Open actie modal from trainer row (user picks lid)
  const openActieFromTrainer = (t: Trainer) => {
    setActieTrainer(t)
    setActieLid(null)
  }

  const openNotitieModal = (t: Trainer) => {
    setNotitieTrainer(t)
  }

  // Open actie modal from member row (lid + trainer pre-filled)
  const openActieFromLid = (l: Lid) => {
    const t = trainers.find(tr => tr.id === l.trainer_id)
    if (!t) return
    setActieTrainer(t)
    setActieLid(l)
  }

  const deactivateTrainer = async (t: Trainer) => {
    if (!confirm(`Deactiveer trainer ${t.voornaam} ${t.achternaam}?\n\nDeze trainer wordt op inactief gezet. Hun data blijft bewaard.`)) return
    setDeactivating(t.id)
    await fetch(`/api/management/trainers/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actief: false }),
    })
    setDeactivating(null)
    setRefreshKey(k => k + 1)
  }

  const stoptLid = async (l: Lid) => {
    if (!confirm(`Markeer ${l.voornaam} ${l.achternaam} als gestopt?\n\nHet lid wordt verborgen maar alle data blijft bewaard.`)) return
    setDeactivating(l.id)
    await fetch(`/api/management/leden/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actief: false, status: 'gestopt' }),
    })
    setDeactivating(null)
    setRefreshKey(k => k + 1)
  }

  const reactiveerLid = async (l: Lid) => {
    if (!confirm(`Heractiveer ${l.voornaam} ${l.achternaam}?\n\nHet lid wordt weer actief.`)) return
    setReactivating(l.id)
    await fetch(`/api/management/leden/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actief: true }),
    })
    setReactivating(null)
    setRefreshKey(k => k + 1)
  }

  const deleteLidPermanent = async (l: Lid) => {
    if (!confirm(`Verwijder lid ${l.voornaam} ${l.achternaam} permanent?\n\nDit verwijdert ook alle evaluaties, contactmomenten, notities en acties van dit lid. Dit kan niet ongedaan worden gemaakt.`)) return
    setDeletingLid(l.id)
    const res = await fetch(`/api/management/leden/${l.id}`, { method: 'DELETE' })
    setDeletingLid(null)
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      alert(err?.error ?? 'Verwijderen mislukt')
      return
    }
    setRefreshKey(k => k + 1)
  }

  const reassignLidTrainer = async (lid: Lid, newTrainerId: string) => {
    if (!newTrainerId || newTrainerId === lid.trainer_id) return
    setReassigningLid(lid.id)
    try {
      const res = await fetch(`/api/management/leden/${lid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainer_id: newTrainerId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.error ?? 'Trainer wijzigen mislukt')
        return
      }
      setRefreshKey(k => k + 1)
    } finally {
      setReassigningLid(null)
    }
  }

  const load = useCallback(async () => {
    try {
      const dataRes = await fetch('/api/management/data')
      const studioData = dataRes.ok ? await dataRes.json() : {}
      const trainerData  = (studioData.trainers   ?? []) as Trainer[]
      const ledenRaw     = (studioData.leden      ?? []) as { id: string; lid_id: string; voornaam: string; achternaam: string; actief: boolean; status: string | null; trainer_id: string; gestopt_op?: string | null }[]
      const contacten    = (studioData.contacten  ?? []) as { lid_id: string; datum: string }[]
      const evaluaties   = (studioData.evaluaties ?? []) as { lid_id: string; datum: string; slaap: number | null; energie: number | null; stress: number | null; cyclus: number }[]
      const actiesData   = (studioData.acties     ?? []) as { id: string; trainer_id: string; lid_id: string; deadline?: string | null; bron?: string | null; afgerond?: boolean | null }[]

      const unreadRes = await fetch('/api/trainer-notities')
      if (unreadRes.ok) {
        const { berichten } = await unreadRes.json()
        const arr = (berichten ?? []) as { trainer_id: string; gelezen_door_management: boolean }[]
        const unreadOnly = arr.filter(b => !b.gelezen_door_management)
        setTotalUnread(unreadOnly.length)
        const counts: Record<string, number> = {}
        for (const b of unreadOnly) {
          counts[b.trainer_id] = (counts[b.trainer_id] ?? 0) + 1
        }
        setUnreadCounts(counts)
      }

      try {
        const pinsRes = await fetch('/api/admin/pins')
        if (pinsRes.ok) {
          const pinsData = await pinsRes.json()
          setConsolePins(pinsData.trainers ?? [])
          setOwnPinPerson(pinsData.current_person ?? null)
        }
      } catch {
        // Route niet beschikbaar of geen JSON; laat PIN-acties leeg.
      }

      const enrichedLeden: Lid[] = ledenRaw.map(l => {
        const lastContact = (contacten ?? []).find(c => c.lid_id === l.id)
        const lastEval    = (evaluaties ?? []).find(e => e.lid_id === l.id)
        const lastContactDatum = getLatestContactDatum(lastContact?.datum, lastEval?.datum)
        return {
          ...l,
          gestopt_op:         l.gestopt_op ?? null,
          laatste_contact:   lastContactDatum,
          laatste_evaluatie: lastEval?.datum    ?? null,
          slaap:             lastEval?.slaap    ?? null,
          energie:           lastEval?.energie  ?? null,
          stress:            lastEval?.stress   ?? null,
        }
      })

      const stats: Record<string, TrainerStats> = {}
      for (const t of trainerData ?? []) {
        const tLeden = enrichedLeden.filter(l => l.trainer_id === t.id && l.actief)
        stats[t.id] = {
          trainer_id:  t.id,
          totaal:      tLeden.length,
          rood:        tLeden.filter(l => getLidStoplight(l) === 'red').length,
          amber:       tLeden.filter(l => getLidStoplight(l) === 'amber').length,
          open_acties: (actiesData ?? []).filter(a => a.trainer_id === t.id && isActieOpen(a.deadline ?? null, a.bron ?? 'management', a.afgerond ?? false)).length,
        }
      }
      const ids = (ledenRaw ?? [])
        .map(l => l.lid_id)
        .filter(id => /^WE-\d+$/.test(id))
        .map(id => parseInt(id.replace('WE-', ''), 10))
      const maxId = ids.length > 0 ? Math.max(...ids) : 0
      setNextLidId(`WE-${String(maxId + 1).padStart(3, '0')}`)

      setTrainers(trainerData ?? [])
      setLeden(enrichedLeden)
      setTrainerStats(stats)
    } catch (err) {
      console.error('Management load error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey intentionally recreates load after deactivation.
  }, [refreshKey])

  useEffect(() => { load() }, [load])

  const counts: StudioCounts = {
    actief:   leden.filter(l => l.actief && (l.status?.toLowerCase() === 'actief' || !l.status)).length,
    on_hold:  leden.filter(l => l.actief && l.status?.toLowerCase() !== 'actief' && !!l.status).length,
    gestopt:  leden.filter(l => !l.actief).length,
  }

  const visibleLeden = leden.filter(l => {
    if (!l.actief && l.status?.toLowerCase() === 'gestopt') return false
    const q = memberSearch.trim().toLowerCase()
    if (q) {
      const fullName = `${l.voornaam} ${l.achternaam}`.toLowerCase()
      if (
        !l.voornaam.toLowerCase().includes(q) &&
        !l.achternaam.toLowerCase().includes(q) &&
        !fullName.includes(q)
      ) return false
    }
    if (trainerFilter !== 'allen' && l.trainer_id !== trainerFilter) return false
    if (statusFilter !== 'allen') {
      const s = (l.status ?? (l.actief ? 'actief' : 'inactief')).toLowerCase().replace(' ', '_')
      const f = statusFilter.toLowerCase().replace(' ', '_')
      if (s !== f) return false
    }
    return true
  })
  const gestoptLeden = leden.filter(l => !l.actief && l.status?.toLowerCase() === 'gestopt')
  const pinByTrainerId = Object.fromEntries(
    consolePins.filter(p => p.type === 'trainer').map(p => [p.trainer_id, p])
  ) as Record<string, TrainerPin>
  const ownPinAction = ownPinPerson ?? CURRENT_MANAGEMENT_PIN

  if (loading) return (
    <>
      <Navigation />
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Laden…</div>
      </div>
    </>
  )

  return (
    <>
      <Navigation />

      {pinPerson && (
        <PinDialog
          person={pinPerson}
          onClose={() => setPinPerson(null)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}

      {actieTrainer && (
        <ActieModal
          trainer={actieTrainer}
          leden={leden}
          prefillLid={actieLid}
          onClose={() => { setActieTrainer(null); setActieLid(null) }}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}

      {notitieTrainer && (
        <NotitieModal
          trainer={notitieTrainer}
          leden={leden}
          onClose={() => setNotitieTrainer(null)}
          onSaved={() => {}}
        />
      )}

      {showAddLid && (
        <AddLidModal
          trainers={trainers}
          nextLidId={nextLidId}
          onClose={() => setShowAddLid(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}

      {showAddTrainer && (
        <AddTrainerModal
          onClose={() => setShowAddTrainer(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}

      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Management</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Studio-overzicht · Wav-e</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="/management/berichten"
              style={{ ...touchButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', touchAction: 'manipulation' }}
            >
              Berichten
              {totalUnread > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9, background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-text)', fontSize: 10, fontWeight: 700, padding: '0 5px', lineHeight: 1 }}>
                  {totalUnread}
                </span>
              )}
            </a>
            <button
              onClick={() => setShowAddLid(true)}
              style={{ ...touchButtonStyle, background: 'var(--color-accent, var(--color-accent))', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              + Lid toevoegen
            </button>
          </div>
        </div>

        {/* Studio counts */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {([
            { label: 'Actief',  value: counts.actief,  color: 'var(--green-signal)' },
            { label: 'On hold', value: counts.on_hold, color: 'var(--amber)' },
            { label: 'Gestopt', value: counts.gestopt, color: 'var(--text-quieter)' },
          ]).map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </section>
{/* Trainers */}
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'visible' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Trainers</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{trainers.filter(t => t.actief).length} actief</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPinPerson(ownPinAction)}
                style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
              >
                {ownPinAction.has_pin ? 'Eigen PIN wijzigen' : 'Eigen PIN instellen'}
              </button>
              <button
                onClick={() => setShowAddTrainer(true)}
                style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
              >
                + Trainer toevoegen
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Trainer', 'Email', 'Leden', 'Rood', 'Amber', 'Acties', 'PIN', '', 'Notitie', ''].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '10px 20px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainers.map((t, i) => {
                const s = trainerStats[t.id] ?? { totaal: 0, rood: 0, amber: 0, open_acties: 0 }
                return (
                  <tr key={t.id} style={{ borderBottom: i < trainers.length - 1 ? '1px solid var(--border-subtle)' : 'none', opacity: t.actief ? 1 : 0.5 }}>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
                        <span
                          onClick={() => router.push(`/trainer/${t.id}`)}
                          style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--text-muted)')}
                          onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                        >
                          {t.voornaam} {t.achternaam}
                        </span>
                        {(unreadCounts[t.id] ?? 0) > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9, background: 'rgba(99,102,241,0.15)', color: 'var(--color-accent-text)', fontSize: 10, fontWeight: 700, padding: '0 5px', lineHeight: 1 }}>
                            {unreadCounts[t.id]}
                          </span>
                        )}
                      </span>
                      {!t.actief && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>inactief</span>}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{t.email}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{s.totaal}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: s.rood > 0 ? 'var(--red-text)' : 'var(--text-muted)', textAlign: 'center' }}>{s.rood}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: s.amber > 0 ? 'var(--amber-text)' : 'var(--text-muted)', textAlign: 'center' }}>{s.amber}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: s.open_acties > 0 ? 'var(--color-accent-text)' : 'var(--text-muted)', textAlign: 'center' }}>{s.open_acties}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      {(() => {
                        const pinPersonForTrainer = pinByTrainerId[t.id] ?? {
                          trainer_id: t.id,
                          naam: `${t.voornaam} ${t.achternaam}`,
                          has_pin: false,
                          type: 'trainer' as const,
                        }
                        return (
                          <button
                            onClick={() => setPinPerson(pinPersonForTrainer)}
                            style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {pinPersonForTrainer.has_pin ? 'PIN wijzigen' : 'PIN instellen'}
                          </button>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => openActieFromTrainer(t)}
                        style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '5px 0', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s, color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        + Actie
                      </button>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => openNotitieModal(t)}
                        style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '5px 0', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s, color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        + Notitie
                      </button>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      {t.actief && (
                        <button
                          onClick={() => deactivateTrainer(t)}
                          disabled={deactivating === t.id}
                          style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '5px 0', color: 'var(--red-text)', fontSize: 12, fontWeight: 600, cursor: deactivating === t.id ? 'default' : 'pointer', opacity: deactivating === t.id ? 0.5 : 1, whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => { if (deactivating !== t.id) e.currentTarget.style.textDecorationColor = 'var(--red-text)' }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent' }}
                        >
                          {deactivating === t.id ? '…' : 'Deactiveer'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        {/* Console panel */}
        <ConsolePanel />

        {/* Member table */}
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Leden · {visibleLeden.length}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <input
                type="search"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Zoek lid..."
                style={{ ...inputStyle, width: 220, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: '1rem' }}
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: '1rem' }}>
                <option value="allen">Alle statussen</option>
                <option value="actief">Actief</option>
                <option value="bevroren">Bevroren</option>
                <option value="on_hold">On hold</option>
                <option value="stopt">Stopt</option>
                <option value="inactief">Inactief</option>
              </select>
              <select value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: '1rem' }}>
                <option value="allen">Alle trainers</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>)}
              </select>
            </div>
          </div>

          {visibleLeden.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen leden gevonden</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 150px minmax(0, 1fr) 100px 160px', padding: '8px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)', columnGap: 12 }}>
                {['Naam', 'Status', 'Trainer', 'Wijzig trainer', 'Lid-ID', ''].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</span>
                ))}
              </div>
              {visibleLeden.map((l, i) => {
                const trainer = trainers.find(t => t.id === l.trainer_id)
                return (
                  <div
                    key={l.id}
                    onClick={() => router.push(`/leden/${l.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 150px minmax(0, 1fr) 100px 160px', padding: '10px 24px', minHeight: 72, overflow: 'visible', borderBottom: i < visibleLeden.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer', columnGap: 12 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--text-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                    >{l.voornaam} {l.achternaam}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_COLOR[l.status?.toLowerCase() ?? ''] ?? 'var(--text-muted)' }}>
                      {l.status ?? (l.actief ? 'actief' : 'inactief')}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trainer ? `${trainer.voornaam} ${trainer.achternaam}` : '—'}</span>
                    <span onClick={e => e.stopPropagation()}>
                      <select
                        value=""
                        disabled={reassigningLid === l.id}
                        onChange={e => {
                          e.stopPropagation()
                          reassignLidTrainer(l, e.target.value)
                        }}
                        style={{ ...inputStyle, width: 110, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: '1rem', opacity: reassigningLid === l.id ? 0.6 : 1 }}
                      >
                        <option value="" disabled hidden>Wijzig</option>
                        {trainers.map(t => <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>)}
                      </select>
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--border-strong)', fontFamily: 'monospace' }}>{l.lid_id}</span>
                    <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, textAlign: 'right', minWidth: 160, width: 160 }}>
                      {l.actief && (
                        <button
                          onClick={e => { e.stopPropagation(); openActieFromLid(l) }}
                          style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '4px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s, color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          + Actie
                        </button>
                      )}
                      {l.actief && (
                        <button
                          onClick={e => { e.stopPropagation(); stoptLid(l) }}
                          disabled={deactivating === l.id}
                          style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '4px 0', color: 'var(--red-text)', fontSize: 11, fontWeight: 600, cursor: deactivating === l.id ? 'default' : 'pointer', opacity: deactivating === l.id ? 0.5 : 1, whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => { if (deactivating !== l.id) e.currentTarget.style.textDecorationColor = 'var(--red-text)' }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent' }}
                        >
                          {deactivating === l.id ? '…' : 'Gestopt'}
                        </button>
                      )}
                      {!l.actief && (
                        <button
                          onClick={e => { e.stopPropagation(); reactiveerLid(l) }}
                          disabled={reactivating === l.id}
                          style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '4px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: reactivating === l.id ? 'default' : 'pointer', opacity: reactivating === l.id ? 0.5 : 1, whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s, color 0.15s' }}
                          onMouseEnter={e => { if (reactivating !== l.id) { e.currentTarget.style.textDecorationColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          {reactivating === l.id ? '…' : 'Heractiveren'}
                        </button>
                      )}
                      {!l.actief && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteLidPermanent(l) }}
                          disabled={deletingLid === l.id}
                          style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '4px 0', color: 'var(--red-text)', fontSize: 11, fontWeight: 600, cursor: deletingLid === l.id ? 'default' : 'pointer', opacity: deletingLid === l.id ? 0.5 : 1, whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => { if (deletingLid !== l.id) e.currentTarget.style.textDecorationColor = 'var(--red-text)' }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent' }}
                        >
                          {deletingLid === l.id ? '…' : 'Verwijder'}
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {gestoptLeden.length > 0 && (
          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
            <div
              onClick={() => setShowGestopt(s => !s)}
              style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
                Gestopte leden ({gestoptLeden.length})
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: showGestopt ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
            </div>
            {showGestopt && gestoptLeden.map(l => (
              <div key={l.id} style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, opacity: 0.7 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{l.voornaam} {l.achternaam}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.lid_id}</div>
                </div>
                <button
                  onClick={() => reactiveerLid(l)}
                  disabled={reactivating === l.id}
                  style={{ minHeight: 44, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 14px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: reactivating === l.id ? 0.5 : 1 }}
                >
                  {reactivating === l.id ? 'Heractiveren…' : 'Heractiveer'}
                </button>
              </div>
            ))}
          </section>
        )}

      </div>
    </>
  )
}
