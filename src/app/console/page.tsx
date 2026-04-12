'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// TYPES
// ============================================================

type Trainer = {
  id: string
  voornaam: string
  achternaam: string
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

type Stoplight = 'rood' | 'amber' | 'groen' | 'leeg'

type AttentieSignaal = {
  lid: Lid
  stoplight: Stoplight
  redenen: string[]
}

// ============================================================
// HELPERS
// ============================================================

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const daysSince = (date: string | null): number | null => {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

// ============================================================
// CONSOLE SUPABASE CLIENT
// Uses anon key — RLS is bypassed via validate_console_token
// on the middleware. Queries here still respect RLS because
// the token resolves to a trainer_id that is injected server-
// side. Client queries use anon key — only public/safe data.
// ============================================================

function getConsoleSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ============================================================
// STOPLIGHT LOGIC (same as rest of app — computed, not stored)
// ============================================================

function computeStoplight(ev: {
  slaap: number | null
  energie: number | null
  stress: number | null
} | null): Stoplight {
  if (!ev) return 'leeg'
  if (
    (ev.slaap !== null && ev.slaap < 6) ||
    (ev.energie !== null && ev.energie < 6) ||
    (ev.stress !== null && ev.stress > 7)
  ) return 'rood'
  if (
    (ev.slaap !== null && ev.slaap < 7) ||
    (ev.energie !== null && ev.energie < 7) ||
    (ev.stress !== null && ev.stress > 5)
  ) return 'amber'
  return 'groen'
}

function buildRedenen(
  ev: { slaap: number | null; energie: number | null; stress: number | null } | null,
  dagsSindsContact: number | null,
  dagsSindsEval: number | null,
  openActies: number
): string[] {
  const r: string[] = []
  if (dagsSindsContact !== null && dagsSindsContact > 14) r.push(`Geen contact in ${dagsSindsContact} dagen`)
  if (dagsSindsEval !== null && dagsSindsEval > 42) r.push(`Geen evaluatie in ${dagsSindsEval} dagen`)
  if (openActies > 0) r.push(`${openActies} open ${openActies === 1 ? 'actie' : 'acties'}`)
  if (ev?.slaap !== null && ev?.slaap! < 6) r.push('Slaap onder drempelwaarde')
  if (ev?.energie !== null && ev?.energie! < 6) r.push('Energie onder drempelwaarde')
  if (ev?.stress !== null && ev?.stress! > 7) r.push('Stress boven drempelwaarde')
  return r
}

// ============================================================
// STOPLIGHT COLOURS
// ============================================================

const SL = {
  rood:  { dot: 'var(--color-red, #dc2626)',     text: 'var(--color-red-text, #f87171)',     bg: 'rgba(220,38,38,0.07)',    border: 'rgba(220,38,38,0.18)'   },
  amber: { dot: 'var(--color-amber, #d97706)',   text: 'var(--color-amber-text, #fbbf24)',   bg: 'rgba(217,119,6,0.07)',    border: 'rgba(217,119,6,0.18)'   },
  groen: { dot: 'var(--color-success, #16a34a)', text: 'var(--color-success-text, #4ade80)', bg: 'rgba(22,163,74,0.07)',    border: 'rgba(22,163,74,0.18)'   },
  leeg:  { dot: 'var(--border-strong)',           text: 'var(--text-muted)',                  bg: 'var(--bg-surface)',        border: 'var(--border-subtle)'   },
}

// ============================================================
// CONTACT MOMENT FORM
// ============================================================

function ContactForm({ lid, trainerToken, onSaved }: {
  lid: Lid
  trainerToken: string
  onSaved: () => void
}) {
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [type, setType] = useState('sessie')
  const [notities, setNotities] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    const supabase = getConsoleSupabase()
    await supabase.from('contact_momenten').insert({
      lid_id: lid.id,
      datum,
      type,
      notities: notities || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onSaved()
    }, 1200)
  }

  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Datum</label>
          <input
            type="date"
            value={datum}
            onChange={e => setDatum(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          >
            <option value="sessie">Sessie</option>
            <option value="check-in">Check-in</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="telefoon">Telefoon</option>
            <option value="anders">Anders</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notities</label>
        <textarea
          value={notities}
          onChange={e => setNotities(e.target.value)}
          placeholder="Optioneel…"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '10px 12px',
            color: 'var(--text-primary)',
            fontSize: 14,
            height: 72,
            resize: 'vertical',
          }}
        />
      </div>
      <button
        onClick={save}
        disabled={saving || saved}
        style={{
          background: saved ? 'var(--color-success, #16a34a)' : 'var(--color-accent, #6366f1)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 600,
          cursor: saving || saved ? 'default' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {saved ? '✓ Opgeslagen' : saving ? 'Opslaan…' : 'Opslaan'}
      </button>
    </div>
  )
}

// ============================================================
// MEMBER DETAIL PANEL
// ============================================================

function LidPanel({ lid, trainerToken, onBack }: {
  lid: Lid
  trainerToken: string
  onBack: () => void
}) {
  const [contactOpen, setContactOpen] = useState(false)
  const [contacten, setContacten] = useState<{ id: string; datum: string; type: string | null; notities: string | null }[]>([])
  const [acties, setActies] = useState<{ id: string; omschrijving: string; deadline: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = getConsoleSupabase()
    const { data: c } = await supabase
      .from('contact_momenten')
      .select('id, datum, type, notities')
      .eq('lid_id', lid.id)
      .order('datum', { ascending: false })
      .limit(5)
    setContacten(c ?? [])
    const { data: a } = await supabase
      .from('acties')
      .select('id, omschrijving, deadline')
      .eq('lid_id', lid.id)
      .eq('status', 'open')
    setActies(a ?? [])
    setLoading(false)
  }, [lid.id])

  useEffect(() => { load() }, [load])

  const markAfgerond = async (actieId: string) => {
    const supabase = getConsoleSupabase()
    await supabase.from('acties').update({
      status: 'afgerond',
      afgerond: true,
      afgerond_op: new Date().toISOString(),
    }).eq('id', actieId)
    setActies(prev => prev.filter(a => a.id !== actieId))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ← Terug
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {lid.voornaam} {lid.achternaam}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lid.lid_id}</div>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>

        {/* Log contact */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Contact loggen
            </span>
            <button
              onClick={() => setContactOpen(o => !o)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent, #6366f1)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {contactOpen ? '× annuleren' : '+ nieuw contact'}
            </button>
          </div>
          {contactOpen && (
            <ContactForm
              lid={lid}
              trainerToken={trainerToken}
              onSaved={() => { setContactOpen(false); load() }}
            />
          )}
        </section>

        {/* Recent contact */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Recente contacten
          </div>
          {loading
            ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Laden…</div>
            : contacten.length === 0
              ? <div style={{ color: 'var(--border-strong)', fontSize: 13 }}>Nog geen contactmomenten</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contacten.map(c => (
                    <div key={c.id} style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'baseline',
                      padding: '10px 14px',
                      background: 'var(--bg-raised)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 80 }}>{formatDate(c.datum)}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{c.type ?? 'Contact'}</span>
                      {c.notities && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.notities}</span>}
                    </div>
                  ))}
                </div>
              )
          }
        </section>

        {/* Open acties */}
        <section>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Open acties
          </div>
          {acties.length === 0
            ? <div style={{ color: 'var(--border-strong)', fontSize: 13 }}>✓ Geen open acties</div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {acties.map(a => {
                  const overdue = a.deadline && new Date(a.deadline) < new Date()
                  return (
                    <div key={a.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'var(--bg-raised)',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      borderLeft: `3px solid ${overdue ? 'var(--color-red, #dc2626)' : 'rgba(22,163,74,0.4)'}`,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.omschrijving}</div>
                        {a.deadline && (
                          <div style={{ fontSize: 11, color: overdue ? 'var(--color-red, #dc2626)' : 'var(--text-muted)', marginTop: 2 }}>
                            deadline {formatDate(a.deadline)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => markAfgerond(a.id)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 6,
                          color: 'var(--color-success, #16a34a)',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          }
        </section>

      </div>
    </div>
  )
}

// ============================================================
// CONSOLE INNER — uses useSearchParams, must be inside Suspense
// ============================================================

function ConsoleInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get('token') ?? ''

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [leden, setLeden] = useState<Lid[]>([])
  const [attentie, setAttentie] = useState<AttentieSignaal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLid, setSelectedLid] = useState<Lid | null>(null)
  const [filter, setFilter] = useState<Stoplight | 'allen'>('allen')

  const load = useCallback(async () => {
    setLoading(true)

    // Validate token → get trainer_id
    const supabase = getConsoleSupabase()
    const { data: trainerId, error: tokenError } = await supabase
      .rpc('validate_console_token', { p_token: token })

    if (tokenError || !trainerId) {
      setError('Ongeldige of verlopen consolecode. Vraag management om een nieuwe link.')
      setLoading(false)
      return
    }

    // Touch last used
    supabase.rpc('touch_console_token', { p_token: token })

    // Fetch trainer
    const { data: trainerData } = await supabase
      .from('trainers')
      .select('id, voornaam, achternaam')
      .eq('id', trainerId)
      .single()
    setTrainer(trainerData)

    // Fetch all leden for this trainer
    const { data: ledenData } = await supabase
      .from('leden')
      .select('id, lid_id, voornaam, achternaam, actief, status, trainer_id')
      .eq('trainer_id', trainerId)
      .order('achternaam')
    const ledenList = ledenData ?? []
    setLeden(ledenList)

    // Compute attentie signals per lid
    const signals: AttentieSignaal[] = await Promise.all(
      ledenList.map(async (lid) => {
        const { data: lastEval } = await supabase
          .from('evaluaties')
          .select('slaap, energie, stress, datum')
          .eq('lid_id', lid.id)
          .order('cyclus', { ascending: false })
          .limit(1)
          .single()

        const { data: lastContact } = await supabase
          .from('contact_momenten')
          .select('datum')
          .eq('lid_id', lid.id)
          .order('datum', { ascending: false })
          .limit(1)
          .single()

        const { count: openActies } = await supabase
          .from('acties')
          .select('id', { count: 'exact', head: true })
          .eq('lid_id', lid.id)
          .eq('status', 'open')

        const stoplight = computeStoplight(lastEval ?? null)
        const redenen = buildRedenen(
          lastEval ?? null,
          daysSince(lastContact?.datum ?? null),
          daysSince(lastEval?.datum ?? null),
          openActies ?? 0
        )

        return { lid, stoplight, redenen }
      })
    )

    // Sort: rood → amber → groen → leeg
    const order: Record<Stoplight, number> = { rood: 0, amber: 1, groen: 2, leeg: 3 }
    signals.sort((a, b) => order[a.stoplight] - order[b.stoplight])
    setAttentie(signals)
    setLoading(false)
  }, [token])

  useEffect(() => {
    if (!token) {
      setError('Geen consolecode gevonden. Open de link die management heeft aangemaakt.')
      setLoading(false)
      return
    }
    load()
  }, [token, load])

  // ---- ERROR STATE ----
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        padding: 24,
      }}>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          padding: 40,
          maxWidth: 420,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
          <div style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Console niet beschikbaar</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{error}</div>
        </div>
      </div>
    )
  }

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Console laden…</div>
      </div>
    )
  }

  // ---- FILTERED LIST ----
  const visible = filter === 'allen'
    ? attentie
    : attentie.filter(s => s.stoplight === filter)

  // ---- MEMBER DETAIL VIEW ----
  if (selectedLid) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
        <LidPanel
          lid={selectedLid}
          trainerToken={token}
          onBack={() => { setSelectedLid(null); load() }}
        />
      </div>
    )
  }

  // ---- MAIN LIST VIEW ----
  const counts = {
    rood:  attentie.filter(s => s.stoplight === 'rood').length,
    amber: attentie.filter(s => s.stoplight === 'amber').length,
    groen: attentie.filter(s => s.stoplight === 'groen').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-surface)',
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {trainer ? `${trainer.voornaam} ${trainer.achternaam}` : 'Console'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Studio console · alleen lokaal gebruik</div>
        </div>

        {/* Stoplight summary */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['rood', 'amber', 'groen'] as const).map(sl => (
            <div key={sl} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 20,
              background: SL[sl].bg,
              border: `1px solid ${SL[sl].border}`,
              fontSize: 12,
              fontWeight: 600,
              color: SL[sl].text,
              cursor: 'pointer',
              opacity: filter !== 'allen' && filter !== sl ? 0.4 : 1,
            }}
              onClick={() => setFilter(f => f === sl ? 'allen' : sl)}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SL[sl].dot, display: 'inline-block' }} />
              {counts[sl]}
            </div>
          ))}
        </div>
      </div>

      {/* Member list */}
      <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            Geen leden in deze categorie
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map(({ lid, stoplight, redenen }) => {
              const col = SL[stoplight]
              return (
                <div
                  key={lid.id}
                  onClick={() => setSelectedLid(lid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    background: 'var(--bg-surface)',
                    border: `1px solid ${col.border}`,
                    borderLeft: `3px solid ${col.dot}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Stoplight dot */}
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: col.dot,
                    flexShrink: 0,
                  }} />

                  {/* Name + signals */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lid.voornaam} {lid.achternaam}
                    </div>
                    {redenen.length > 0 && (
                      <div style={{ fontSize: 11, color: col.text, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {redenen.join(' · ')}
                      </div>
                    )}
                  </div>

                  <span style={{ color: 'var(--border-strong)', fontSize: 16 }}>›</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

// ============================================================
// MAIN CONSOLE PAGE — wraps ConsoleInner in Suspense
// ============================================================

export default function ConsolePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Console laden…</div>
      </div>
    }>
      <ConsoleInner />
    </Suspense>
  )
}
