'use client'

import { useState, useEffect, useCallback } from 'react'

// ============================================================
// TYPES
// ============================================================

type UserRow = {
  id: string
  email: string
  created_at: string
  role: 'admin' | 'management' | 'trainer' | null
  trainer_id: string | null
  trainer_naam: string | null
}

type TrainerPin = {
  trainer_id: string
  naam: string
  has_pin: boolean
  type: 'trainer' | 'management'
}

type ConsoleToken = {
  id: string
  token: string
  naam: string
  actief: boolean
  aangemaakt_op: string
  laatst_gebruikt: string | null
}

// ============================================================
// SHARED STYLES
// ============================================================

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

// ============================================================
// ROLE BADGE
// ============================================================

const ROLE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  admin:      { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', label: 'Admin' },
  management: { bg: 'rgba(217,119,6,0.10)',  color: '#fbbf24', label: 'Management' },
  trainer:    { bg: 'rgba(22,163,74,0.10)',   color: '#4ade80', label: 'Trainer' },
}

function RoleBadge({ role }: { role: string | null }) {
  const s = role ? ROLE_STYLE[role] : null
  if (!s) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

// ============================================================
// PIN ROW
// ============================================================

function PinRow({ trainer, onSaved }: { trainer: TrainerPin; onSaved: () => void }) {
  const [open,    setOpen]    = useState(false)
  const [pin,     setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [ok,      setOk]      = useState(false)

  const reset = () => { setPin(''); setConfirm(''); setError(null); setOk(false); setOpen(false) }

  const save = async () => {
    setError(null)
    if (!/^\d{4}$/.test(pin)) { setError('PIN moet exact 4 cijfers zijn'); return }
    if (pin !== confirm)       { setError('PINs komen niet overeen'); return }
    setSaving(true)

    const endpoint = trainer.type === 'management' ? '/api/admin/pin-management' : '/api/admin/pin'
    const body = trainer.type === 'management'
      ? { management_id: trainer.trainer_id, pin }
      : { trainer_id: trainer.trainer_id, pin }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setOk(true)
    setTimeout(() => { reset(); onSaved() }, 800)
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{trainer.naam}</div>
            {trainer.type === 'management' && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fbbf24', background: 'rgba(217,119,6,0.10)', padding: '2px 7px', borderRadius: 4 }}>
                management
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: trainer.has_pin ? '#4ade80' : '#3a3a3a', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: trainer.has_pin ? '#4ade80' : '#555', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
            {trainer.has_pin ? 'PIN ingesteld' : 'Geen PIN'}
          </span>
        </div>

        <button
          onClick={() => { setOpen(o => !o); setError(null); setOk(false) }}
          style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {open ? 'Annuleren' : trainer.has_pin ? 'Reset PIN' : 'Stel in'}
        </button>
      </div>

      {open && (
        <div style={{ padding: '16px 24px 20px', background: 'var(--bg-raised)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nieuwe PIN (4 cijfers)">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }}
              />
            </Field>
            <Field label="Bevestig PIN">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={confirm}
                onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }}
              />
            </Field>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#f87171', padding: '6px 10px', background: 'rgba(220,38,38,0.07)', borderRadius: 6 }}>{error}</div>
          )}
          {ok && (
            <div style={{ fontSize: 12, color: '#4ade80', padding: '6px 10px', background: 'rgba(22,163,74,0.07)', borderRadius: 6 }}>✓ PIN opgeslagen</div>
          )}

          <button
            onClick={save}
            disabled={saving || pin.length < 4 || confirm.length < 4}
            style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving || pin.length < 4 || confirm.length < 4 ? 0.5 : 1, alignSelf: 'flex-start' }}
          >
            {saving ? 'Opslaan…' : 'PIN opslaan'}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// CONSOLE TOKEN PANEL
// ============================================================

const consoleUrl = (token: string): string => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/console?token=${token}`
}

const daysSinceLabel = (date: string | null): string => {
  if (!date) return 'Nooit gebruikt'
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'Vandaag'
  if (d === 1) return 'Gisteren'
  return `${d} dagen geleden`
}

function ConsolePanel() {
  const [tokens,    setTokens]    = useState<ConsoleToken[]>([])
  const [loading,   setLoading]   = useState(true)
  const [formOpen,  setFormOpen]  = useState(false)
  const [newNaam,   setNewNaam]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [copiedId,  setCopiedId]  = useState<string | null>(null)

  const loadTokens = useCallback(async () => {
    const res = await fetch('/api/admin/console-tokens')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setTokens(data.tokens ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTokens() }, [loadTokens])

  const createToken = async () => {
    if (!newNaam.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin/console-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naam: newNaam.trim() }),
    })
    setSaving(false)
    if (!res.ok) return
    setNewNaam('')
    setFormOpen(false)
    loadTokens()
  }

  const revokeToken     = async (id: string) => { await fetch(`/api/admin/console-tokens?id=${id}`, { method: 'DELETE' }); loadTokens() }
  const reactivateToken = async (id: string) => { await fetch('/api/admin/console-tokens', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, actief: true }) }); loadTokens() }

  const copyUrl = (t: ConsoleToken) => {
    navigator.clipboard.writeText(consoleUrl(t.token))
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: formOpen || tokens.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Studio consoles</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Apparaten met toegang zonder trainer-login</div>
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
            style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving || !newNaam.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >
            {saving ? 'Aanmaken…' : 'Aanmaken'}
          </button>
        </div>
      )}

      {loading && (
        <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 13 }}>Laden…</div>
      )}

      {!loading && tokens.length === 0 && !formOpen && (
        <div style={{ padding: '20px 24px', color: 'var(--text-muted)', fontSize: 13 }}>Geen consoles aangemaakt.</div>
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
    </div>
  )
}

// ============================================================
// ADMIN PAGE
// ============================================================

export default function AdminPage() {
  const [users,    setUsers]    = useState<UserRow[]>([])
  const [trainers, setTrainers] = useState<TrainerPin[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [voornaam,   setVoornaam]   = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [role,       setRole]       = useState<'trainer' | 'management'>('trainer')
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [formOk,     setFormOk]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, pinsRes] = await Promise.all([
      fetch('/api/admin/list'),
      fetch('/api/admin/pins'),
    ])
    const usersData = await usersRes.json()
    const pinsData  = pinsRes.ok ? await pinsRes.json() : { trainers: [] }
    setUsers(usersData.users ?? [])
    setTrainers(pinsData.trainers ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setVoornaam(''); setAchternaam(''); setEmail(''); setPassword('')
    setRole('trainer'); setFormError(null); setFormOk(null)
  }

  const createUser = async () => {
    setFormError(null); setFormOk(null)
    if (!voornaam.trim() || !achternaam.trim()) { setFormError('Voornaam en achternaam zijn verplicht'); return }
    if (!email || !password) { setFormError('Email en wachtwoord zijn verplicht'); return }
    setSaving(true)
    const res = await fetch('/api/admin/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voornaam, achternaam, email, password, role }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(data.error); return }
    setFormOk(`${voornaam} ${achternaam} aangemaakt als ${role}.`)
    resetForm()
    load()
  }

  const deleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Verwijder gebruiker ${userEmail}?\n\nDit verwijdert ook het bijbehorende profiel. Niet ongedaan te maken.`)) return
    setDeleting(userId)
    await fetch('/api/admin/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId }),
    })
    setDeleting(null)
    load()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Admin</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Gebruikersbeheer · Wav-e</div>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); resetForm() }}
          style={{ background: showForm ? 'var(--bg-raised)' : 'var(--color-accent, #6366f1)', color: showForm ? 'var(--text-muted)' : '#fff', border: showForm ? '1px solid var(--border-subtle)' : 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {showForm ? '× Annuleren' : '+ Nieuwe gebruiker'}
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {formOk && !showForm && (
          <div style={{ fontSize: 13, color: '#4ade80', padding: '10px 16px', background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.2)' }}>✓ {formOk}</div>
        )}

        {/* Create form */}
        {showForm && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Nieuwe gebruiker aanmaken</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Voornaam"><input type="text" value={voornaam} onChange={e => setVoornaam(e.target.value)} placeholder="Robin" style={inputStyle} /></Field>
              <Field label="Achternaam"><input type="text" value={achternaam} onChange={e => setAchternaam(e.target.value)} placeholder="de Vries" style={inputStyle} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 12 }}>
              <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="naam@wav-e.nl" style={inputStyle} /></Field>
              <Field label="Wachtwoord"><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 tekens" style={inputStyle} /></Field>
              <Field label="Rol">
                <select value={role} onChange={e => setRole(e.target.value as 'trainer' | 'management')} style={inputStyle}>
                  <option value="trainer">Trainer</option>
                  <option value="management">Management</option>
                </select>
              </Field>
            </div>
            {formError && <div style={{ fontSize: 13, color: '#f87171', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>{formError}</div>}
            {formOk   && <div style={{ fontSize: 13, color: '#4ade80', padding: '8px 12px', background: 'rgba(22,163,74,0.07)', borderRadius: 8 }}>✓ {formOk}</div>}
            <button onClick={createUser} disabled={saving} style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start' }}>
              {saving ? 'Aanmaken…' : 'Aanmaken'}
            </button>
          </div>
        )}

        {/* User list */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            Gebruikers ({users.length})
          </div>
          {loading ? (
            <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Laden…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Geen gebruikers gevonden</div>
          ) : (
            users.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: i < users.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{u.trainer_naam ?? u.email}</div>
                  {u.trainer_naam && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{u.email}</div>}
                </div>
                <RoleBadge role={u.role} />
                {u.role !== 'admin' && (
                  <button
                    onClick={() => deleteUser(u.id, u.email ?? '')}
                    disabled={deleting === u.id}
                    style={{ background: 'none', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, color: '#f87171', padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: deleting === u.id ? 'default' : 'pointer', opacity: deleting === u.id ? 0.5 : 1 }}
                  >
                    {deleting === u.id ? '…' : 'Verwijder'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Console tokens */}
        <ConsolePanel />

        {/* Console PINs */}
        {!loading && trainers.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Console PINs</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>4-cijferige PIN per persoon · toegang tot studio console</div>
            </div>
            {trainers.map(t => (
              <PinRow key={t.trainer_id} trainer={t} onSaved={load} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
