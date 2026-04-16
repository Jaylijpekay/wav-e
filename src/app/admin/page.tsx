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
// ADMIN PAGE
// ============================================================

export default function AdminPage() {
  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)

  // Form
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
    const res = await fetch('/api/admin/list')
    const data = await res.json()
    setUsers(data.users ?? [])
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
    const res = await fetch('/api/admin/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId }),
    })
    setDeleting(null)
    if (res.ok) load()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)', padding: '20px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-surface)',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Admin</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Gebruikersbeheer · Wav-e</div>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); resetForm() }}
          style={{
            background: showForm ? 'var(--bg-raised)' : 'var(--color-accent, #6366f1)',
            color: showForm ? 'var(--text-muted)' : '#fff',
            border: showForm ? '1px solid var(--border-subtle)' : 'none',
            borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {showForm ? '× Annuleren' : '+ Nieuwe gebruiker'}
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Success banner (outside form, persists after form closes) */}
        {formOk && !showForm && (
          <div style={{ fontSize: 13, color: '#4ade80', padding: '10px 16px', background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.2)' }}>
            ✓ {formOk}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Nieuwe gebruiker aanmaken</div>

            {/* Row 1: naam */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Voornaam">
                <input type="text" value={voornaam} onChange={e => setVoornaam(e.target.value)}
                  placeholder="Robin" style={inputStyle} />
              </Field>
              <Field label="Achternaam">
                <input type="text" value={achternaam} onChange={e => setAchternaam(e.target.value)}
                  placeholder="de Vries" style={inputStyle} />
              </Field>
            </div>

            {/* Row 2: credentials + rol */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 12 }}>
              <Field label="Email">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="naam@wav-e.nl" style={inputStyle} />
              </Field>
              <Field label="Wachtwoord">
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 tekens" style={inputStyle} />
              </Field>
              <Field label="Rol">
                <select value={role} onChange={e => setRole(e.target.value as 'trainer' | 'management')} style={inputStyle}>
                  <option value="trainer">Trainer</option>
                  <option value="management">Management</option>
                </select>
              </Field>
            </div>

            {formError && (
              <div style={{ fontSize: 13, color: '#f87171', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
                {formError}
              </div>
            )}
            {formOk && (
              <div style={{ fontSize: 13, color: '#4ade80', padding: '8px 12px', background: 'rgba(22,163,74,0.07)', borderRadius: 8 }}>
                ✓ {formOk}
              </div>
            )}

            <button
              onClick={createUser} disabled={saving}
              style={{
                background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start',
              }}
            >
              {saving ? 'Aanmaken…' : 'Aanmaken'}
            </button>
          </div>
        )}

        {/* User list */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)',
          }}>
            Gebruikers ({users.length})
          </div>

          {loading ? (
            <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Laden…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Geen gebruikers gevonden</div>
          ) : (
            users.map((u, i) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px',
                borderBottom: i < users.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {u.trainer_naam ?? u.email}
                  </div>
                  {u.trainer_naam && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{u.email}</div>
                  )}
                </div>
                <RoleBadge role={u.role} />
                {u.role !== 'admin' && (
                  <button
                    onClick={() => deleteUser(u.id, u.email ?? '')}
                    disabled={deleting === u.id}
                    style={{
                      background: 'none', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6,
                      color: '#f87171', padding: '5px 12px', fontSize: 12, fontWeight: 600,
                      cursor: deleting === u.id ? 'default' : 'pointer',
                      opacity: deleting === u.id ? 0.5 : 1, transition: 'opacity 0.15s',
                    }}
                  >
                    {deleting === u.id ? '…' : 'Verwijder'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
