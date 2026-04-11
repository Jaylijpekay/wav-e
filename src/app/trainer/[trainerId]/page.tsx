'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Actie = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
  omschrijving: string
  aangemaakt: string
}

type Lid = {
  id: string
  lid_id: string
  voornaam: string
  achternaam: string
}

type Trainer = {
  id: string
  naam: string
}

const daysSince = (date: string | null): number | null => {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

export default function TrainerDashboard() {
  const { trainerId } = useParams()
  const router = useRouter()

  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [acties, setActies] = useState<Actie[]>([])
  const [leden, setLeden] = useState<Lid[]>([])
  const [loading, setLoading] = useState(true)
  const [gesprekOpen, setGesprekOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()

      const { data: trainerData } = await supabase
        .from('trainers')
        .select('id, naam')
        .eq('id', trainerId)
        .single()

      setTrainer(trainerData)

      const { data: ledenData } = await supabase
        .from('leden')
        .select('id, lid_id, voornaam, achternaam')
        .eq('trainer_id', trainerId)
        .eq('actief', true)
        .order('voornaam')

      setLeden(ledenData ?? [])

      if (ledenData && ledenData.length > 0) {
        const lidIds = ledenData.map(l => l.id)

        const { data: actiesData } = await supabase
          .from('acties')
          .select('id, lid_id, omschrijving, aangemaakt')
          .in('lid_id', lidIds)
          .eq('status', 'open')
          .order('aangemaakt', { ascending: true })

        const enriched: Actie[] = (actiesData ?? []).map(a => {
          const lid = ledenData.find(l => l.id === a.lid_id)
          return {
            id: a.id,
            lid_id: lid?.lid_id ?? '—',
            voornaam: lid?.voornaam ?? '—',
            achternaam: lid?.achternaam ?? '',
            omschrijving: a.omschrijving,
            aangemaakt: a.aangemaakt,
          }
        })

        setActies(enriched)
      }

      setLoading(false)
    }

    if (trainerId) load()
  }, [trainerId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setGesprekOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleGesprekSelect = (lid: Lid) => {
    setGesprekOpen(false)
    router.push(`/gesprek/new?lid_id=${lid.id}`)
  }

  return (
    <main style={s.main}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.wordmark} onClick={() => router.push('/')}>WAV-E</span>
          <div style={s.headerRight}>
            <span style={s.trainerName}>{trainer?.naam ?? '—'}</span>
            <button
              style={s.btnSecondary}
              onClick={() => router.push(`/trainer/${trainerId}/leden`)}
            >
              Mijn leden
            </button>

            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                style={s.btnPrimary}
                onClick={() => setGesprekOpen(o => !o)}
              >
                + Nieuw gesprek
              </button>
              {gesprekOpen && (
                <div style={s.dropdown}>
                  {leden.length === 0 ? (
                    <div style={s.dropdownEmpty}>Geen leden gevonden</div>
                  ) : leden.map(lid => (
                    <div
                      key={lid.id}
                      style={s.dropdownItem}
                      onClick={() => handleGesprekSelect(lid)}
                    >
                      <span style={s.dropdownName}>{lid.voornaam} {lid.achternaam}</span>
                      <span style={s.dropdownMeta}>{lid.lid_id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div style={s.body}>

        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Open acties</span>
          <span style={s.sectionCount}>{acties.length}</span>
        </div>

        {loading ? (
          <div style={s.empty}>Laden...</div>
        ) : acties.length === 0 ? (
          <div style={s.empty}>Geen open acties.</div>
        ) : (
          <div style={s.list}>
            {acties.map(actie => {
              const dagen = daysSince(actie.aangemaakt)
              const isOud = dagen !== null && dagen > 7

              return (
                <div
                  key={actie.id}
                  style={{
                    ...s.row,
                    borderLeft: `3px solid ${isOud ? '#dc2626' : '#2a2a2a'}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => router.push(`/leden/${actie.lid_id}`)}
                >
                  <div style={s.rowMain}>
                    <div style={s.rowName}>
                      {actie.voornaam} {actie.achternaam}
                    </div>
                    <div style={s.rowMeta}>{actie.lid_id}</div>
                  </div>

                  <div style={s.rowActie}>
                    {actie.omschrijving}
                  </div>

                  <div style={{
                    ...s.rowDagen,
                    color: isOud ? '#dc2626' : '#444',
                  }}>
                    {dagen === null ? '—' : `${dagen}d`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#e8e6e0',
    fontFamily: '"DM Mono", "Courier New", monospace',
  },
  header: {
    borderBottom: '1px solid #1a1a1a',
    padding: '0 32px',
    height: 56,
    display: 'flex',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    background: '#0a0a0a',
    zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1100,
    width: '100%',
    margin: '0 auto',
  },
  wordmark: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.2em',
    color: '#fff',
    cursor: 'pointer',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  trainerName: {
    fontSize: 12,
    color: '#444',
    letterSpacing: '0.05em',
    marginRight: 8,
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid #2a2a2a',
    color: '#888',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    letterSpacing: '0.05em',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#fff',
    border: '1px solid #fff',
    color: '#0a0a0a',
    fontFamily: '"DM Mono", "Courier New", monospace',
    fontSize: 12,
    letterSpacing: '0.05em',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    fontWeight: 600,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    minWidth: 240,
    zIndex: 50,
    overflow: 'hidden',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #1a1a1a',
    transition: 'background 0.1s',
  },
  dropdownName: {
    fontSize: 13,
    color: '#e8e6e0',
  },
  dropdownMeta: {
    fontSize: 11,
    color: '#444',
  },
  dropdownEmpty: {
    padding: '16px',
    fontSize: 12,
    color: '#444',
    textAlign: 'center' as const,
  },
  body: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '40px 32px 120px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    color: '#444',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  },
  sectionCount: {
    fontSize: 11,
    color: '#333',
    letterSpacing: '0.05em',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
    padding: '18px 20px',
    background: '#0f0f0f',
    borderRadius: 6,
    transition: 'background 0.15s',
  },
  rowMain: {
    minWidth: 200,
    flex: '0 0 200px',
  },
  rowName: {
    fontSize: 14,
    color: '#e8e6e0',
    marginBottom: 4,
  },
  rowMeta: {
    fontSize: 12,
    color: '#444',
    letterSpacing: '0.03em',
  },
  rowActie: {
    flex: 1,
    fontSize: 13,
    color: '#888',
    letterSpacing: '0.02em',
  },
  rowDagen: {
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    flex: '0 0 40px',
    textAlign: 'right' as const,
  },
  empty: {
    color: '#333',
    fontSize: 14,
    padding: '60px 0',
    textAlign: 'center' as const,
  },
}
