'use client'

/*
 * Mijn leden
 *
 * Wat doet deze pagina:
 * Deze pagina toont alle leden van een trainer in een filterbare lijst. De trainer kan zoeken, filteren op stoplicht en doorklikken naar een lid.
 *
 * Data:
 * Leest uit: trainers, leden, contact_momenten, evaluaties, acties.
 *
 * Toegang:
 * trainer
 *
 * Gerelateerde API routes:
 * Geen.
 */

import { useState, useEffect, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { daysSince, getLatestContactDatum, getStoplight } from '@/lib/stoplight'
import Navigation from '@/app/components/Navigation'

// ── Types ──────────────────────────────────────────────────────────────

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  email: string | null
  telefoon: string | null
  geboortedatum: string | null
  geslacht: string | null
  startdatum: string
  status: string | null
  actief: boolean
  laatste_contact: string | null
  laatste_evaluatie: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
  open_acties: number
}

type Trainer = {
  id: string
  naam: string
}

// ── Helpers ────────────────────────────────────────────────────────────

const toUiStoplight = (stoplight: ReturnType<typeof getStoplight>): 'red' | 'amber' | 'green' => {
  if (stoplight === 'rood') return 'red'
  if (stoplight === 'oranje') return 'amber'
  return 'green'
}

const getLidStoplight = (lid: Lid): 'red' | 'amber' | 'green' =>
  toUiStoplight(getStoplight(daysSince(getLatestContactDatum(lid.laatste_contact, lid.laatste_evaluatie))))

const STOPLIGHT = {
  red:   { dot: 'var(--red-danger)', bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.18)',  text: 'var(--red-text)',  label: 'Aandacht' },
  amber: { dot: 'var(--amber)', bg: 'rgba(217,119,6,0.07)',  border: 'rgba(217,119,6,0.18)',  text: 'var(--amber-text)',  label: 'Let op'   },
  green: { dot: 'var(--green-signal)', bg: 'rgba(22,163,74,0.07)',  border: 'rgba(22,163,74,0.18)',  text: 'var(--green-signal-text)',  label: 'Op koers' },
}

const STATUS_COLOR: Record<string, string> = {
  actief:   'var(--green-signal-text)',
  bevroren: 'var(--color-info)',
  'on hold': 'var(--amber-text)',
  stopt:    'var(--red-text)',
  inactief: 'var(--text-muted)',
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// ── Page ───────────────────────────────────────────────────────────────

export default function MijnLedenPage() {
  const { trainerId } = useParams()
  const router = useRouter()

  const [trainer, setTrainer]   = useState<Trainer | null>(null)
  const [leden, setLeden]       = useState<Lid[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | 'red' | 'amber' | 'green'>('all')
  const [search, setSearch]     = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/trainer/${trainerId}/leden`)
        if (!res.ok) throw new Error('Leden ophalen mislukt')
        const data = await res.json()
        setTrainer(data.trainer)
        setLeden(data.leden ?? [])
      } catch {
        setTrainer(null)
        setLeden([])
      } finally {
        setLoading(false)
      }
    }
    if (trainerId) load()
  }, [trainerId])

  const counts = {
    red:   leden.filter(l => getLidStoplight(l) === 'red').length,
    amber: leden.filter(l => getLidStoplight(l) === 'amber').length,
    green: leden.filter(l => getLidStoplight(l) === 'green').length,
  }

  const visible = leden.filter(l => {
    if (filter !== 'all' && getLidStoplight(l) !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        l.voornaam.toLowerCase().includes(q) ||
        l.achternaam.toLowerCase().includes(q) ||
        l.lid_id.toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const inputStyle: CSSProperties = {
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

  return (
    <>
      <Navigation />

      <div style={{ width: '90%', minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Mijn leden</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {trainer?.naam ?? 'Trainer'} · {leden.length} actieve leden
          </div>
        </div>

          {/* Stoplight filter */}
          {!loading && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setFilter('all')}
                  style={{ minHeight: 32, background: 'none', border: 'none', padding: '4px 0', color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s', touchAction: 'manipulation' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--text-muted)')}
                  onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                >
                  Toon allen ({leden.length})
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {(['red', 'amber', 'green'] as const).map(sig => {
                  const col = STOPLIGHT[sig]
                  const isActive = filter === sig
                  return (
                    <button
                      key={sig}
                      onClick={() => setFilter(isActive ? 'all' : sig)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '14px 18px',
                        minHeight: 76,
                        background: isActive ? col.bg : 'none',
                        border: `1px solid ${isActive ? col.border : 'var(--border-subtle)'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        touchAction: 'manipulation',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 20, fontWeight: 800, color: col.text }}>{counts[sig]}</span>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{col.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Zoek op naam, lid-id of e-mail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={inputStyle}
          />

          {loading ? (
            <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Laden…</div>
          ) : visible.length === 0 ? (
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen leden gevonden.</div>
            </section>
          ) : (
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Leden</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{visible.length} {visible.length === 1 ? 'resultaat' : 'resultaten'}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) 120px 140px 180px 80px 24px', columnGap: 16, padding: '10px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                {['', 'Naam', 'Lid-ID', 'Status', 'Laatste contact', 'Acties', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</span>
                ))}
              </div>
              {visible.map((lid, index) => {
                const sig = getLidStoplight(lid)
                const col = STOPLIGHT[sig]
                const dagContact = daysSince(lid.laatste_contact)
                const contactLabel = lid.laatste_contact === null
                  ? 'Nog nooit'
                  : dagContact === 0 ? 'Vandaag' : dagContact === 1 ? 'Gisteren' : `${dagContact}d geleden`
                const contactColor = dagContact === null
                  ? 'var(--text-muted)'
                  : dagContact > 28 ? 'var(--red-text)' : dagContact > 14 ? 'var(--amber-text)' : 'var(--text-muted)'
                const statusLabel = lid.status ?? (lid.actief ? 'actief' : 'inactief')

                return (
                  <div
                    key={lid.id}
                    onClick={() => router.push(`/leden/${lid.id}`)}
                    style={{ display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) 120px 140px 180px 80px 24px', columnGap: 16, padding: '14px 24px', minHeight: 72, borderBottom: index < visible.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center', cursor: 'pointer', touchAction: 'manipulation', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lid.voornaam} {lid.achternaam}</span>
                    <span style={{ fontSize: 12, color: 'var(--border-strong)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lid.lid_id}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[statusLabel.toLowerCase()] ?? 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusLabel}</span>
                    <span style={{ fontSize: 13, color: contactColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contactLabel}</span>
                    <span>
                      {lid.open_acties > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 22, padding: '0 8px', borderRadius: 11, background: 'rgba(220,38,38,0.10)', color: 'var(--red-text)', fontSize: 11, fontWeight: 800 }}>{lid.open_acties}</span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 18, textAlign: 'right' }}>›</span>
                  </div>
                )
              })}
            </section>
          )}
      </div>
    </>
  )
}
