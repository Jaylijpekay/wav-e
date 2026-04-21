'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
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
  laatste_contact: string | null
  laatste_evaluatie: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
}

type StudioCounts = {
  actief: number
  bevroren: number
  on_hold: number
  stopt: number
  inactief: number
}

// ── Helpers ────────────────────────────────────────────────────────────

const daysSince = (date: string | null): number | null => {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

const getStoplight = (lid: Lid): 'red' | 'amber' | 'green' => {
  const dagsSindsContact = daysSince(lid.laatste_contact)
  const dagsSindsEval    = daysSince(lid.laatste_evaluatie)
  const hasRedLifestyle  =
    (lid.slaap   !== null && lid.slaap   < 6) ||
    (lid.energie !== null && lid.energie < 6) ||
    (lid.stress  !== null && lid.stress  > 7)
  if (dagsSindsEval === null || dagsSindsEval > 42 || hasRedLifestyle) return 'red'
  if (dagsSindsContact === null || dagsSindsContact > 14) return 'amber'
  return 'green'
}

const daysSinceLabel = (date: string | null, neverLabel = 'Nooit gebruikt'): string => {
  if (!date) return neverLabel
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'Vandaag'
  if (d === 1) return 'Gisteren'
  return `${d} dagen geleden`
}

const consoleUrl = (token: string): string => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/console?token=${token}`
}

const STATUS_COLOR: Record<string, string> = {
  actief:    '#4ade80',
  bevroren:  '#60a5fa',
  'on hold': '#fbbf24',
  on_hold:   '#fbbf24',
  stopt:     '#f87171',
  inactief:  '#555',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--text-primary)',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
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
    const supabase = getSupabase()
    const { error: err } = await supabase.from('leden').insert({
      lid_id:     lidId.trim().toUpperCase(),
      voornaam:   voornaam.trim(),
      achternaam: achternaam.trim(),
      email:      email.trim() || null,
      telefoon:   telefoon.trim() || null,
      trainer_id: trainerId,
      startdatum,
      source:     'manual',
      actief:     true,
      status:     'Actief',
    })
    setSaving(false)

    if (err) {
      setError(err.message.includes('unique') ? `Lid-ID "${lidId}" bestaat al` : err.message)
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
          <div style={{ fontSize: 13, color: '#f87171', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Annuleren
          </button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
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
    if (!lidId)               { setError('Selecteer een lid'); return }
    if (!omschrijving.trim()) { setError('Omschrijving is verplicht'); return }
    setSaving(true)
    const supabase = getSupabase()
    const { error: err } = await supabase.from('acties').insert({
      trainer_id: trainer.id, lid_id: lidId, type: 'custom',
      omschrijving: omschrijving.trim(), deadline: deadline || null,
      status: 'open', bron: 'management', afgerond: false,
      aangemaakt_door: null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
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
        <Field label="Lid">
          <select
            value={lidId}
            onChange={e => setLidId(e.target.value)}
            disabled={!!prefillLid}
            style={{ ...inputStyle, color: lidId ? 'var(--text-primary)' : 'var(--text-muted)', opacity: prefillLid ? 0.7 : 1 }}
          >
            <option value="">Selecteer lid…</option>
            {trainerLeden.map(l => (
              <option key={l.id} value={l.id}>{l.voornaam} {l.achternaam}</option>
            ))}
          </select>
        </Field>
        <Field label="Omschrijving">
          <textarea value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Wat moet deze trainer doen?" rows={3}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Field>
        <Field label="Deadline (optioneel)">
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
        </Field>
        {error && <div style={{ fontSize: 13, color: '#f87171', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuleren</button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Toewijzen'}
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
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const save = async () => {
    setError(null)
    if (!voornaam.trim())   { setError('Voornaam is verplicht'); return }
    if (!achternaam.trim()) { setError('Achternaam is verplicht'); return }
    if (!email.trim())      { setError('Email is verplicht'); return }

    setSaving(true)
    const supabase = getSupabase()
    const { error: err } = await supabase.from('trainers').insert({
      voornaam:   voornaam.trim(),
      achternaam: achternaam.trim(),
      email:      email.trim(),
      naam:       `${voornaam.trim()} ${achternaam.trim()}`,
      actief:     true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved(); onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Nieuwe trainer toevoegen</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Trainer wordt direct actief</div>
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
        {error && <div style={{ fontSize: 13, color: '#f87171', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Annuleren</button>
          <button onClick={save} disabled={saving} style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Opslaan…' : 'Trainer toevoegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Console Panel ──────────────────────────────────────────────────────

function ConsolePanel() {
  const [tokens,   setTokens]   = useState<ConsoleToken[]>([])
  const [loading,  setLoading]  = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [newNaam,  setNewNaam]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadTokens = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('console_tokens')
      .select('id, token, naam, actief, aangemaakt_op, laatst_gebruikt')
      .order('aangemaakt_op', { ascending: false })
    setTokens(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTokens() }, [loadTokens])

  const createToken = async () => {
    if (!newNaam.trim()) return
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('console_tokens').insert({
      naam:            newNaam.trim(),
      trainer_id:      null,
      aangemaakt_door: user!.id,
    })
    setNewNaam('')
    setFormOpen(false)
    setSaving(false)
    loadTokens()
  }

  const revokeToken     = async (id: string) => { await getSupabase().from('console_tokens').update({ actief: false }).eq('id', id); loadTokens() }
  const reactivateToken = async (id: string) => { await getSupabase().from('console_tokens').update({ actief: true  }).eq('id', id); loadTokens() }

  const copyUrl = (t: ConsoleToken) => {
    navigator.clipboard.writeText(consoleUrl(t.token))
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: formOpen || tokens.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Studio consoles</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Apparaten met toegang zonder trainer-login</div>
        </div>
        <button
          onClick={() => { setFormOpen(o => !o); setNewNaam('') }}
          style={{ background: formOpen ? 'none' : 'var(--color-accent, #6366f1)', color: formOpen ? 'var(--text-muted)' : '#fff', border: formOpen ? '1px solid var(--border-subtle)' : 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
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
            style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', opacity: saving || !newNaam.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
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
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: copiedId === t.id ? '#4ade80' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {copiedId === t.id ? '✓ Gekopieerd' : 'Kopieer URL'}
          </button>
          {t.actief
            ? <button onClick={() => revokeToken(t.id)} style={{ background: 'none', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, padding: '5px 12px', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Intrekken</button>
            : <button onClick={() => reactivateToken(t.id)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Heractiveren</button>
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
  const [nextLidId, setNextLidId]         = useState('WE-001')
  const [loading, setLoading]             = useState(true)
  const [trainerFilter, setTrainerFilter] = useState<string>('allen')
  const [statusFilter,  setStatusFilter]  = useState<string>('allen')
  const [actieTrainer, setActieTrainer]   = useState<Trainer | null>(null)
  const [actieLid,     setActieLid]       = useState<Lid | null>(null)
  const [showAddLid, setShowAddLid]       = useState(false)
  const [showAddTrainer, setShowAddTrainer] = useState(false)
  const [refreshKey, setRefreshKey]       = useState(0)
  const [deactivating, setDeactivating]   = useState<string | null>(null)

  // Open actie modal from trainer row (user picks lid)
  const openActieFromTrainer = (t: Trainer) => {
    setActieTrainer(t)
    setActieLid(null)
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
    const supabase = getSupabase()
    await supabase.from('trainers').update({ actief: false }).eq('id', t.id)
    setDeactivating(null)
    setRefreshKey(k => k + 1)
  }

  const deactivateLid = async (l: Lid) => {
    if (!confirm(`Deactiveer lid ${l.voornaam} ${l.achternaam}?\n\nDit lid wordt op inactief gezet. Hun data blijft bewaard.`)) return
    setDeactivating(l.id)
    const supabase = getSupabase()
    await supabase.from('leden').update({ actief: false, status: 'inactief' }).eq('id', l.id)
    setDeactivating(null)
    setRefreshKey(k => k + 1)
  }

  const load = useCallback(async () => {
    const supabase = getSupabase()

    const [
      { data: trainerData },
      { data: ledenRaw },
      { data: contacten },
      { data: evaluaties },
      { data: actiesData },
    ] = await Promise.all([
      supabase.from('trainers').select('id, voornaam, achternaam, naam, email, actief').order('achternaam'),
      supabase.from('leden').select('id, lid_id, voornaam, achternaam, actief, status, trainer_id').order('achternaam'),
      supabase.from('contact_momenten').select('lid_id, datum').order('datum', { ascending: false }),
      supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').order('cyclus', { ascending: false }),
      supabase.from('acties').select('id, trainer_id, lid_id').eq('status', 'open'),
    ])

    const enrichedLeden: Lid[] = (ledenRaw ?? []).map(l => {
      const lastContact = (contacten ?? []).find(c => c.lid_id === l.id)
      const lastEval    = (evaluaties ?? []).find(e => e.lid_id === l.id)
      return {
        ...l,
        laatste_contact:   lastContact?.datum ?? null,
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
        rood:        tLeden.filter(l => getStoplight(l) === 'red').length,
        amber:       tLeden.filter(l => getStoplight(l) === 'amber').length,
        open_acties: (actiesData ?? []).filter(a => a.trainer_id === t.id).length,
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
    setLoading(false)
  }, [refreshKey])

  useEffect(() => { load() }, [load])

  const counts: StudioCounts = {
    actief:   leden.filter(l => l.status?.toLowerCase() === 'actief').length,
    bevroren: leden.filter(l => l.status?.toLowerCase() === 'bevroren').length,
    on_hold:  leden.filter(l => l.status?.toLowerCase() === 'on_hold' || l.status?.toLowerCase() === 'on hold').length,
    stopt:    leden.filter(l => l.status?.toLowerCase() === 'stopt').length,
    inactief: leden.filter(l => l.status?.toLowerCase() === 'inactief' || !l.actief).length,
  }

  const visibleLeden = leden.filter(l => {
    if (trainerFilter !== 'allen' && l.trainer_id !== trainerFilter) return false
    if (statusFilter !== 'allen') {
      const s = (l.status ?? (l.actief ? 'actief' : 'inactief')).toLowerCase().replace(' ', '_')
      const f = statusFilter.toLowerCase().replace(' ', '_')
      if (s !== f) return false
    }
    return true
  })

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

      {actieTrainer && (
        <ActieModal
          trainer={actieTrainer}
          leden={leden}
          prefillLid={actieLid}
          onClose={() => { setActieTrainer(null); setActieLid(null) }}
          onSaved={() => setRefreshKey(k => k + 1)}
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

      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px 24px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Management</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Studio-overzicht · Wav-e</p>
          </div>
          <button
            onClick={() => setShowAddLid(true)}
            style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Lid toevoegen
          </button>
        </div>

        {/* Studio counts */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {([
            { label: 'Actief',   value: counts.actief,   color: '#16a34a' },
            { label: 'Bevroren', value: counts.bevroren, color: '#d97706' },
            { label: 'On hold',  value: counts.on_hold,  color: '#d97706' },
            { label: 'Stopt',    value: counts.stopt,    color: '#dc2626' },
            { label: 'Inactief', value: counts.inactief, color: '#444'    },
          ]).map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </section>
{/* Trainers */}
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Trainers</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{trainers.filter(t => t.actief).length} actief</div>
            </div>
            <button
              onClick={() => setShowAddTrainer(true)}
              style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
            >
              + Trainer toevoegen
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Trainer', 'Email', 'Leden', 'Rood', 'Amber', 'Acties', '', ''].map(h => (
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
                      <span
                        onClick={() => router.push(`/trainer/${t.id}`)}
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--text-muted)')}
                        onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                      >
                        {t.voornaam} {t.achternaam}
                      </span>
                      {!t.actief && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555' }}>inactief</span>}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-muted)' }}>{t.email}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{s.totaal}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: s.rood > 0 ? '#f87171' : 'var(--text-muted)', textAlign: 'center' }}>{s.rood}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: s.amber > 0 ? '#fbbf24' : 'var(--text-muted)', textAlign: 'center' }}>{s.amber}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: s.open_acties > 0 ? '#818cf8' : 'var(--text-muted)', textAlign: 'center' }}>{s.open_acties}</td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => openActieFromTrainer(t)}
                        style={{ background: 'none', border: 'none', padding: '5px 0', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s, color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        + Actie
                      </button>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      {t.actief && (
                        <button
                          onClick={() => deactivateTrainer(t)}
                          disabled={deactivating === t.id}
                          style={{ background: 'none', border: 'none', padding: '5px 0', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: deactivating === t.id ? 'default' : 'pointer', opacity: deactivating === t.id ? 0.5 : 1, whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => { if (deactivating !== t.id) e.currentTarget.style.textDecorationColor = '#f87171' }}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Leden · {visibleLeden.length}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="allen">Alle statussen</option>
                <option value="actief">Actief</option>
                <option value="bevroren">Bevroren</option>
                <option value="on_hold">On hold</option>
                <option value="stopt">Stopt</option>
                <option value="inactief">Inactief</option>
              </select>
              <select value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="allen">Alle trainers</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>)}
              </select>
            </div>
          </div>

          {visibleLeden.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen leden gevonden</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px auto auto', padding: '8px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Naam', 'Trainer', 'Status', 'Lid-ID', '', ''].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</span>
                ))}
              </div>
              {visibleLeden.map((l, i) => {
                const trainer = trainers.find(t => t.id === l.trainer_id)
                return (
                  <div
                    key={l.id}
                    onClick={() => router.push(`/leden/${l.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px auto auto', padding: '12px 24px', borderBottom: i < visibleLeden.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center', transition: 'background 0.12s', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--text-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                    >{l.voornaam} {l.achternaam}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{trainer ? `${trainer.voornaam} ${trainer.achternaam}` : '—'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_COLOR[l.status?.toLowerCase() ?? ''] ?? 'var(--text-muted)' }}>
                      {l.status ?? (l.actief ? 'actief' : 'inactief')}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--border-strong)', fontFamily: 'monospace' }}>{l.lid_id}</span>
                    <span style={{ textAlign: 'right' }}>
                      {l.actief && (
                        <button
                          onClick={e => { e.stopPropagation(); openActieFromLid(l) }}
                          style={{ background: 'none', border: 'none', padding: '4px 0', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s, color 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          + Actie
                        </button>
                      )}
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      {l.actief && (
                        <button
                          onClick={e => { e.stopPropagation(); deactivateLid(l) }}
                          disabled={deactivating === l.id}
                          style={{ background: 'none', border: 'none', padding: '4px 0', color: '#f87171', fontSize: 11, fontWeight: 600, cursor: deactivating === l.id ? 'default' : 'pointer', opacity: deactivating === l.id ? 0.5 : 1, whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => { if (deactivating !== l.id) e.currentTarget.style.textDecorationColor = '#f87171' }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent' }}
                        >
                          {deactivating === l.id ? '…' : 'Deactiveer'}
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </>
  )
}
