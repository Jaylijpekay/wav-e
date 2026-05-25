'use client'

import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getActieUrgency, isActieOpen, URGENCY_BG, URGENCY_COLOR, URGENCY_LABEL } from '@/lib/actieUrgency'
import { daysSince, getLatestContactDatum } from '@/lib/stoplight'

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  email: string | null
  telefoon: string | null
  geboortedatum: string | null
  startdatum: string | null
  actief: boolean
  trainer_id: string
}

type Evaluatie = {
  id: string
  cyclus: number
  datum: string
  slaap: number | null
  energie: number | null
  stress: number | null
  voeding: number | null
  beweging: number | null
  tevredenheid: number | null
  motivatie: number | null
  gewicht_kg: number | null
  vetpercentage: number | null
  spiermassa_kg: number | null
  visceraal_vet: number | null
  buikomvang_cm: number | null
}

type ContactMoment = {
  id: string
  datum: string
  type: string | null
  notities: string | null
  contact_door: string | null
}

type Actie = {
  id: string
  omschrijving: string
  status: string
  aangemaakt: string
  deadline: string | null
  bron: string
  afgerond: boolean
}

type Notitie = {
  id: string
  lid_id: string
  evaluatie_id: string | null
  auteur_id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  auteur_naam: string
  tekst: string
  aangemaakt_op: string
  toon_aan_trainer: boolean
  gezien: boolean
}

type HealthSignal = {
  key: string
  label: string
  value: number | null
  unit: string
  status: 'red' | 'amber' | 'green' | 'empty'
  reden: string
  inverted: boolean
}

const formatDate = (date: string | null): string => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const buildHealthSignals = (ev: Evaluatie | null): HealthSignal[] => {
  const make = (key: string, label: string, value: number | null, unit: string, inverted: boolean): HealthSignal => {
    if (value === null) return { key, label, value, unit, status: 'empty', reden: 'Nog niet gemeten', inverted }
    const bad = inverted ? value > 7 : value < 6
    const warn = inverted ? value > 5 : value < 7
    const status = bad ? 'red' : warn ? 'amber' : 'green'
    const reden = bad ? (inverted ? 'Boven drempelwaarde' : 'Onder drempelwaarde') : warn ? 'Dicht bij drempelwaarde' : 'Goed'
    return { key, label, value, unit, status, reden, inverted }
  }
  return [
    make('slaap', 'Slaap', ev?.slaap ?? null, '/10', false),
    make('energie', 'Energie', ev?.energie ?? null, '/10', false),
    make('stress', 'Stress', ev?.stress ?? null, '/10', true),
    make('voeding', 'Voeding', ev?.voeding ?? null, '/10', false),
    make('beweging', 'Beweging', ev?.beweging ?? null, '/10', false),
    make('tevredenheid', 'Tevredenheid', ev?.tevredenheid ?? null, '/10', false),
    make('motivatie', 'Motivatie', ev?.motivatie ?? null, '/10', false),
  ]
}

const SIGNAL = {
  red: { dot: 'var(--red-danger)', text: 'var(--red-text)', bg: 'rgba(220,38,38,0.08)' },
  amber: { dot: 'var(--amber)', text: 'var(--amber-text)', bg: 'rgba(217,119,6,0.08)' },
  green: { dot: 'var(--green-signal)', text: 'var(--green-signal-text)', bg: 'rgba(22,163,74,0.08)' },
  empty: { dot: 'var(--border-subtle)', text: 'var(--text-muted)', bg: 'var(--bg-raised)' },
}

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

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const secondaryButtonStyle: CSSProperties = {
  minHeight: 44,
  background: 'none',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  padding: '9px 18px',
  color: 'var(--text-muted)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  touchAction: 'manipulation',
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 44,
  background: 'var(--color-accent)',
  color: 'var(--color-white)',
  border: 'none',
  borderRadius: 8,
  padding: '9px 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  touchAction: 'manipulation',
}

const sectionStyle: CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 16,
  overflow: 'hidden',
}

const sectionHeaderStyle: CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const detailValueStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 14,
  marginTop: 4,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

