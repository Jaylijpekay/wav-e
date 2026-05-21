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

  const filterButtonStyle = (active: boolean): CSSProperties => ({
    minHeight: 44,
    background: active ? 'var(--bg-raised)' : 'none',
    border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
    borderRadius: 8,
    padding: '8px 14px',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    touchAction: 'manipulation',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  })

  return (
    <>
      <Navigation />

      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Mijn leden</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {trainer?.naam ?? 'Trainer'} · {leden.length} actieve leden
          </div>
        </div>

          {/* Stoplight filter */}
          {!loading && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                style={filterButtonStyle(filter === 'all')}
                onClick={() => setFilter('all')}
              >
                Allen <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{leden.length}</span>
              </button>
              {(['red', 'amber', 'green'] as const).map(sig => (
                <button
                  key={sig}
                  style={filterButtonStyle(filter === sig)}
                  onClick={() => setFilter(sig)}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STOPLIGHT[sig].dot, display: 'inline-block' }} />
                  {STOPLIGHT[sig].label}
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{counts[sig]}</span>
                </button>
              ))}
            </div>
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

                return (
                  <div
                    key={lid.id}
                    onClick={() => router.push(`/leden/${lid.id}`)}
                    style={{ padding: '14px 24px', borderBottom: index < visible.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', minHeight: 72, touchAction: 'manipulation' }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lid.voornaam} {lid.achternaam}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{lid.lid_id}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {lid.status && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[lid.status.toLowerCase()] ?? 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lid.status}</span>
                      )}
                      <div style={{ textAlign: 'right', minWidth: 110 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Laatste contact</div>
                        <div style={{ fontSize: 13, color: contactColor, marginTop: 2 }}>{contactLabel}</div>
                      </div>
                      {lid.open_acties > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 22, borderRadius: 11, background: 'rgba(220,38,38,0.10)', color: 'var(--red-text)', fontSize: 11, fontWeight: 800 }}>{lid.open_acties}</span>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
                    </div>
                  </div>
                )
              })}
            </section>
          )}
      </div>
    </>
  )
}
