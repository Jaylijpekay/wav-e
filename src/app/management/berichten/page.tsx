'use client'

/*
 * Management — Berichten inbox
 *
 * Wat doet deze pagina:
 * Aggregeert berichten van alle trainers in één inbox voor management.
 * Gegroepeerd per trainer. Ongelezen trainers bovenaan. Inline lezen + antwoorden.
 *
 * Data:
 * Leest via API: trainer_notities (+ leden, trainers). Schrijft via API naar:
 * trainer_notities. Markeert gelezen via PATCH /api/trainer-notities/[id]/gelezen.
 *
 * Toegang:
 * management / admin
 *
 * Gerelateerde API routes:
 * /api/trainer-notities (GET), /api/trainer-notities/[trainer_id] (POST),
 * /api/trainer-notities/[id]/gelezen (PATCH)
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/app/components/Navigation'

type Bericht = {
  id: string
  trainer_id: string
  trainer_naam: string
  auteur_id: string
  auteur_type: string
  tekst: string
  aangemaakt_op: string
  gelezen_door_management: boolean
  lid_id: string | null
  lid_naam: string | null
  verwijderd?: boolean
}

type TrainerGroep = {
  trainer_id: string
  trainer_naam: string
  ongelezen: number
  berichten: Bericht[]
}

const touchButtonStyle: React.CSSProperties = { minHeight: 44, minWidth: 44 }

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

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffH = diffMs / 1000 / 60 / 60
    if (diffH < 1) return `${Math.max(1, Math.round(diffH * 60))}m geleden`
    if (diffH < 24) return `${Math.round(diffH)}u geleden`
    return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
  } catch {
    return iso
  }
}

function groupByTrainer(berichten: Bericht[]): TrainerGroep[] {
  const map = new Map<string, TrainerGroep>()
  for (const b of berichten) {
    if (!map.has(b.trainer_id)) {
      map.set(b.trainer_id, {
        trainer_id: b.trainer_id,
        trainer_naam: b.trainer_naam,
        ongelezen: 0,
        berichten: [],
      })
    }
    const g = map.get(b.trainer_id)!
    g.berichten.push(b)
    if (!b.gelezen_door_management && b.auteur_type === 'trainer') g.ongelezen++
  }
  // Trainers met ongelezen bovenaan, daarbinnen nieuwste bericht eerst
  return Array.from(map.values()).sort((a, b) => {
    if (b.ongelezen !== a.ongelezen) return b.ongelezen - a.ongelezen
    const aLatest = a.berichten[0]?.aangemaakt_op ?? ''
    const bLatest = b.berichten[0]?.aangemaakt_op ?? ''
    return bLatest.localeCompare(aLatest)
  })
}

function ReplyModal({
  trainer_id,
  trainer_naam,
  onClose,
  onSent,
}: {
  trainer_id: string
  trainer_naam: string
  onClose: () => void
  onSent: () => void
}) {
  const [tekst, setTekst] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!tekst.trim()) { setError('Tekst is verplicht'); return }
    if (tekst.length > 1000) { setError('Maximaal 1000 tekens'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/trainer-notities/${trainer_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tekst: tekst.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        setError(err?.error ?? 'Versturen mislukt')
        return
      }
      onSent()
      onClose()
    } catch {
      setError('Verbindingsfout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Beantwoorden</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>→ {trainer_naam}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Reactie</label>
          <textarea
            value={tekst}
            onChange={e => setTekst(e.target.value)}
            placeholder="Schrijf een reactie…"
            rows={4}
            maxLength={1000}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          {tekst.length >= 800 && (
            <div style={{ fontSize: 11, color: tekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
              {tekst.length}/1000
            </div>
          )}
        </div>
        {error && (
          <div style={{ fontSize: 13, color: 'var(--red-text)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
          >
            Annuleren
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{ ...touchButtonStyle, background: 'var(--color-accent)', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, touchAction: 'manipulation' }}
          >
            {saving ? 'Versturen…' : 'Versturen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TrainerCard({
  groep,
  onMarkRead,
  onDelete,
  onReply,
  onNavigateLid,
  onNavigateTrainer,
}: {
  groep: TrainerGroep
  onMarkRead: (id: string) => void
  onDelete: (trainer_id: string, bericht_id: string) => void
  onReply: (trainer_id: string, trainer_naam: string) => void
  onNavigateLid: (lid_id: string) => void
  onNavigateTrainer: (trainer_id: string) => void
}) {
  const [expanded, setExpanded] = useState(groep.ongelezen > 0)
  const hasOngelezen = groep.ongelezen > 0
  const latestBericht = groep.berichten[0]

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${hasOngelezen ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header — altijd zichtbaar */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          cursor: 'pointer',
          background: hasOngelezen ? 'var(--bg-raised)' : 'var(--bg-surface)',
          userSelect: 'none',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: hasOngelezen ? 'var(--color-accent)' : 'var(--bg-raised)',
          border: `1px solid ${hasOngelezen ? 'var(--color-accent)' : 'var(--border-subtle)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
          color: hasOngelezen ? 'var(--color-white)' : 'var(--text-muted)',
        }}>
          {groep.trainer_naam.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {groep.trainer_naam}
            </span>
            {hasOngelezen && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: 'var(--color-accent)', color: 'var(--color-white)',
                borderRadius: 20, padding: '1px 7px',
              }}>
                {groep.ongelezen} nieuw
              </span>
            )}
          </div>
          {!expanded && latestBericht && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {latestBericht.tekst}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {latestBericht && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {formatDate(latestBericht.aangemaakt_op)}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ▾
          </span>
        </div>
      </div>

      {/* Berichten thread */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {groep.berichten.map((b, i) => {
            const isTrainer = b.auteur_type === 'trainer'
            const isUnread = !b.gelezen_door_management && isTrainer
            return (
              <div
                key={b.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < groep.berichten.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: isUnread ? 'rgba(99,102,241,0.04)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isUnread && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 11, fontWeight: 600, color: isTrainer ? 'var(--text-primary)' : 'var(--color-accent-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {isTrainer ? groep.trainer_naam : 'Jij'}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(b.aangemaakt_op)}</span>
                </div>

                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', paddingLeft: isUnread ? 12 : 0 }}>
                  {b.tekst}
                </div>

                {b.lid_id && b.lid_naam && (
                  <span
                    onClick={() => onNavigateLid(b.lid_id!)}
                    style={{ fontSize: 12, color: 'var(--color-accent-text)', cursor: 'pointer', alignSelf: 'flex-start' }}
                  >
                    → {b.lid_naam}
                  </span>
                )}

                {isTrainer && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    {isUnread && (
                      <button
                        onClick={() => onMarkRead(b.id)}
                        style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
                      >
                        ✓ Gelezen
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(groep.trainer_id, b.id)}
                      style={{ ...touchButtonStyle, background: 'none', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '4px 10px', color: 'var(--red-text)', fontSize: 11, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
                    >
                      Verwijder
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Footer: acties */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: 'var(--bg-raised)',
          }}>
            <button
              onClick={() => onNavigateTrainer(groep.trainer_id)}
              style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '6px 0', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
            >
              Bekijk trainer →
            </button>
            <button
              onClick={() => onReply(groep.trainer_id, groep.trainer_naam)}
              style={{ ...touchButtonStyle, background: 'var(--color-accent)', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
            >
              Beantwoorden
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BerichtenPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [berichten, setBerichten] = useState<Bericht[]>([])
  const [replyTarget, setReplyTarget] = useState<{ trainer_id: string; trainer_naam: string } | null>(null)

  const loadBerichten = useCallback(async () => {
    const res = await fetch('/api/trainer-notities')
    if (!res.ok) { setLoading(false); return }
    const { berichten: data } = await res.json()
    setBerichten((data ?? []) as Bericht[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const res = await fetch('/api/auth-context')
      if (!res.ok) { router.replace('/login'); return }
      const { role } = await res.json()
      if (role !== 'management' && role !== 'admin') { router.replace('/'); return }
      await loadBerichten()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markRead = async (id: string) => {
    // Optimistic update
    setBerichten(prev => prev.map(b => b.id === id ? { ...b, gelezen_door_management: true } : b))
    await fetch(`/api/trainer-notities/${id}/gelezen`, { method: 'PATCH' }).catch(() => null)
  }

  const deleteBericht = async (trainerId: string, berichtId: string) => {
    // Optimistic: hide immediately by marking as verwijderd
    setBerichten(prev => prev.map(b => b.id === berichtId ? { ...b, verwijderd: true } : b))
    await fetch(`/api/trainer-notities/${trainerId}/${berichtId}`, { method: 'DELETE' }).catch(() => null)
  }

  const groepen = groupByTrainer(berichten.filter(b => !b.verwijderd))
  const totaalOngelezen = groepen.reduce((s, g) => s + g.ongelezen, 0)

  if (loading) {
    return (
      <>
        <Navigation />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Laden…</div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navigation />

      {replyTarget && (
        <ReplyModal
          trainer_id={replyTarget.trainer_id}
          trainer_naam={replyTarget.trainer_naam}
          onClose={() => setReplyTarget(null)}
          onSent={loadBerichten}
        />
      )}

      <div style={{ width: '90%', minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              Berichten
              {totaalOngelezen > 0 && (
                <span style={{ fontSize: 13, fontWeight: 700, background: 'var(--color-accent)', color: 'var(--color-white)', borderRadius: 20, padding: '2px 9px' }}>
                  {totaalOngelezen}
                </span>
              )}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {groepen.length === 0
                ? 'Geen berichten'
                : `${groepen.length} trainer${groepen.length !== 1 ? 's' : ''}${totaalOngelezen > 0 ? ` · ${totaalOngelezen} ongelezen` : ''}`}
            </p>
          </div>
          <a
            href="/management"
            style={{ ...touchButtonStyle, display: 'inline-flex', alignItems: 'center', padding: '8px 16px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', touchAction: 'manipulation' }}
          >
            ← Terug
          </a>
        </div>

        {/* Trainer groepen */}
        {groepen.length === 0 ? (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Geen berichten van trainers.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groepen.map(g => (
              <TrainerCard
                key={g.trainer_id}
                groep={g}
                onMarkRead={markRead}
                onDelete={deleteBericht}
                onReply={(tid, tnaam) => setReplyTarget({ trainer_id: tid, trainer_naam: tnaam })}
                onNavigateLid={lid_id => router.push(`/leden/${lid_id}`)}
                onNavigateTrainer={trainer_id => router.push(`/trainer/${trainer_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
