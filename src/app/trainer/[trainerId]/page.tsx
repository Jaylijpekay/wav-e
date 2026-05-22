'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getActieUrgency, isActieOpen, URGENCY_COLOR, URGENCY_LABEL } from '@/lib/actieUrgency'
import { daysSince, getLatestContactDatum, getStoplight } from '@/lib/stoplight'
import Navigation from '@/app/components/Navigation'

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  laatste_contact: string | null
  laatste_evaluatie: string | null
  slaap: number | null
  energie: number | null
  stress: number | null
  open_acties: number
}

type Actie = {
  id: string
  lid_uuid: string | null
  lid_id: string
  voornaam: string
  achternaam: string
  omschrijving: string
  aangemaakt: string
  deadline: string | null
  status: 'open' | 'afgerond' | 'overdue'
  bron: string
  afgerond: boolean
  is_management: boolean
}

type LidDropdown = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
}

type Trainer = {
  id: string
  naam: string
}

type UrgenteMelding = {
  id: string
  lid_id: string
  lid_naam: string
  tekst: string
  auteur_naam: string
  aangemaakt_op: string
}

type TrainerNotitie = {
  id: string
  trainer_id: string
  lid_id: string | null
  auteur_id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  auteur_naam: string
  tekst: string
  aangemaakt_op: string
}

interface MomentumProps {
  gesprekken: number
  actiesAfgerond: number
}

const toUiStoplight = (stoplight: ReturnType<typeof getStoplight>): 'red' | 'amber' | 'green' => {
  if (stoplight === 'rood') return 'red'
  if (stoplight === 'oranje') return 'amber'
  return 'green'
}

const getLidStoplight = (lid: Lid): 'red' | 'amber' | 'green' =>
  toUiStoplight(getStoplight(daysSince(getLatestContactDatum(lid.laatste_contact, lid.laatste_evaluatie))))

const STOPLIGHT = {
  red: { dot: 'var(--red-danger)', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)', text: 'var(--red-text)' },
  amber: { dot: 'var(--amber)', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)', text: 'var(--amber-text)' },
  green: { dot: 'var(--green-signal)', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)', text: 'var(--green-signal-text)' },
}

const STOPLIGHT_LABELS = {
  red: 'Aandacht nodig',
  amber: 'Let op',
  green: 'Op koers',
}

const DUTCH_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

const todayLabel = () => new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: 'long' })

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
}

