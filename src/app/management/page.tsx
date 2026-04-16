'use client'

import { useState, useEffect, useCallback } from 'react'
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
  laatste_contact: string | null
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

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

const STATUS_COLOR: Record<string, string> = {
  actief:   '#4ade80',
  bevroren: '#60a5fa',
  'on hold': '#fbbf24',
  on_hold:  '#fbbf24',
  stopt:    '#f87171',
  inactief: '#555',
}

// ── Action assignment modal ────────────────────────────────────────────

function ActieModal({
  trainer,
  onClose,
  onSaved,
}: {
  trainer: Trainer
  onClose: () => void
  onSaved: () => void
}) {
  const [omschrijving, setOmschrijving] = useState('')
  const [deadline, setDeadline]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const save = async () => {
    setError(null)
    if (!omschrijving.trim()) { setError('Omschrijving is verplicht'); return }
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('acties').insert({
      trainer_id:    trainer.id,
      lid_id:        null,
      type:          'custom',
      omschrijving:  omschrijving.trim(),
      deadline:      deadline || null,
      status:        'open',
      bron:          'management',
      afgerond:      false,
      aangemaakt_door: user?.id ?? null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '28px',
        width: '100%', maxWidth: 460,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Actie toewijzen
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            → {trainer.voornaam} {trainer.achternaam}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Omschrijving
          </label>
          <textarea
            value={omschrijving}
            onChange={e => setOmschrijving(e.target.value)}
            placeholder="Wat moet deze trainer doen?"
            rows={3}
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '9px 12px',
              color: 'var(--text-primary)',
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Deadline (optioneel)
          </label>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
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

        {error && (
          <div style={{ fontSize: 13, color: '#f87171', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border-subtle)',
              borderRadius: 8, padding: '9px 18px',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Annuleren
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: 'var(--color-accent, #6366f1)', color: '#fff',
              border: 'none', borderRadius: 8,
              padding: '9px 18px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Opslaan…' : 'Toewijzen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Console panel ──────────────────────────────────────────────────────

function ConsolePanel({ trainers }: { trainers: Trainer[] }) {
  const [tokens, setTokens]       = useState<ConsoleToken[]>([])
  const [loading, setLoading]     = useState(true)
  const [formOpen, setFormOpen]   = useState(false)
  const [newNaam, setNewNaam]     = useState('')
  const [newTrainerId, setNewTrainerId] = useState('')
  const [saving, setSaving]       = useState(false)
  const [copiedId, setCopiedId]   = useState<string | null>(null)

  const loadTokens = useCallback(async () => {
    const supabase = getSupabase()
    const { data } = await supabase
      .from('console_tokens')
      .select('id, token, naam, actief, trainer_id, aangemaakt_op, laatst_gebruikt')
      .order('aangemaakt_op', { ascending: false })
    const enriched = (data ?? []).map(t => ({ ...t, trainer: trainers.find(tr => tr.id === t.trainer_id) }))
    setTokens(enriched)
    setLoading(false)
  }, [trainers])

  useEffect(() => { loadTokens() }, [loadTokens])

  const createToken = async () => {
    if (!newNaam.trim() || !newTrainerId) return
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('console_tokens').insert({ naam: newNaam.trim(), trainer_id: newTrainerId, aangemaakt_door: user!.id })
    setNewNaam(''); setNewTrainerId(''); setFormOpen(false); setSaving(false)
    loadTokens()
  }

  const revokeToken     = async (id: string) => { const s = getSupabase(); await s.from('console_tokens').update({ actief: false }).eq('id', id); loadTokens() }
  const reactivateToken = async (id: string) => { const s = getSupabase(); await s.from('console_tokens').update({ actief: true  }).eq('id', id); loadTokens() }

  const copyUrl = (t: ConsoleToken) => {
    navigator.clipboard.writeText(consoleUrl(t.token))
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 14,
  }

  return (
    <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: formOpen || tokens.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Studio consoles</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Apparaten met toegang zonder trainer-login</div>
        </div>
        <button onClick={() => setFormOpen(o => !o)} style={{ background: formOpen ? 'none' : 'var(--color-accent, #6366f1)', color: formOpen ? 'var(--text-muted)' : '#fff', border: formOpen ? '1px solid var(--border-subtle)' : 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {formOpen ? '× Annuleren' : '+ Nieuwe console'}
        </button>
      </div>

      {formOpen && (
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-raised)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Naam apparaat</label>
              <input type="text" value={newNaam} onChange={e => setNewNaam(e.target.value)} placeholder="bijv. iPad Studio Vloer" style={inputStyle} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trainer</label>
              <select value={newTrainerId} onChange={e => setNewTrainerId(e.target.value)} style={{ ...inputStyle, color: newTrainerId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <option value="">Selecteer trainer…</option>
                {trainers.filter(t => t.actief).map(t => <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>)}
              </select>
            </div>
          </div>
          <button onClick={createToken} disabled={saving || !newNaam.trim() || !newTrainerId} style={{ background: 'var(--color-accent, #6366f1)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', alignSelf: 'flex-start', opacity: saving || !newNaam.trim() || !newTrainerId ? 0.5 : 1 }}>
            {saving ? 'Aanmaken…' : 'Aanmaken'}
          </button>
        </div>
      )}

      {!loading && tokens.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', opacity: t.actief ? 1 : 0.45 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.naam}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {t.trainer ? `${t.trainer.voornaam} ${t.trainer.achternaam}` : '—'} · {daysSinceLabel(t.laatst_gebruikt)}
            </div>
          </div>
          <button onClick={() => copyUrl(t)} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: copiedId === t.id ? '#4ade80' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {copiedId === t.id ? 'Gekopieerd' : 'Kopieer URL'}
          </button>
          {t.actief
            ? <button onClick={() => revokeToken(t.id)} style={{ background: 'none', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 6, padding: '5px 12px', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Intrekken</button>
            : <button onClick={() => reactivateToken(t.id)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Heractiveren</button>
          }
        </div>
      ))}
    </section>
  )
}

// ── Main page ──────────────────────────────────────────────────────────

export default function ManagementPage() {
  const [trainers, setTrainers]           = useState<Trainer[]>([])
  const [leden, setLeden]                 = useState<Lid[]>([])
  const [trainerStats, setTrainerStats]   = useState<Record<string, TrainerStats>>({})
  const [loading, setLoading]             = useState(true)
  const [trainerFilter, setTrainerFilter] = useState<string>('allen')
  const [actieTrainer, setActieTrainer]   = useState<Trainer | null>(null)
  const [refreshKey, setRefreshKey]       = useState(0)

  const load = useCallback(async () => {
    const supabase = getSupabase()

    const [{ data: trainerData }, { data: ledenRaw }, { data: contacten }, { data: evaluaties }, { data: actiesData }] = await Promise.all([
      supabase.from('trainers').select('id, voornaam, achternaam, naam, email, actief').order('achternaam'),
      supabase.from('leden').select('id, lid_id, voornaam, achternaam, actief, status, trainer_id').order('achternaam'),
      supabase.from('contact_momenten').select('lid_id, datum').order('datum', { ascending: false }),
      supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').order('cyclus', { ascending: false }),
      supabase.from('acties').select('id, trainer_id, lid_id').eq('status', 'open'),
    ])

    // Enrich leden with last contact + eval signals
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

    // Compute per-trainer stats
    const stats: Record<string, TrainerStats> = {}
    for (const t of trainerData ?? []) {
      const tLeden = enrichedLeden.filter(l => l.trainer_id === t.id && l.actief)
      const openActies = (actiesData ?? []).filter(a => a.trainer_id === t.id).length
      const lastContacts = tLeden
        .map(l => l.laatste_contact)
        .filter(Boolean)
        .sort()
        .reverse()

      stats[t.id] = {
        trainer_id:      t.id,
        totaal:          tLeden.length,
        rood:            tLeden.filter(l => getStoplight(l) === 'red').length,
        amber:           tLeden.filter(l => getStoplight(l) === 'amber').length,
        open_acties:     openActies,
        laatste_contact: lastContacts[0] ?? null,
      }
    }

    setTrainers(trainerData ?? [])
    setLeden(enrichedLeden)
    setTrainerStats(stats)
    setLoading(false)
  }, [refreshKey])

  useEffect(() => { load() }, [load])

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
          onClose={() => setActieTrainer(null)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}

      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '32px 24px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Title */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Studio-overzicht · Wav-e</p>
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

        {/* Trainers section */}
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Trainers</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{trainers.filter(t => t.actief).length} actief</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1, background: 'var(--border-subtle)' }}>
            {trainers.map(t => {
              const s = trainerStats[t.id] ?? { totaal: 0, rood: 0, amber: 0, open_acties: 0, laatste_contact: null }
              return (
                <div key={t.id} style={{ background: 'var(--bg-surface)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Trainer identity */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t.voornaam} {t.achternaam}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.email}</div>
                    </div>
                    {!t.actief && (
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#555', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, padding: '2px 7px' }}>Inactief</span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{s.totaal}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leden</div>
                    </div>
                    {s.rood > 0 && (
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>{s.rood}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rood</div>
                      </div>
                    )}
                    {s.amber > 0 && (
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>{s.amber}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amber</div>
                      </div>
                    )}
                    {s.open_acties > 0 && (
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>{s.open_acties}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Acties</div>
                      </div>
                    )}
                  </div>

                  {/* Last contact */}
                  <div style={{ fontSize: 11, color: '#333' }}>
                    Laatste contact: <span style={{ color: '#444' }}>{daysSinceLabel(s.laatste_contact)}</span>
                  </div>

                  {/* Assign action button */}
                  <button
                    onClick={() => setActieTrainer(t)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6, padding: '6px 12px',
                      color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', alignSelf: 'flex-start',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.target as HTMLButtonElement).style.borderColor = '#444' }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.target as HTMLButtonElement).style.borderColor = 'var(--border-subtle)' }}
                  >
                    + Actie toewijzen
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Console panel */}
        <ConsolePanel trainers={trainers} />

        {/* Member table */}
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Leden · {visibleLeden.length}</div>
            <select
              value={trainerFilter}
              onChange={e => setTrainerFilter(e.target.value)}
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 13 }}
            >
              <option value="allen">Alle trainers</option>
              {trainers.map(t => <option key={t.id} value={t.id}>{t.voornaam} {t.achternaam}</option>)}
            </select>
          </div>

          {visibleLeden.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen leden gevonden</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px', padding: '8px 24px', background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Naam', 'Trainer', 'Status', 'Lid-ID'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</span>
                ))}
              </div>
              {visibleLeden.map((l, i) => {
                const trainer = trainers.find(t => t.id === l.trainer_id)
                return (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px', padding: '12px 24px', borderBottom: i < visibleLeden.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{l.voornaam} {l.achternaam}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{trainer ? `${trainer.voornaam} ${trainer.achternaam}` : '—'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_COLOR[l.status ?? ''] ?? 'var(--text-muted)' }}>
                      {l.status ?? (l.actief ? 'actief' : 'inactief')}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--border-strong)', fontFamily: 'monospace' }}>{l.lid_id}</span>
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
