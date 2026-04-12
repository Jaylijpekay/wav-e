'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import Navigation from '@/app/components/Navigation'

// ─── Types ───────────────────────────────────────────────────
type Trainer = {
  id: string
  naam: string
}

type LidRow = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  status: string
  trainer_id: string
  trainer_naam: string
  laatste_contact: string | null
  laatste_evaluatie: string | null
  open_acties: number
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

// ─── Helpers ─────────────────────────────────────────────────
const daysSince = (date: string | null): number | null => {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type StoplightStatus = 'red' | 'amber' | 'green' | 'empty'

const computeStoplight = (lid: LidRow): StoplightStatus => {
  const { slaap, energie, stress, laatste_contact, laatste_evaluatie } = lid
  const contactDays = daysSince(laatste_contact)
  const evalDays = daysSince(laatste_evaluatie)

  if (
    (slaap !== null && slaap < 6) ||
    (energie !== null && energie < 6) ||
    (stress !== null && stress > 7) ||
    (contactDays !== null && contactDays > 14) ||
    (evalDays !== null && evalDays > 42)
  ) return 'red'

  if (
    (slaap !== null && slaap < 7) ||
    (energie !== null && energie < 7) ||
    (stress !== null && stress > 5) ||
    (contactDays !== null && contactDays > 10) ||
    (evalDays !== null && evalDays > 35) ||
    laatste_contact === null ||
    laatste_evaluatie === null
  ) return 'amber'

  return 'green'
}

const computeSignalTags = (lid: LidRow): string[] => {
  const tags: string[] = []
  const contactDays = daysSince(lid.laatste_contact)
  const evalDays = daysSince(lid.laatste_evaluatie)
  if (!lid.laatste_contact || (contactDays !== null && contactDays > 14)) tags.push('geen contact')
  if (!lid.laatste_evaluatie || (evalDays !== null && evalDays > 42)) tags.push('geen evaluatie')
  if (lid.slaap !== null && lid.slaap < 6) tags.push('slaap ↓')
  if (lid.energie !== null && lid.energie < 6) tags.push('energie ↓')
  if (lid.stress !== null && lid.stress > 7) tags.push('stress ↑')
  if (lid.open_acties > 0) tags.push(`${lid.open_acties} acties open`)
  return tags
}

// ─── Stoplight dot ───────────────────────────────────────────
const Dot = ({ status }: { status: StoplightStatus }) => {
  const colors: Record<StoplightStatus, string> = {
    red:   'var(--red)',
    amber: 'var(--amber)',
    green: 'var(--green-signal)',
    empty: 'var(--border-strong)',
  }
  return (
    <span style={{
      display: 'inline-block',
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: colors[status],
      flexShrink: 0,
      marginTop: 1,
    }} />
  )
}

// ─── Main component ──────────────────────────────────────────
export default function ManagementDashboard() {
  const router = useRouter()

  const [leden, setLeden] = useState<LidRow[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [counts, setCounts] = useState<StudioCounts | null>(null)
  const [loading, setLoading] = useState(true)

  // Actie form state
  const [actieOpen, setActieOpen] = useState(false)
  const [actieTrainer, setActieTrainer] = useState('')
  const [actieOmschrijving, setActieOmschrijving] = useState('')
  const [actieDeadline, setActieDeadline] = useState('')
  const [savingActie, setSavingActie] = useState(false)
  const [actieSuccess, setActieSuccess] = useState(false)

  // Filter
  const [filterStatus, setFilterStatus] = useState<'all' | StoplightStatus>('all')
  const [filterTrainer, setFilterTrainer] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()

      const { data: rawLeden } = await supabase
        .from('leden')
        .select(`
          id, lid_id, voornaam, achternaam, status, actief, trainer_id,
          trainers!inner(naam)
        `)
        .eq('actief', true)

      const ledenIds = (rawLeden ?? []).map((l: any) => l.id)

      // Latest contact per lid
      const { data: contacts } = await supabase
        .from('contact_momenten')
        .select('lid_id, datum')
        .in('lid_id', ledenIds)
        .order('datum', { ascending: false })

      // Latest evaluatie per lid
      const { data: evals } = await supabase
        .from('evaluaties')
        .select('lid_id, datum, slaap, energie, stress')
        .in('lid_id', ledenIds)
        .order('cyclus', { ascending: false })

      // Open acties per lid
      const { data: actiesData } = await supabase
        .from('acties')
        .select('lid_id')
        .in('lid_id', ledenIds)
        .eq('afgerond', false)
        .eq('status', 'open')

      // Build lookup maps
      const lastContact: Record<string, string> = {}
      for (const c of contacts ?? []) {
        if (!lastContact[c.lid_id]) lastContact[c.lid_id] = c.datum
      }

      const lastEval: Record<string, { datum: string; slaap: number | null; energie: number | null; stress: number | null }> = {}
      for (const e of evals ?? []) {
        if (!lastEval[e.lid_id]) lastEval[e.lid_id] = { datum: e.datum, slaap: e.slaap, energie: e.energie, stress: e.stress }
      }

      const actieCount: Record<string, number> = {}
      for (const a of actiesData ?? []) {
        actieCount[a.lid_id] = (actieCount[a.lid_id] ?? 0) + 1
      }

      const enriched: LidRow[] = (rawLeden ?? []).map((l: any) => ({
        id: l.id,
        lid_id: l.lid_id,
        voornaam: l.voornaam,
        achternaam: l.achternaam,
        status: l.status,
        trainer_id: l.trainer_id,
        trainer_naam: l.trainers?.naam ?? '—',
        laatste_contact: lastContact[l.id] ?? null,
        laatste_evaluatie: lastEval[l.id]?.datum ?? null,
        open_acties: actieCount[l.id] ?? 0,
        slaap: lastEval[l.id]?.slaap ?? null,
        energie: lastEval[l.id]?.energie ?? null,
        stress: lastEval[l.id]?.stress ?? null,
      }))

      setLeden(enriched)

      // Trainers
      const { data: trainerData } = await supabase.from('trainers').select('id, naam').order('naam')
      setTrainers(trainerData ?? [])
      if (trainerData?.length) setActieTrainer(trainerData[0].id)

      // Studio counts
      const { data: allLeden } = await supabase.from('leden').select('status')
      const c: StudioCounts = { actief: 0, bevroren: 0, on_hold: 0, stopt: 0, inactief: 0 }
      for (const l of allLeden ?? []) {
        const s = (l.status ?? '').toLowerCase().replace(' ', '_')
        if (s === 'actief') c.actief++
        else if (s === 'bevroren') c.bevroren++
        else if (s === 'on_hold' || s === 'on hold') c.on_hold++
        else if (s === 'stopt') c.stopt++
        else if (s === 'inactief') c.inactief++
      }
      setCounts(c)

      setLoading(false)
    }
    load()
  }, [])

  const addActie = async () => {
    if (!actieTrainer || !actieOmschrijving.trim()) return
    setSavingActie(true)
    const supabase = getSupabase()
    await supabase.from('acties').insert({
      trainer_id: actieTrainer,
      lid_id: null,
      type: 'management',
      omschrijving: actieOmschrijving.trim(),
      deadline: actieDeadline || null,
      status: 'open',
      bron: 'management',
    })
    setActieOmschrijving('')
    setActieDeadline('')
    setSavingActie(false)
    setActieOpen(false)
    setActieSuccess(true)
    setTimeout(() => setActieSuccess(false), 3000)
  }

  // Computed
  const withStatus = leden.map(l => ({ ...l, stoplight: computeStoplight(l) }))
  const redCount   = withStatus.filter(l => l.stoplight === 'red').length
  const amberCount = withStatus.filter(l => l.stoplight === 'amber').length
  const greenCount = withStatus.filter(l => l.stoplight === 'green').length

  const filtered = withStatus.filter(l => {
    if (filterStatus !== 'all' && l.stoplight !== filterStatus) return false
    if (filterTrainer !== 'all' && l.trainer_id !== filterTrainer) return false
    return true
  })

  // Group by trainer for coach execution panel
  const byTrainer: Record<string, typeof withStatus> = {}
  for (const l of withStatus) {
    if (!byTrainer[l.trainer_naam]) byTrainer[l.trainer_naam] = []
    byTrainer[l.trainer_naam].push(l)
  }

  if (loading) return (
    <>
      <Navigation />
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-primary)', fontSize: '0.85rem', letterSpacing: '0.1em' }}>Laden…</span>
      </div>
    </>
  )

  return (
    <>
      <Navigation />
      <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
        <div className="container">

          {/* Header */}
          <div className="page-header fade-up">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 className="page-title">Management <span>overzicht</span></h1>
                <p className="page-subtitle">Studio-breed · alleen lezen</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setActieOpen(o => !o)}
              >
                {actieOpen ? '× annuleer' : '+ actie toewijzen'}
              </button>
            </div>
          </div>

          {/* Assign actie form */}
          {actieOpen && (
            <div className="card fade-up" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <p className="section-label" style={{ marginBottom: '1rem' }}>Actie toewijzen aan trainer</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group">
                  <label className="form-label">Trainer</label>
                  <select
                    className="form-select"
                    value={actieTrainer}
                    onChange={e => setActieTrainer(e.target.value)}
                  >
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.naam}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <input
                    type="date"
                    className="form-input"
                    value={actieDeadline}
                    onChange={e => setActieDeadline(e.target.value)}
                  />
                </div>
                <div />
              </div>
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Omschrijving</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Beschrijf de actie…"
                  value={actieOmschrijving}
                  onChange={e => setActieOmschrijving(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addActie()}
                />
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={addActie}
                  disabled={savingActie || !actieOmschrijving.trim()}
                >
                  {savingActie ? 'Opslaan…' : 'Opslaan'}
                </button>
                <button className="btn btn-secondary" onClick={() => setActieOpen(false)}>Annuleer</button>
              </div>
            </div>
          )}

          {actieSuccess && (
            <div className="alert alert-success fade-up" style={{ marginBottom: '1.5rem' }}>
              Actie toegewezen aan trainer.
            </div>
          )}

          {/* Studio counts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Actief',    value: counts?.actief   ?? 0, color: 'var(--green-signal)' },
              { label: 'Bevroren',  value: counts?.bevroren ?? 0, color: 'var(--text-muted)' },
              { label: 'On hold',   value: counts?.on_hold  ?? 0, color: 'var(--amber)' },
              { label: 'Stopt',     value: counts?.stopt    ?? 0, color: 'var(--red)' },
              { label: 'Inactief',  value: counts?.inactief ?? 0, color: 'var(--text-disabled)' },
            ].map((item, i) => (
              <div key={item.label} className={`card fade-up-${i + 1}`} style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: item.color, lineHeight: 1, fontFamily: 'var(--font-primary)' }}>
                  {item.value}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Stoplight summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { status: 'red'   as StoplightStatus, count: redCount,   label: 'Rood — actie vereist', bg: 'var(--red-bg)',          border: 'var(--red-border)',          color: 'var(--red)' },
              { status: 'amber' as StoplightStatus, count: amberCount, label: 'Amber — let op',       bg: 'var(--amber-bg)',         border: 'var(--amber-border)',        color: 'var(--amber)' },
              { status: 'green' as StoplightStatus, count: greenCount, label: 'Groen — op schema',    bg: 'var(--green-signal-bg)',  border: 'var(--green-signal-border)', color: 'var(--green-signal)' },
            ].map(item => (
              <button
                key={item.status}
                onClick={() => setFilterStatus(f => f === item.status ? 'all' : item.status)}
                style={{
                  background: filterStatus === item.status ? item.bg : 'var(--surface-base)',
                  border: `1px solid ${filterStatus === item.status ? item.border : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-card)',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  boxShadow: 'var(--shadow-float-sm)',
                }}
              >
                <div style={{ fontSize: '2rem', fontWeight: 700, color: item.color, lineHeight: 1, fontFamily: 'var(--font-primary)' }}>
                  {item.count}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: item.color, opacity: 0.8, marginTop: '0.4rem' }}>
                  {item.label}
                </div>
              </button>
            ))}
          </div>

          {/* Coach execution block */}
          <div style={{ marginBottom: '2rem' }}>
            <p className="section-label" style={{ marginBottom: '1rem' }}>Coach executie</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {Object.entries(byTrainer).map(([trainerNaam, trainerLeden]) => {
                const redL   = trainerLeden.filter(l => l.stoplight === 'red').length
                const amberL = trainerLeden.filter(l => l.stoplight === 'amber').length
                const openA  = trainerLeden.reduce((s, l) => s + l.open_acties, 0)
                return (
                  <div key={trainerNaam} className="card" style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}>{trainerNaam}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-primary)' }}>{trainerLeden.length} leden</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      {redL > 0 && <span className="badge badge-red">{redL} rood</span>}
                      {amberL > 0 && <span className="badge badge-amber">{amberL} amber</span>}
                      {openA > 0 && <span className="badge badge-gray">{openA} open acties</span>}
                      {redL === 0 && amberL === 0 && <span className="badge badge-green">op schema</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {trainerLeden.map(l => (
                        <button
                          key={l.id}
                          onClick={() => router.push(`/leden/${l.id}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            background: 'none',
                            border: 'none',
                            padding: '0.35rem 0',
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          <Dot status={l.stoplight} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)', flex: 1 }}>
                            {l.voornaam} {l.achternaam}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-primary)' }}>
                            {l.laatste_contact ? `${daysSince(l.laatste_contact)}d` : 'geen'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Full member table */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <p className="section-label">Alle leden</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                value={filterTrainer}
                onChange={e => setFilterTrainer(e.target.value)}
              >
                <option value="all">Alle trainers</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.naam}</option>)}
              </select>
              {filterStatus !== 'all' && (
                <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => setFilterStatus('all')}>
                  × reset filter
                </button>
              )}
            </div>
          </div>

          <div className="table-wrapper" style={{ marginBottom: '3rem' }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Lid</th>
                  <th>Trainer</th>
                  <th>Laatste contact</th>
                  <th>Laatste evaluatie</th>
                  <th>Open acties</th>
                  <th>Signalen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Geen leden gevonden
                    </td>
                  </tr>
                )}
                {filtered.map(l => {
                  const tags = computeSignalTags(l)
                  const contactDays = daysSince(l.laatste_contact)
                  const evalDays    = daysSince(l.laatste_evaluatie)
                  return (
                    <tr
                      key={l.id}
                      onClick={() => router.push(`/leden/${l.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ width: 32, paddingRight: 0 }}>
                        <Dot status={l.stoplight} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{l.voornaam} {l.achternaam}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.lid_id}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{l.trainer_naam}</td>
                      <td>
                        {contactDays === null
                          ? <span style={{ color: 'var(--red)', fontSize: '0.8rem' }}>nooit</span>
                          : <span style={{ color: contactDays > 14 ? 'var(--red)' : contactDays > 10 ? 'var(--amber)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {contactDays}d geleden
                            </span>
                        }
                      </td>
                      <td>
                        {evalDays === null
                          ? <span style={{ color: 'var(--amber)', fontSize: '0.8rem' }}>nog niet</span>
                          : <span style={{ color: evalDays > 42 ? 'var(--red)' : evalDays > 35 ? 'var(--amber)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {formatDate(l.laatste_evaluatie)}
                            </span>
                        }
                      </td>
                      <td>
                        {l.open_acties > 0
                          ? <span className="badge badge-gray">{l.open_acties}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className={`badge ${l.stoplight === 'red' ? 'badge-red' : 'badge-amber'}`}
                              style={{ fontSize: '0.58rem' }}
                            >
                              {tag}
                            </span>
                          ))}
                          {tags.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </>
  )
}
