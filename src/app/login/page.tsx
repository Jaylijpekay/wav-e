'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import Navigation from '@/app/components/Navigation'

// ============================================================
// TYPES
// ============================================================

type Trainer = {
  id: string
  voornaam: string
  achternaam: string
  naam: string
  email: string
  actief: boolean
}

type ConsoleToken = {
  id: string
  token: string
  naam: string
  actief: boolean
  trainer_id: string
  aangemaakt_op: string
  laatst_gebruikt: string | null
  trainer?: Trainer
}

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  actief: boolean
  status: string | null
  trainer_id: string
}

type StudioCounts = {
  actief: number
  bevroren: number
  on_hold: number
  stopt: number
  inactief: number
}

// ============================================================
// HELPERS
// ============================================================

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const daysSinceLabel = (date: string | null): string => {
  if (!date) return 'Nooit gebruikt'
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (d === 0) return 'Vandaag'
  if (d === 1) return 'Gisteren'
  return `${d} dagen geleden`
}

const consoleUrl = (token: string): string => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/console?token=${token}`
}

// ============================================================
// SUBCOMPONENT — CONSOLE TOKEN PANEL
// ============================================================

function ConsolePanel({ trainers }: { trainers: Trainer[] }) {
  const [tokens, setTokens] = useState<ConsoleToken[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [newNaam, setNewNaam] = useState('')
  const [newTrainerId, setNewTrainerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadTokens = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('console_tokens')
      .select('id, token, naam, actief, trainer_id, aangemaakt_op, laatst_gebruikt')
      .order('aangemaakt_op', { ascending: false })

    const enriched = (data ?? []).map(t => ({
      ...t,
      trainer: trainers.find(tr => tr.id === t.trainer_id),
    }))
    setTokens(enriched)
    setLoading(false)
  }, [trainers])

  useEffect(() => { loadTokens() }, [loadTokens])

  const createToken = async () => {
    if (!newNaam.trim() || !newTrainerId) return
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('console_tokens').insert({
      naam: newNaam.trim(),
      trainer_id: newTrainerId,
      aangemaakt_door: user!.id,
    })
    setNewNaam('')
    setNewTrainerId('')
    setFormOpen(false)
    setSaving(false)
    loadTokens()
  }

  const revokeToken = async (tokenId: string) => {
    const supabase = getSupabase()
    await supabase.from('console_tokens').update({ actief: false }).eq('id', tokenId)
    loadTokens()
  }

  const reactivateToken = async (tokenId: string) => {
    const supabase = getSupabase()
    await supabase.from('console_tokens').update({ actief: true }).eq('id', tokenId)
    loadTokens()
  }

  const copyUrl = (t: ConsoleToken) => {
    navigator.clipboard.writeText(consoleUrl(t.token))
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <section style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 24px',
        borderBottom: formOpen || tokens.length > 0 ? '1px solid var(--border-subtle)' : 'none',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Studio consoles</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Apparaten met toegang zonder trainer-login
          </div>
        </div>
        <button
          onClick={() => setFormOpen(o => !o)}
          style={{
            background: formOpen ? 'none' : 'var(--color-accent, #6366f1)',
            color: formOpen ? 'var(--text-muted)' : '#fff',
            border: formOpen ? '1px solid var(--border-subtle)' : 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {formOpen ? '× Annuleren' : '+ Nieuwe console'}
        </button>
      </div>

      {/* Create form */}
      {formOpen && (
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-raised)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Naam apparaat
              </label>
              <input
                type="text"
                value={newNaam}
                onChange={e => setNewNaam(e.target.value)}
                placeholder="bijv. iPad Studio Vloer"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Trainer
              </label>
              <select
                value={newTrainerId}
                onChange={e => setNewTrainerId(e.target.value)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  color: newTrainerId ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 14,
                }}
              >
                <option value="">Selecteer trainer…</option>
                {trainers.filter(t => t.actief).map(t => (
                  <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={createToken}
            disabled={saving || !newNaam.trim() || !newTrainerId}
            style={{
              alignSelf: 'flex-start',
              background: (!newNaam.trim() || !newTrainerId) ? 'var(--bg-raised)' : 'var(--color-accent, #6366f1)',
              color: (!newNaam.trim() || !newTrainerId) ? 'var(--text-muted)' : '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '9px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: (!newNaam.trim() || !newTrainerId) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Aanmaken…' : 'Console aanmaken'}
          </button>
        </div>
      )}

      {/* Token list */}
      {loading ? (
        <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>Laden…</div>
      ) : tokens.length === 0 ? (
        <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Nog geen studio consoles aangemaakt
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tokens.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 24px',
                borderBottom: i < tokens.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                opacity: t.actief ? 1 : 0.45,
              }}
            >
              {/* Status dot */}
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: t.actief ? 'var(--color-success, #16a34a)' : 'var(--border-strong)',
                flexShrink: 0,
              }} />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.naam}</span>
                  {!t.actief && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '1px 6px',
                    }}>Inactief</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10 }}>
                  <span>{t.trainer ? `${t.trainer.voornaam} ${t.trainer.achternaam}` : '—'}</span>
                  <span>·</span>
                  <span>Aangemaakt {formatDate(t.aangemaakt_op)}</span>
                  <span>·</span>
                  <span>{daysSinceLabel(t.laatst_gebruikt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {t.actief && (
                  <button
                    onClick={() => copyUrl(t)}
                    style={{
                      background: copiedId === t.id ? 'rgba(22,163,74,0.1)' : 'var(--bg-raised)',
                      border: `1px solid ${copiedId === t.id ? 'rgba(22,163,74,0.3)' : 'var(--border-subtle)'}`,
                      borderRadius: 8,
                      color: copiedId === t.id ? 'var(--color-success, #16a34a)' : 'var(--text-muted)',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {copiedId === t.id ? '✓ Gekopieerd' : 'Kopieer link'}
                  </button>
                )}
                {t.actief ? (
                  <button
                    onClick={() => revokeToken(t.id)}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(220,38,38,0.25)',
                      borderRadius: 8,
                      color: 'var(--color-red-text, #f87171)',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Intrekken
                  </button>
                ) : (
                  <button
                    onClick={() => reactivateToken(t.id)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      color: 'var(--text-muted)',
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Heractiveren
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function ManagementPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [leden, setLeden] = useState<Lid[]>([])
  const [loading, setLoading] = useState(true)
  const [trainerFilter, setTrainerFilter] = useState<string>('allen')

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const { data: trainerData } = await supabase
        .from('trainers')
        .select('id, voornaam, achternaam, naam, email, actief')
        .order('achternaam')
      setTrainers(trainerData ?? [])

      const { data: ledenData } = await supabase
        .from('leden')
        .select('id, lid_id, voornaam, achternaam, actief, status, trainer_id')
        .order('achternaam')
      setLeden(ledenData ?? [])

      setLoading(false)
    }
    load()
  }, [])

  const counts: StudioCounts = {
    actief:   leden.filter(l => l.status === 'actief').length,
    bevroren: leden.filter(l => l.status === 'bevroren').length,
    on_hold:  leden.filter(l => l.status === 'on_hold').length,
    stopt:    leden.filter(l => l.status === 'stopt').length,
    inactief: leden.filter(l => l.status === 'inactief' || !l.actief).length,
  }

  const visibleLeden = leden.filter(l =>
    trainerFilter === 'allen' || l.trainer_id === trainerFilter
  )

  if (loading) {
    return (
      <>
        <Navigation />
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Laden…</div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        padding: '32px 24px',
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>

        {/* Page title */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Studio-overzicht · alleen lezen</p>
        </div>

        {/* Studio counts */}
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
        }}>
          {([
            { label: 'Actief',   value: counts.actief,   color: 'var(--color-success, #16a34a)' },
            { label: 'Bevroren', value: counts.bevroren, color: 'var(--color-amber, #d97706)'   },
            { label: 'On hold',  value: counts.on_hold,  color: 'var(--color-amber, #d97706)'   },
            { label: 'Stopt',    value: counts.stopt,    color: 'var(--color-red, #dc2626)'      },
            { label: 'Inactief', value: counts.inactief, color: 'var(--border-strong)'           },
          ]).map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '16px 20px',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </section>

        {/* Console panel */}
        <ConsolePanel trainers={trainers} />

        {/* Member table */}
        <section style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Leden · {visibleLeden.length}
            </div>
            <select
              value={trainerFilter}
              onChange={e => setTrainerFilter(e.target.value)}
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '6px 12px',
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            >
              <option value="allen">Alle trainers</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>
              ))}
            </select>
          </div>

          {visibleLeden.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Geen leden gevonden
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 120px 100px',
                padding: '8px 24px',
                background: 'var(--bg-raised)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                {['Naam', 'Trainer', 'Status', 'Lid-ID'].map(h => (
                  <span key={h} style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}>{h}</span>
                ))}
              </div>

              {visibleLeden.map((l, i) => {
                const trainer = trainers.find(t => t.id === l.trainer_id)
                const statusColor =
                  l.status === 'actief'   ? 'var(--color-success-text, #4ade80)' :
                  l.status === 'stopt'    ? 'var(--color-red-text, #f87171)'     :
                  l.status === 'bevroren' ? 'var(--color-amber-text, #fbbf24)'   :
                  'var(--text-muted)'

                return (
                  <div
                    key={l.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 120px 100px',
                      padding: '12px 24px',
                      borderBottom: i < visibleLeden.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {l.voornaam} {l.achternaam}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {trainer ? `${trainer.voornaam} ${trainer.achternaam}` : '—'}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: statusColor,
                    }}>
                      {l.status ?? (l.actief ? 'actief' : 'inactief')}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--border-strong)', fontFamily: 'monospace' }}>
                      {l.lid_id}
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