function AddLidModal({
  trainerId,
  onClose,
  onSaved,
}: {
  trainerId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [nextLidId, setNextLidId] = useState('')
  const [lidId, setLidId] = useState('')
  const [voornaam, setVoornaam] = useState('')
  const [achternaam, setAchternaam] = useState('')
  const [email, setEmail] = useState('')
  const [telefoon, setTelefoon] = useState('')
  const [startdatum, setStartdatum] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState(true)

  useEffect(() => {
    const fetchNextId = async () => {
      const res = await fetch(`/api/trainer/${trainerId}/next-lid-id`)
      const data = res.ok ? await res.json() : { nextLidId: 'WE-001' }
      const next = data.nextLidId ?? 'WE-001'
      setNextLidId(next)
      setLidId(next)
      setLoadingId(false)
    }
    fetchNextId()
  }, [trainerId])

  const save = async () => {
    setError(null)
    if (!lidId.trim()) { setError('Lid-ID is verplicht'); return }
    if (!voornaam.trim()) { setError('Voornaam is verplicht'); return }
    if (!achternaam.trim()) { setError('Achternaam is verplicht'); return }

    setSaving(true)
    const res = await fetch(`/api/trainer/${trainerId}/leden`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lid_id: lidId,
        voornaam,
        achternaam,
        email,
        telefoon,
        startdatum,
      }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Lid aanmaken mislukt')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Nieuw lid toevoegen</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Dit lid wordt aan jou gekoppeld</div>
        </div>

        {loadingId ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Laden…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input type="text" value={lidId} onChange={e => setLidId(e.target.value)} placeholder={nextLidId} style={inputStyle} />
              <input type="date" value={startdatum} onChange={e => setStartdatum(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input type="text" value={voornaam} onChange={e => setVoornaam(e.target.value)} placeholder="Voornaam" style={inputStyle} />
              <input type="text" value={achternaam} onChange={e => setAchternaam(e.target.value)} placeholder="Achternaam" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optioneel)" style={inputStyle} />
              <input type="tel" value={telefoon} onChange={e => setTelefoon(e.target.value)} placeholder="Telefoon (optioneel)" style={inputStyle} />
            </div>
            {error && <div style={{ fontSize: 13, color: 'var(--red-text)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={secondaryButtonStyle}>Annuleren</button>
              <button onClick={save} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.6 : 1 }}>{saving ? 'Opslaan…' : 'Lid toevoegen'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReplyModal({
  trainerId,
  onClose,
  onSent,
}: {
  trainerId: string
  onClose: () => void
  onSent: (bericht: TrainerNotitie) => void
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
      const res = await fetch(`/api/trainer-notities/${trainerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tekst: tekst.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        setError(err?.error ?? 'Versturen mislukt')
        return
      }
      const bericht = (await res.json()) as TrainerNotitie
      onSent(bericht)
      onClose()
    } catch {
      setError('Verbindingsfout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Beantwoorden</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Naar management</div>
        </div>
        <textarea
          value={tekst}
          onChange={e => setTekst(e.target.value)}
          placeholder="Schrijf een reactie..."
          rows={4}
          maxLength={1000}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        {tekst.length >= 800 && (
          <div style={{ textAlign: 'right', color: tekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-muted)', fontSize: 12 }}>
            {tekst.length}/1000
          </div>
        )}
        {error && <div style={{ fontSize: 13, color: 'var(--red-text)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={secondaryButtonStyle}>Annuleren</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.6 : 1 }}>{saving ? 'Versturen...' : 'Versturen'}</button>
        </div>
      </div>
    </div>
  )
}

function MomentumStrip({ gesprekken, actiesAfgerond }: MomentumProps) {
  const [dispGesprekken, setDispGesprekken] = useState(0)
  const [dispActies, setDispActies] = useState(0)

  useEffect(() => {
    if (gesprekken === 0 && actiesAfgerond === 0) return
    const duration = 800
    const steps = 40
    const interval = duration / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      const t = step / steps
      const eased = 1 - Math.pow(1 - t, 3)
      setDispGesprekken(Math.round(eased * gesprekken))
      setDispActies(Math.round(eased * actiesAfgerond))
      if (step >= steps) clearInterval(timer)
    }, interval)
    return () => clearInterval(timer)
  }, [gesprekken, actiesAfgerond])

  const maand = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][new Date().getMonth()]

  return (
    <div style={{
      padding: '20px 24px',
      borderRadius: 12,
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Deze maand · {maand}
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: '2.4rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--green-signal-text)', fontVariantNumeric: 'tabular-nums' }}>
            {dispGesprekken}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
            Gesprekken
          </span>
        </div>
        <div style={{ width: 1, height: 48, background: 'var(--border-subtle)', margin: '0 28px', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: '2.4rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--green-signal-text)', fontVariantNumeric: 'tabular-nums' }}>
            {dispActies}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
            Acties afgerond
          </span>
        </div>
      </div>
    </div>
  )
}

export default function TrainerDashboard() {
  const { trainerId } = useParams()
  const router = useRouter()

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [leden, setLeden] = useState<Lid[]>([])
  const [acties, setActies] = useState<Actie[]>([])
  const [ledenDropdown, setLedenDropdown] = useState<LidDropdown[]>([])
  const [loading, setLoading] = useState(true)
  const [gesprekOpen, setGesprekOpen] = useState(false)
  const [openStoplight, setOpenStoplight] = useState<'red' | 'amber' | 'green' | null>(null)
  const [showAddLid, setShowAddLid] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [momentum, setMomentum] = useState<MomentumProps>({ gesprekken: 0, actiesAfgerond: 0 })
  const [meldingen, setMeldingen] = useState<UrgenteMelding[]>([])
  const [meldingenLoading, setMeldingenLoading] = useState(true)
  const [berichten, setBerichten] = useState<TrainerNotitie[]>([])
  const [berichtenLoading, setBerichtenLoading] = useState(true)
  const [berichtTekst, setBerichtTekst] = useState('')
  const [berichtenMax, setBerichtenMax] = useState(5)
  const [berichtPosting, setBerichtPosting] = useState(false)
  const [berichtError, setBerichtError] = useState<string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [replyTarget, setReplyTarget] = useState<TrainerNotitie | null>(null)

  const gesprekRef = useRef<HTMLDivElement>(null)
  const stoplichtRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/trainer/${trainerId}/dashboard`)
        if (!res.ok) throw new Error('Dashboard ophalen mislukt')
        const data = await res.json()
        setTrainer(data.trainer)
        setLedenDropdown(data.ledenDropdown ?? [])
        setLeden(data.leden ?? [])
        setActies(data.acties ?? [])
        setMomentum(data.momentum ?? { gesprekken: 0, actiesAfgerond: 0 })
        setMeldingen(data.meldingen ?? [])
      } catch {
        setTrainer(null)
        setLedenDropdown([])
        setLeden([])
        setActies([])
        setMomentum({ gesprekken: 0, actiesAfgerond: 0 })
        setMeldingen([])
      } finally {
        setMeldingenLoading(false)
        setLoading(false)
      }
    }
    if (trainerId) load()
  }, [trainerId, refreshKey])

  useEffect(() => {
    const fetchBerichten = async () => {
      setBerichtenLoading(true)
      try {
        const res = await fetch(`/api/trainer-notities/${trainerId}`)
        if (!res.ok) throw new Error('Ophalen mislukt')
        const data = await res.json()
        setBerichten(data.notities ?? [])
      } catch {
        setBerichten([])
      } finally {
        setBerichtenLoading(false)
      }
    }

    if (trainerId) fetchBerichten()
  }, [trainerId])

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (gesprekRef.current && !gesprekRef.current.contains(e.target as Node)) setGesprekOpen(false)
      if (stoplichtRef.current && !stoplichtRef.current.contains(e.target as Node)) setOpenStoplight(null)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const handleGesprekSelect = (lid: LidDropdown) => {
    setGesprekOpen(false)
    router.push(`/gesprek/new?lid_id=${lid.id}`)
  }

  const markGezien = async (notitieId: string, lidId: string) => {
    setMeldingen(prev => prev.filter(m => m.id !== notitieId))
    try {
      const res = await fetch(`/api/notities/${lidId}/${notitieId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gezien: true }),
      })
      if (!res.ok) throw new Error('Markeren mislukt')
    } catch {
      // Optimistic removal is acceptable for this dashboard; a refresh will reconcile state.
    }
  }

  const postBericht = async () => {
    if (!berichtTekst.trim() || berichtTekst.length > 1000) return
    setBerichtPosting(true)

    try {
      const res = await fetch(`/api/trainer-notities/${trainerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tekst: berichtTekst.trim() }),
      })
      if (!res.ok) return

      const data = await res.json()
      const bericht = (data.notitie ?? data) as TrainerNotitie
      setBerichten(prev => [...prev, bericht])
      setBerichtTekst('')
    } finally {
      setBerichtPosting(false)
    }
  }

  const deleteBericht = async (notitieId: string) => {
    const previous = berichten
    setBerichten(prev => prev.filter(b => b.id !== notitieId))
    setBerichtError(null)
    try {
      const res = await fetch(`/api/trainer-notities/${trainerId}/${notitieId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Verwijderen mislukt')
    } catch {
      setBerichten(previous)
      setBerichtError('Bericht verwijderen mislukt - probeer opnieuw')
    }
  }

  const counts = {
    red: leden.filter(l => getLidStoplight(l) === 'red').length,
    amber: leden.filter(l => getLidStoplight(l) === 'amber').length,
    green: leden.filter(l => getLidStoplight(l) === 'green').length,
  }

  const ledenByStoplight = (sig: 'red' | 'amber' | 'green') => leden.filter(l => getLidStoplight(l) === sig)
  const dashboardActies = [
    ...acties.filter(a => !a.afgerond && a.bron === 'management')
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')),
    ...acties.filter(a => !a.afgerond && a.bron !== 'management' && isActieOpen(a.deadline, a.bron, a.afgerond))
      .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')),
  ]
  const dashboardCritical = dashboardActies.some(a => getActieUrgency(a.deadline, a.bron) === 'rood')
  const dashboardUrgency = dashboardCritical
    ? 'rood'
    : dashboardActies.some(a => getActieUrgency(a.deadline, a.bron) === 'oranje')
      ? 'oranje'
      : 'groen'

  if (loading) return (
    <>
      <Navigation />
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Laden…</div>
    </>
  )

  return (
    <>
      <Navigation />

      {showAddLid && (
        <AddLidModal
          trainerId={trainerId as string}
          onClose={() => setShowAddLid(false)}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}

      {replyTarget && (
        <ReplyModal
          trainerId={trainerId as string}
          onClose={() => setReplyTarget(null)}
          onSent={(bericht) => {
            setBerichten(prev => [...prev, bericht])
            setDeletedIds(prev => new Set([...prev, replyTarget.id]))
          }}
        />
      )}

      <div style={{ width: '90%', minHeight: '100vh', background: 'var(--bg-base)', padding: '32px var(--app-shell-padding) 48px', maxWidth: 'var(--app-shell-max)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{trainer?.naam ?? 'Trainer'}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{greeting()} · {todayLabel()}</div>
        </div>

        {!loading && (
          <MomentumStrip
            gesprekken={momentum.gesprekken}
            actiesAfgerond={momentum.actiesAfgerond}
          />
        )}

        <section ref={stoplichtRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{leden.length} actieve leden</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {(['red', 'amber', 'green'] as const).map(sig => {
              const isOpen = openStoplight === sig
              const members = ledenByStoplight(sig)
              const col = STOPLIGHT[sig]
              return (
                <div key={sig} style={{ position: 'relative' }}>
                  <button
                    onClick={() => members.length > 0 && setOpenStoplight(isOpen ? null : sig)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '14px 18px',
                      minHeight: 76,
                      background: isOpen ? col.bg : 'none',
                      border: `1px solid ${isOpen ? col.border : 'var(--border-subtle)'}`,
                      borderRadius: 8,
                      cursor: members.length > 0 ? 'pointer' : 'default',
                      touchAction: 'manipulation',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 20, fontWeight: 800, color: col.text }}>{counts[sig]}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                      {STOPLIGHT_LABELS[sig]}
                      {members.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </button>
                  {isOpen && members.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      minWidth: 220,
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                    }}>
                      {members.map(lid => (
                        <div
                          key={lid.id}
                          onClick={() => { setOpenStoplight(null); router.push(`/leden/${lid.id}`) }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            minHeight: 44,
                            cursor: 'pointer',
                            touchAction: 'manipulation',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                            {lid.voornaam} {lid.achternaam}
                          </span>
                          <span style={{ color: col.text, fontSize: 12 }}>{lid.lid_id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div style={{ position: 'relative' }} ref={gesprekRef}>
            <button style={{ ...primaryButtonStyle, width: '100%', minHeight: 76, textAlign: 'center' }} onClick={() => setGesprekOpen(o => !o)}>
              Nieuw gesprek
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>Start een cyclus</div>
            </button>
            {gesprekOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 20, minWidth: 260, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                {ledenDropdown.length === 0
                  ? <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Geen leden gevonden</div>
                  : ledenDropdown.map(lid => (
                    <div key={lid.id} style={{ padding: '12px 14px', minHeight: 44, cursor: 'pointer', touchAction: 'manipulation', borderBottom: '1px solid var(--border-subtle)' }} onClick={() => handleGesprekSelect(lid)}>
                      <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{lid.voornaam} {lid.achternaam}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{lid.lid_id}</div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <button style={{ ...secondaryButtonStyle, minHeight: 76, textAlign: 'center' }} onClick={() => router.push(`/trainer/${trainerId}/acties`)}>
            Open acties
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>
              {dashboardActies.length === 0 ? 'Alles afgerond' : `${dashboardActies.length} open · ${URGENCY_LABEL[dashboardUrgency]}`}
            </div>
            {dashboardActies.length > 0 && (
              <span style={{ display: 'inline-flex', gap: 4, marginTop: 6 }}>
                {dashboardActies.slice(0, 5).map(actie => {
                  const urgency = getActieUrgency(actie.deadline, actie.bron)
                  const kleur = urgency === 'toekomstig' ? 'groen' : urgency
                  return <span key={actie.id} style={{ width: 6, height: 6, borderRadius: '50%', background: URGENCY_COLOR[kleur] }} />
                })}
              </span>
            )}
          </button>
          <button style={{ ...secondaryButtonStyle, minHeight: 76, textAlign: 'center' }} onClick={() => router.push(`/trainer/${trainerId}/leden`)}>
            Mijn leden
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>{leden.length} actief</div>
          </button>
          <button style={{ ...secondaryButtonStyle, minHeight: 76, textAlign: 'center' }} onClick={() => setShowAddLid(true)}>
            Nieuw lid
            <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>Lid toevoegen</div>
          </button>
        </section>

        {!meldingenLoading && meldingen.length > 0 && (
          <section style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Urgente meldingen</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{meldingen.length}</div>
            </div>
            {meldingen.map(melding => (
              <div key={melding.id} style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>{melding.lid_naam}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{melding.tekst}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>{melding.auteur_naam} · {new Date(melding.aangemaakt_op).toLocaleDateString('nl-NL')}</div>
                </div>
                <button style={secondaryButtonStyle} onClick={() => markGezien(melding.id, melding.lid_id)}>✓ Gezien</button>
              </div>
            ))}
          </section>
        )}

        <section style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Berichten</div>
            {berichten.filter(b => !deletedIds.has(b.id)).length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {berichten.filter(b => !deletedIds.has(b.id)).length}
              </div>
            )}
          </div>
          {berichtError && <div style={{ color: 'var(--red-text)', fontSize: 13, padding: '12px 24px' }}>{berichtError}</div>}
          {berichtenLoading ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Laden…</div>
          ) : berichten.filter(b => !deletedIds.has(b.id)).length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Geen berichten.</div>
          ) : (
            <div>
              {berichten.filter(b => !deletedIds.has(b.id)).slice(0, berichtenMax).map(bericht => {
                const isManagement = bericht.auteur_type !== 'trainer'
                const date = new Date(bericht.aangemaakt_op)
                const dateLabel = `${date.getDate()} ${DUTCH_MONTHS[date.getMonth()]}`
                return (
                  <div
                    key={bericht.id}
                    style={{
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      gap: 12,
                      background: isManagement ? 'rgba(99,102,241,0.04)' : 'transparent',
                    }}
                  >
                    {isManagement && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)', marginTop: 6, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{bericht.tekst}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
                        {isManagement ? 'Management' : 'Jij'} · {dateLabel}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      {isManagement ? (
                        <button
                          style={{ ...primaryButtonStyle, minHeight: 36, padding: '6px 10px', fontSize: 12 }}
                          onClick={() => setReplyTarget(bericht)}
                        >
                          Beantwoorden
                        </button>
                      ) : (
                        <button
                          style={{ ...secondaryButtonStyle, minHeight: 36, padding: '6px 10px', fontSize: 12, color: 'var(--red-text)', borderColor: 'rgba(220,38,38,0.2)' }}
                          onClick={() => deleteBericht(bericht.id)}
                        >
                          Verwijder
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {berichten.filter(b => !deletedIds.has(b.id)).length > berichtenMax && (
                <button style={{ ...secondaryButtonStyle, margin: 16 }} onClick={() => setBerichtenMax(n => n + 10)}>Toon meer</button>
              )}
            </div>
          )}
          <div style={{ padding: 24, borderTop: '1px solid var(--border-subtle)' }}>
            <textarea
              value={berichtTekst}
              onChange={e => setBerichtTekst(e.target.value)}
              placeholder="Schrijf een bericht aan management…"
              maxLength={1000}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            {berichtTekst.length >= 800 && (
              <div style={{ textAlign: 'right', color: berichtTekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                {berichtTekst.length}/1000
              </div>
            )}
            <button
              onClick={postBericht}
              disabled={berichtPosting || !berichtTekst.trim()}
              style={{ ...secondaryButtonStyle, marginTop: 10, opacity: berichtPosting || !berichtTekst.trim() ? 0.4 : 1 }}
            >
              {berichtPosting ? '…' : 'Versturen'}
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
