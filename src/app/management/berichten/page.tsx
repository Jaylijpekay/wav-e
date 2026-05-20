'use client'

/*
 * Management — Berichten inbox
 *
 * Wat doet deze pagina:
 * Aggregeert berichten van alle trainers in één inbox voor management. Ongelezen
 * komt bovenaan, daarbinnen nieuwste eerst. Management kan inline antwoorden.
 *
 * Data:
 * Leest via API: trainer_notities (+ leden, trainers). Schrijft via API naar:
 * trainer_notities.
 *
 * Toegang:
 * management / admin
 *
 * Gerelateerde API routes:
 * /api/trainer-notities (GET), /api/trainer-notities/[trainer_id] (POST)
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Navigation from '@/app/components/Navigation'

type Bericht = {
  id: string
  trainer_id: string
  trainer_naam: string
  auteur_id: string
  tekst: string
  aangemaakt_op: string
  gelezen_door_management: boolean
  lid_id: string | null
  lid_naam: string | null
}

const PAGE_SIZE = 20

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

function ReplyModal({
  target,
  onClose,
  onSent,
}: {
  target: Bericht
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
      const res = await fetch(`/api/trainer-notities/${target.trainer_id}`, {
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
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>→ {target.trainer_naam}</div>
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

export default function BerichtenPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [berichten, setBerichten] = useState<Bericht[]>([])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [replyTarget, setReplyTarget] = useState<Bericht | null>(null)

  const loadBerichten = useCallback(async () => {
    const res = await fetch('/api/trainer-notities')
    if (!res.ok) {
      setBerichten([])
      setLoading(false)
      return
    }
    const { berichten: data } = await res.json()
    setBerichten((data ?? []) as Bericht[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: role } = await supabase.rpc('get_my_role')
      if (role !== 'management' && role !== 'admin') {
        router.replace('/')
        return
      }
      await loadBerichten()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init runs once on mount; loadBerichten is stable.
  }, [])

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return iso
    }
  }

  const items = berichten.slice(0, visible)
  const hasMore = visible < berichten.length

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
          target={replyTarget}
          onClose={() => setReplyTarget(null)}
          onSent={() => loadBerichten()}
        />
      )}

      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Berichten</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Berichten van trainers</p>
          </div>
          <a
            href="/management"
            style={{ ...touchButtonStyle, display: 'inline-flex', alignItems: 'center', padding: '8px 16px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', touchAction: 'manipulation' }}
          >
            ← Terug naar overzicht
          </a>
        </div>

        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          {berichten.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Geen berichten van trainers.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map((b, i) => {
                const isUnread = !b.gelezen_door_management
                return (
                  <div
                    key={b.id}
                    style={{
                      padding: '18px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      borderLeft: isUnread ? '3px solid rgba(99,102,241,0.5)' : '3px solid rgba(99,102,241,0.0)',
                      background: isUnread ? 'var(--bg-raised)' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        {isUnread && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }} />
                        )}
                        <span
                          onClick={() => router.push(`/trainer/${b.trainer_id}`)}
                          style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--text-muted)')}
                          onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                        >
                          {b.trainer_naam}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(b.aangemaakt_op)}</span>
                    </div>

                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {b.tekst}
                    </div>

                    {b.lid_id && b.lid_naam && (
                      <span
                        onClick={() => router.push(`/leden/${b.lid_id}`)}
                        style={{ fontSize: 12, color: 'var(--color-accent-text)', cursor: 'pointer', alignSelf: 'flex-start' }}
                      >
                        → {b.lid_naam}
                      </span>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setReplyTarget(b)}
                        style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
                      >
                        Beantwoorden
                      </button>
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <div style={{ padding: '18px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => setVisible(v => v + PAGE_SIZE)}
                    style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation' }}
                  >
                    Toon meer
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </>
  )
}
