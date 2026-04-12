'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

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

type Trainer = {
  id: string
  voornaam: string
  achternaam: string
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
      fontSize: 11,
      fontWeight: 700,
      padding: '3px 10px',
      borderRadius: 20,
      background: s.bg,
      color: s.color,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

// ============================================================
// ADMIN PAGE
// ============================================================

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // New user form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'management' | 'trainer'>('management')
  const [trainerId, setTrainerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, trainersRes] = await Promise.all([
      fetch('/api/admin/list'),
      fetch('/api/admin/trainers'),
    ])
    const usersData = await usersRes.json()
    const trainersData = await trainersRes.json()
    setUsers(usersData.users ?? [])
    setTrainers(trainersData.trainers ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createUser = async () => {
    setFormError(null)
    if (!email || !password) { setFormError('Email en wachtwoord zijn verplicht'); return }
    if (role === 'trainer' && !trainerId) { setFormError('Selecteer een trainer'); return }
    setSaving(true)
    const res = await fetch('/api/admin/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role, trainer_id: trainerId || null }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(data.error); return }
    setEmail(''); setPassword(''); setRole('management'); setTrainerId('')
    setShowForm(false)
    load()
  }

  const deleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Verwijder gebruiker ${userEmail}? Dit kan niet ongedaan worden gemaakt.`)) return
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
        borderBottom: '1px solid var(--border-subtle)',
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-surface)',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Admin</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Gebruikersbeheer · Wav-e</div>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setFormError(null) }}
          style={{
            background: showForm ? 'var(--bg-raised)' : 'var(--color-accent, #6366f1)',
            color: showForm ? 'var(--text-muted)' : '#fff',
            border: showForm ? '1px solid var(--border-subtle)' : 'none',
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showForm ? '× Annuleren' : '+ Nieuwe gebruiker'}
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Create form */}
        {showForm && (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Nieuwe gebruiker aanmaken</div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="naam@wav-e.nl"
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wachtwoord</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 tekens"
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rol</label>
                <select
                  value={role}
                  onChange={e => { setRole(e.target.value as 'management' | 'trainer'); setTrainerId('') }}
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                >
                  <option value="management">Management</option>
                  <option value="trainer">Trainer</option>
                </select>
              </div>
            </div>

            {role === 'trainer' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Koppel aan trainer</label>
                <select
                  value={trainerId}
                  onChange={e => setTrainerId(e.target.value)}
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                >
                  <option value="">Selecteer trainer…</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>
                  ))}
                </select>
              </div>
            )}

            {formError && (
              <div style={{ fontSize: 13, color: 'var(--color-red, #f87171)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
                {formError}
              </div>
            )}

            <button
              onClick={createUser}
              disabled={saving}
              style={{
                background: 'var(--color-accent, #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              {saving ? 'Aanmaken…' : 'Aanmaken'}
            </button>
          </div>
        )}

        {/* User list */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
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
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 24px',
                borderBottom: i < users.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{u.email}</div>
                  {u.trainer_naam && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>→ {u.trainer_naam}</div>
                  )}
                </div>
                <RoleBadge role={u.role} />
                {u.role !== 'admin' && (
                  <button
                    onClick={() => deleteUser(u.id, u.email ?? '')}
                    disabled={deleting === u.id}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      color: 'var(--color-red, #f87171)',
                      padding: '4px 10px',
                      fontSize: 12,
                      cursor: deleting === u.id ? 'default' : 'pointer',
                      opacity: deleting === u.id ? 0.5 : 1,
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