function NotitieCard({ notitie, onDelete }: { notitie: Notitie; onDelete: () => void }) {
  const isMgmt = notitie.auteur_type === 'management' || notitie.auteur_type === 'admin'
  const date = new Date(notitie.aangemaakt_op)
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const dateLabel = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`

  return (
    <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', background: isMgmt ? 'rgba(99,102,241,0.05)' : 'transparent', borderLeft: isMgmt ? '3px solid var(--color-accent)' : '3px solid transparent' }}>
      {notitie.toon_aan_trainer && (
        <span style={{ display: 'inline-flex', fontSize: 11, fontWeight: 700, color: 'var(--color-accent-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Urgent voor trainer</span>
      )}
      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{notitie.tekst}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notitie.auteur_naam} · {dateLabel}</div>
        <button style={{ ...secondaryButtonStyle, padding: '6px 12px', fontSize: 12 }} onClick={onDelete}>Verwijder</button>
      </div>
    </div>
  )
}

export default function LedenDetail() {
  const { id } = useParams()
  const router = useRouter()

  const [lid, setLid] = useState<Lid | null>(null)
  const [evaluaties, setEvaluaties] = useState<Evaluatie[]>([])
  const [contacten, setContacten] = useState<ContactMoment[]>([])
  const [acties, setActies] = useState<Actie[]>([])
  const [loading, setLoading] = useState(true)

  const [contactOpen, setContactOpen] = useState(false)
  const [contactDatum, setContactDatum] = useState(new Date().toISOString().split('T')[0])
  const [contactType, setContactType] = useState('gesprek')
  const [contactNotities, setContactNotities] = useState('')
  const [contactDoor, setContactDoor] = useState('')
  const [trainerNaam, setTrainerNaam] = useState<string | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [notities, setNotities] = useState<Notitie[]>([])
  const [notitiesLoading, setNotitiesLoading] = useState(true)
  const [notitiesTekst, setNotitiesTekst] = useState('')
  const [notitiesPosting, setNotitiesPosting] = useState(false)
  const [notitiesError, setNotitiesError] = useState<string | null>(null)
  const [notitiesMax, setNotitiesMax] = useState(10)
  const [showAddActie, setShowAddActie] = useState(false)
  const [showToekomstigeActies, setShowToekomstigeActies] = useState(false)
  const [actieTekst, setActieTekst] = useState('')
  const [actieDeadline, setActieDeadline] = useState('')
  const [actiePosting, setActiePosting] = useState(false)
  const [actieError, setActieError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setNotitiesLoading(true)
      try {
        const [authRes, lidRes, notitiesRes, actiesRes] = await Promise.all([
          fetch('/api/auth-context'),
          fetch(`/api/leden/${id}`),
          fetch(`/api/notities/${id}`),
          fetch(`/api/acties?lid_id=${id}`),
        ])

        const authData = authRes.ok ? await authRes.json() : {}
        const roleData = authData.role ?? null
        const authMode = authData.authMode ?? null
        setRole(roleData)

        if (roleData === 'trainer' && authMode === 'session') {
          try {
            const supabase = getSupabase()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: trainerData } = await supabase.from('trainers').select('naam').eq('id', user.id).single()
              if (trainerData?.naam) setTrainerNaam(trainerData.naam)
            }
          } catch { /* non-critical */ }
        }

        if (lidRes.ok) {
          const { lid: lidData, evaluaties: evalData, contacten: contactData } = await lidRes.json()
          setLid(lidData ?? null)
          setEvaluaties(evalData ?? [])
          setContacten(contactData ?? [])
        }

        if (notitiesRes.ok) {
          const data = await notitiesRes.json()
          setNotities(data.notities ?? [])
        } else {
          setNotities([])
        }

        if (actiesRes.ok) {
          const data = await actiesRes.json()
          setActies((data.acties ?? []).map((actie: Partial<Actie>) => ({
            ...actie,
            bron: actie.bron ?? 'trainer',
            afgerond: actie.afgerond ?? actie.status === 'afgerond',
          })) as Actie[])
        }
      } catch {
        setNotities([])
        setActies([])
      } finally {
        setLoading(false)
        setNotitiesLoading(false)
      }
    }
    if (id) load()
  }, [id])

  const markActieAfgerond = async (actieId: string) => {
    const res = await fetch(`/api/acties/${actieId}`, { method: 'PATCH' })
    if (res.ok) setActies(prev => prev.filter(a => a.id !== actieId))
  }

  const addActie = async () => {
    if (!actieTekst.trim() || actiePosting) return
    if (!actieDeadline) {
      setActieError('Deadline is verplicht')
      return
    }
    setActiePosting(true)
    setActieError(null)
    try {
      const res = await fetch('/api/acties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lid_id: id, omschrijving: actieTekst.trim(), deadline: actieDeadline || null }),
      })
      if (res.ok) {
        const data = await res.json()
        const newActie = data.actie as Partial<Actie>
        setActies(prev => [...prev, {
          ...newActie,
          bron: newActie.bron ?? (role === 'trainer' ? 'trainer' : 'management'),
          afgerond: newActie.afgerond ?? false,
        } as Actie])
        setActieTekst('')
        setActieDeadline('')
        setShowAddActie(false)
      } else {
        const err = await res.json().catch(() => null)
        setActieError(err?.error ?? 'Actie opslaan mislukt')
      }
    } catch {
      setActieError('Verbindingsfout - probeer opnieuw')
    } finally {
      setActiePosting(false)
    }
  }

  const logContact = async () => {
    if (!lid) return
    setSavingContact(true)
    try {
      const resolvedDoor = role === 'trainer' ? trainerNaam : (contactDoor.trim() || null)
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lid_id: lid.id,
          trainer_id: lid.trainer_id,
          datum: contactDatum,
          type: contactType,
          notities: contactNotities || null,
          contact_door: resolvedDoor,
        }),
      })
      if (!res.ok) return
      const lidRes = await fetch(`/api/leden/${lid.id}`)
      if (lidRes.ok) {
        const { contacten: fresh } = await lidRes.json()
        setContacten(fresh ?? [])
      }
      setContactOpen(false)
      setContactNotities('')
      setContactDoor('')
    } catch { /* silent */ }
    finally {
      setSavingContact(false)
    }
  }

  const postNotitie = async () => {
    if (!notitiesTekst.trim() || notitiesTekst.length > 1000) return
    setNotitiesPosting(true)
    setNotitiesError(null)

    try {
      const res = await fetch(`/api/notities/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tekst: notitiesTekst.trim() }),
      })

      if (!res.ok) {
        const err = await res.json()
        setNotitiesError(err.error ?? 'Opslaan mislukt')
        return
      }

      const data = await res.json()
      const notitie = (data.notitie ?? data) as Notitie
      setNotities(prev => [notitie, ...prev])
      setNotitiesTekst('')
    } catch {
      setNotitiesError('Verbindingsfout')
    } finally {
      setNotitiesPosting(false)
    }
  }

  const deleteNotitie = async (notitieId: string) => {
    const previous = notities
    setNotities(prev => prev.filter(n => n.id !== notitieId))

    try {
      const res = await fetch(`/api/notities/${id}/${notitieId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
    } catch {
      try {
        const res = await fetch(`/api/notities/${id}`)
        if (!res.ok) throw new Error('Ophalen mislukt')
        const data = await res.json()
        setNotities(data.notities ?? [])
      } catch {
        setNotities(previous)
      }
    }
  }

  const latestEval = evaluaties[0] ?? null
  const healthSignals = buildHealthSignals(latestEval)
  const lastContactDatum = getLatestContactDatum(contacten[0]?.datum, latestEval?.datum)
  const lastContactDays = daysSince(lastContactDatum)
  const openActies = useMemo(
    () => acties.filter(a => !a.afgerond && isActieOpen(a.deadline, a.bron, a.afgerond)),
    [acties]
  )
  const toekomstigeActies = useMemo(
    () => acties.filter(a => !a.afgerond && getActieUrgency(a.deadline, a.bron) === 'toekomstig'),
    [acties]
  )
  const primarySignal: 'red' | 'amber' | 'green' = lastContactDays === null || lastContactDays > 28 ? 'red' : lastContactDays > 14 ? 'amber' : 'green'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      Laden…
    </div>
  )

  if (!lid) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      Lid niet gevonden.
    </div>
  )

  return (
    <div style={{ width: '90%', minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{lid.voornaam} {lid.achternaam}</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, borderRadius: 14, padding: '0 10px', background: SIGNAL[primarySignal].bg, color: SIGNAL[primarySignal].text, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SIGNAL[primarySignal].dot }} />
              {primarySignal === 'red' ? 'Aandacht' : primarySignal === 'amber' ? 'Let op' : 'Op koers'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{lid.lid_id}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={secondaryButtonStyle} onClick={() => router.back()}>← Terug</button>
          <button style={secondaryButtonStyle} onClick={() => router.push(`/leden/${id}/vooruitgang`)}>Vooruitgang</button>
          <button style={primaryButtonStyle} onClick={() => router.push(`/gesprek/new?lid_id=${lid.id}`)}>+ Nieuw gesprek</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Gegevens</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lid.actief ? 'Actief' : 'Inactief'}</div>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
              {[
                ['Email', lid.email ?? '—'],
                ['Telefoon', lid.telefoon ?? '—'],
                ['Startdatum', formatDate(lid.startdatum)],
                ['Geboortedatum', formatDate(lid.geboortedatum)],
                ['Laatste contact', lastContactDays === null ? 'Nog geen contact' : `${lastContactDays} dagen geleden`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    minWidth: 0,
                    gridColumn: label === 'Email' || label === 'Telefoon' ? '1 / -1' : undefined,
                  }}
                >
                  <div style={labelStyle}>{label}</div>
                  <div style={detailValueStyle}>{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Contact</div>
              <button style={secondaryButtonStyle} onClick={() => setContactOpen(o => !o)}>{contactOpen ? 'Annuleren' : '+ Log contact'}</button>
            </div>
            {contactOpen && (
              <div style={{ padding: 24, borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={labelStyle}>Datum</label><input type="date" value={contactDatum} onChange={e => setContactDatum(e.target.value)} style={inputStyle} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={labelStyle}>Type</label><select value={contactType} onChange={e => setContactType(e.target.value)} style={inputStyle}><option value="gesprek">Gesprek</option><option value="training">Training</option><option value="whatsapp">WhatsApp</option><option value="telefoon">Telefoon</option><option value="overig">Overig</option></select></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Door</label>
                  {role === 'trainer'
                    ? <div style={{ ...inputStyle, color: 'var(--text-muted)' }}>{trainerNaam ?? '—'}</div>
                    : <input type="text" value={contactDoor} onChange={e => setContactDoor(e.target.value)} placeholder="Naam van de contactpersoon…" style={inputStyle} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><label style={labelStyle}>Notities</label><textarea value={contactNotities} onChange={e => setContactNotities(e.target.value)} placeholder="Optioneel…" style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }} /></div>
                <button style={{ ...primaryButtonStyle, alignSelf: 'flex-start', opacity: savingContact ? 0.6 : 1 }} onClick={logContact} disabled={savingContact}>{savingContact ? 'Opslaan…' : 'Opslaan'}</button>
              </div>
            )}
            {contacten.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nog geen contactmomenten.</div>
            ) : contacten.map(c => (
              <div key={c.id} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>{c.type ?? 'Contact'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{formatDate(c.datum)}{c.contact_door ? ` · ${c.contact_door}` : ''}</div>
                {c.notities && <div style={{ color: 'var(--text-primary)', fontSize: 13, marginTop: 6 }}>{c.notities}</div>}
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Evaluaties</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{evaluaties.length}</div>
            </div>
            {evaluaties.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nog geen evaluaties.</div>
            ) : evaluaties.map(ev => (
              <div key={ev.id} onClick={() => router.push(`/leden/${id}/evaluatie/${ev.cyclus}`)} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', minHeight: 64, touchAction: 'manipulation' }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>Cyclus {ev.cyclus}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{formatDate(ev.datum)}</div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>›</span>
              </div>
            ))}
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Notities</div>
              {notities.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notities.length}</div>}
            </div>
            {notitiesLoading ? (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Laden…</div>
            ) : notities.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Nog geen notities.</div>
            ) : (
              notities.slice(0, notitiesMax).map(notitie => <NotitieCard key={notitie.id} notitie={notitie} onDelete={() => deleteNotitie(notitie.id)} />)
            )}
            {notities.length > notitiesMax && <button style={{ ...secondaryButtonStyle, margin: 16 }} onClick={() => setNotitiesMax(n => n + 10)}>Toon meer</button>}
            <div style={{ padding: 24, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea value={notitiesTekst} onChange={e => setNotitiesTekst(e.target.value)} placeholder="Schrijf een notitie…" maxLength={1000} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 88 }} />
              {notitiesTekst.length >= 800 && <div style={{ textAlign: 'right', color: notitiesTekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-muted)', fontSize: 12 }}>{notitiesTekst.length}/1000</div>}
              {notitiesError && <div style={{ color: 'var(--red-text)', fontSize: 13 }}>{notitiesError}</div>}
              <button style={{ ...primaryButtonStyle, alignSelf: 'flex-end', opacity: notitiesPosting || !notitiesTekst.trim() ? 0.5 : 1 }} onClick={postNotitie} disabled={notitiesPosting || !notitiesTekst.trim()}>{notitiesPosting ? 'Opslaan…' : 'Toevoegen'}</button>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Gezondheid</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{latestEval ? `cyclus ${latestEval.cyclus}` : 'geen data'}</div>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {healthSignals.filter(sig => sig.key !== 'tevredenheid' || role === 'management' || role === 'admin').map(sig => {
                const col = SIGNAL[sig.status]
                return (
                  <div key={sig.key} style={{ background: col.bg, border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot }} />
                      <span style={{ ...labelStyle, textTransform: 'none', letterSpacing: 0 }}>{sig.label}</span>
                    </div>
                    <div style={{ color: col.text, fontSize: 24, fontWeight: 800, marginTop: 8 }}>{sig.value ?? '—'}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sig.value !== null ? sig.unit : ''}</span></div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{sig.reden}</div>
                  </div>
                )
              })}
            </div>
          </section>

          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Acties</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{openActies.length}</span>
                <button style={{ ...secondaryButtonStyle, padding: '6px 12px', minHeight: 44 }} onClick={() => { setShowAddActie(o => !o); setActieTekst(''); setActieDeadline('') }}>{showAddActie ? 'Annuleren' : '+ Actie'}</button>
              </div>
            </div>
            {showAddActie && (
              <div style={{ padding: 24, borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="text" placeholder="Omschrijving van de actie…" value={actieTekst} onChange={e => setActieTekst(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addActie() }} autoFocus style={inputStyle} />
                <input type="date" value={actieDeadline} onChange={e => setActieDeadline(e.target.value)} required style={inputStyle} />
                {actieError && <div style={{ color: 'var(--red-text)', fontSize: 13 }}>{actieError}</div>}
                <button onClick={addActie} disabled={!actieTekst.trim() || !actieDeadline || actiePosting} style={{ ...primaryButtonStyle, alignSelf: 'flex-start', opacity: !actieTekst.trim() || !actieDeadline || actiePosting ? 0.5 : 1 }}>{actiePosting ? 'Opslaan…' : 'Toevoegen'}</button>
              </div>
            )}
            {openActies.length === 0 && toekomstigeActies.length === 0 && !showAddActie ? (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen open acties.</div>
            ) : (
              <>
                {openActies.map(actie => {
                  const urgency = getActieUrgency(actie.deadline, actie.bron)
                  const kleur = urgency === 'toekomstig' ? 'groen' : urgency
                  return (
                    <div key={actie.id} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', borderLeft: `3px solid ${URGENCY_COLOR[kleur]}`, background: URGENCY_BG[kleur], display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>{actie.omschrijving}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{formatDate(actie.aangemaakt)} · <span style={{ color: URGENCY_COLOR[kleur], fontWeight: 700 }}>{URGENCY_LABEL[urgency]}</span>{actie.deadline ? ` · deadline ${formatDate(actie.deadline)}` : ''}</div>
                      </div>
                      <button style={{ ...secondaryButtonStyle, width: 44, padding: 0, color: 'var(--green-signal-text)' }} onClick={() => markActieAfgerond(actie.id)}>✓</button>
                    </div>
                  )
                })}
                {toekomstigeActies.length > 0 && (
                  <>
                    <button onClick={() => setShowToekomstigeActies(o => !o)} style={{ ...sectionHeaderStyle, width: '100%', background: 'var(--bg-surface)', border: 'none', borderTop: '1px solid var(--border-subtle)', minHeight: 44, cursor: 'pointer', touchAction: 'manipulation' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Toekomstig ({toekomstigeActies.length})</div>
                      <div style={{ color: 'var(--text-muted)' }}>{showToekomstigeActies ? '▲' : '▼'}</div>
                    </button>
                    {showToekomstigeActies && toekomstigeActies.map(actie => (
                      <div key={actie.id} style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', opacity: 0.72, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>{actie.omschrijving}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>{actie.deadline ? `deadline ${formatDate(actie.deadline)}` : 'Geen deadline'}</div>
                        </div>
                        <button style={{ ...secondaryButtonStyle, width: 44, padding: 0, color: 'var(--green-signal-text)' }} onClick={() => markActieAfgerond(actie.id)}>✓</button>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
