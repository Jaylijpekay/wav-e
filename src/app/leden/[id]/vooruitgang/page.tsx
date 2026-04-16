'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

type Evaluatie = {
  id: string
  cyclus: number
  datum: string
  slaap: number | null
  energie: number | null
  stress: number | null
  voeding: number | null
  beweging: number | null
  motivatie: number | null
  tevredenheid: number | null
  gewicht_kg: number | null
  vetpercentage: number | null
  spiermassa_kg: number | null
  visceraal_vet: number | null
  buikomvang_cm: number | null
  doelen_behaald: boolean | null
}

type Lid = {
  voornaam: string
  achternaam: string
  lid_id: string
}

// ── Config ─────────────────────────────────────────────────────────────

const METRICS = [
  { key: 'slaap',    label: 'Slaap',    icon: '🌙', inv: false, color: '#4a90d9', tip: (v: number) => v >= 7 ? 'Goed hersteld ✓'       : v >= 6 ? 'Bijna op niveau'  : 'Slaaptekort — aandacht!' },
  { key: 'energie',  label: 'Energie',  icon: '⚡', inv: false, color: '#d4a017', tip: (v: number) => v >= 7 ? 'Vol energie ✓'          : v >= 6 ? 'Redelijk'          : 'Energieniveau laag'      },
  { key: 'stress',   label: 'Stress',   icon: '🧠', inv: true,  color: '#d94040', tip: (v: number) => v <= 5 ? 'Lekker ontspannen ✓'    : v <= 7 ? 'Beheersbaar'       : 'Hoge stressbelasting!'   },
  { key: 'voeding',  label: 'Voeding',  icon: '🥗', inv: false, color: '#52a84a', tip: (v: number) => v >= 7 ? 'Voeding op orde ✓'      : v >= 6 ? 'Goed bezig'        : 'Ruimte voor verbetering' },
  { key: 'beweging', label: 'Beweging', icon: '🏃', inv: false, color: '#1ab3a0', tip: (v: number) => v >= 7 ? 'Actief bezig ✓'         : v >= 6 ? 'Goed'              : 'Meer beweging gewenst'   },
  { key: 'motivatie',label: 'Motivatie',icon: '🎯', inv: false, color: '#9b6fd4', tip: (v: number) => v >= 8 ? 'Hoog gemotiveerd ✓'     : v >= 6 ? 'Betrokken'         : 'Motivatie aandacht'      },
] as const

type MetricKey = typeof METRICS[number]['key']

const FYSIEK = [
  { key: 'gewicht_kg',    label: 'Gewicht',       unit: 'kg', lowerIsBetter: false },
  { key: 'vetpercentage', label: 'Vetpercentage',  unit: '%',  lowerIsBetter: true  },
  { key: 'spiermassa_kg', label: 'Spiermassa',    unit: 'kg', lowerIsBetter: false },
  { key: 'visceraal_vet', label: 'Visceraal vet', unit: '',   lowerIsBetter: true  },
  { key: 'buikomvang_cm', label: 'Buikomvang',    unit: 'cm', lowerIsBetter: true  },
]

// ── Helpers ────────────────────────────────────────────────────────────

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function sigCol(inv: boolean, val: number) {
  const bad  = inv ? val > 7 : val < 6
  const warn = inv ? val > 5 : val < 7
  if (bad)  return { fill: '#fdeaea', stroke: '#e06060', text: '#8a2020' }
  if (warn) return { fill: '#fff3d6', stroke: '#e0a800', text: '#7a5200' }
  return       { fill: '#eef6d6', stroke: '#88c000', text: '#3a5e00' }
}

function overallTrend(evals: Evaluatie[]) {
  if (evals.length < 2) return null
  const first = evals[0], last = evals[evals.length - 1]
  let pos = 0, neg = 0
  METRICS.forEach(m => {
    const f = first[m.key as keyof Evaluatie] as number | null
    const l = last[m.key as keyof Evaluatie] as number | null
    if (f === null || l === null) return
    const diff = m.inv ? f - l : l - f
    if (diff > 0) pos++; else if (diff < 0) neg++
  })
  if (pos >= neg + 2) return { label: '↑ Positieve trend', color: '#3a6e00' }
  if (neg >= pos + 2) return { label: '↓ Aandacht nodig',  color: '#a03030' }
  return { label: '→ Stabiel verloop', color: '#888' }
}

// ── Ring component ─────────────────────────────────────────────────────

function Ring({
  metric, val, onClick, active,
}: {
  metric: typeof METRICS[number]
  val: number | null
  onClick: () => void
  active: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const arcRef  = useRef<SVGCircleElement>(null)
  const fillRef = useRef<SVGCircleElement>(null)
  const textRef = useRef<SVGTextElement>(null)
  const prevVal = useRef<number | null>(null)

  const r = 22, cx = 28, cy = 28
  const circ = +(2 * Math.PI * r).toFixed(1)
  const toOffset = (v: number | null) =>
    v !== null ? circ * (1 - (metric.inv ? (10 - v) / 10 : v / 10)) : circ

  useEffect(() => {
    const arc  = arcRef.current
    const text = textRef.current
    if (!arc || !text) return
    const from = toOffset(prevVal.current)
    const to   = toOffset(val)
    const col  = val !== null ? sigCol(metric.inv, val) : { fill: '#f5f5f5', stroke: '#ddd', text: '#aaa' }
    arc.setAttribute('stroke', col.stroke)
    if (fillRef.current) fillRef.current.setAttribute('fill', col.fill)
    const duration = 420
    const start    = performance.now()
    const animate  = (now: number) => {
      const t    = Math.min((now - start) / duration, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      arc.setAttribute('stroke-dashoffset', String(+(from + (to - from) * ease).toFixed(2)))
      if (t >= 0.5 && text.textContent !== String(val ?? '\u2014')) {
        text.textContent = String(val ?? '\u2014')
        text.setAttribute('fill', col.text)
      }
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
    prevVal.current = val
  }, [val]) // eslint-disable-line react-hooks/exhaustive-deps

  const col = val !== null ? sigCol(metric.inv, val) : { fill: '#f5f5f5', stroke: '#ddd', text: '#aaa' }
  const initialOffset = toOffset(val)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative' }}
    >
      <div style={{
        fontSize: 15, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: hovered ? 'scale(1.35) rotate(-8deg)' : 'scale(1)',
        transition: 'transform 0.2s ease',
      }}>
        {metric.icon}
      </div>
      <svg
        width="58" height="58" viewBox="0 0 56 56"
        style={{
          display: 'block',
          transform: hovered ? 'scale(1.08)' : active ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}
      >
        <circle ref={fillRef} cx={cx} cy={cy} r={r} fill={col.fill} stroke="#efefef" strokeWidth="5" />
        <circle
          ref={arcRef}
          cx={cx} cy={cy} r={r} fill="none"
          stroke={col.stroke} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={initialOffset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '28px 28px' }}
        />
        <text
          ref={textRef}
          x={cx} y={cy + 5} textAnchor="middle"
          fontSize={13} fontWeight="500" fill={col.text}
          fontFamily="Raleway, system-ui, sans-serif"
        >
          {val !== null ? val : '\u2014'}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: '#888', textAlign: 'center' }}>{metric.label}</div>
      {hovered && val !== null && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#fff', fontSize: 11,
          padding: '6px 11px', borderRadius: 8, whiteSpace: 'nowrap',
          zIndex: 30, pointerEvents: 'none', lineHeight: 1.5, textAlign: 'center',
        }}>
          <strong style={{ fontSize: 13 }}>{val}/10</strong><br />
          {metric.tip(val)}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            border: '5px solid transparent', borderTopColor: '#1a1a1a',
          }} />
        </div>
      )}
    </div>
  )
}

// ── Metric line chart ──────────────────────────────────────────────────

function MetricChart({
  metric, evals, selectedIdx, onSelect,
}: {
  metric: typeof METRICS[number]
  evals: Evaluatie[]
  selectedIdx: number
  onSelect: (i: number) => void
}) {
  const W = 460, H = 56
  const padL = 6, padR = 6, padT = 10, padB = 18
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n = evals.length
  const xStep = n > 1 ? chartW / (n - 1) : 0
  const yScale = (v: number) => padT + chartH - ((v - 1) / 9) * chartH
  const xPos = (i: number) => padL + i * xStep

  const vals = evals.map(e => e[metric.key as keyof Evaluatie] as number | null)
  const latestVal = vals[selectedIdx]
  const col = latestVal !== null ? sigCol(metric.inv, latestVal) : { fill: '#f5f5f5', stroke: '#ccc', text: '#aaa' }

  // delta first → last
  const firstVal = vals.find(v => v !== null) ?? null
  const lastVal  = [...vals].reverse().find(v => v !== null) ?? null
  let deltaEl: React.ReactNode = null
  if (firstVal !== null && lastVal !== null && firstVal !== lastVal) {
    const diff = lastVal - firstVal
    const improved = metric.inv ? diff < 0 : diff > 0
    const sign = diff > 0 ? '+' : '−'
    deltaEl = (
      <span style={{ fontSize: 12, fontWeight: 500, color: improved ? '#3a6e00' : '#a03030', minWidth: 32, textAlign: 'right' }}>
        {sign}{Math.abs(diff)}
      </span>
    )
  } else {
    deltaEl = <span style={{ fontSize: 12, color: '#ccc', minWidth: 32, textAlign: 'right' }}>±0</span>
  }

  // SVG paths
  const pts = evals.map((e, i) => {
    const v = e[metric.key as keyof Evaluatie] as number | null
    return v !== null ? { x: xPos(i), y: yScale(v), v } : null
  })

  const validPts = pts.filter(Boolean) as { x: number; y: number; v: number }[]
  const path = validPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillPath = validPts.length > 1
    ? `${path} L${validPts[validPts.length - 1].x.toFixed(1)},${(H - padB).toFixed(1)} L${validPts[0].x.toFixed(1)},${(H - padB).toFixed(1)} Z`
    : ''

  // target zone
  const yZoneTop = yScale(metric.inv ? 6 : 7)
  const yZoneBot = yScale(metric.inv ? 8 : 6)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* icon + label */}
      <div style={{ width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 15 }}>{metric.icon}</span>
        <span style={{ fontSize: 10, color: '#999', textAlign: 'center', lineHeight: 1.2 }}>{metric.label}</span>
      </div>

      {/* chart */}
      <div style={{ flex: 1, position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
          {/* hairline gridlines */}
          {[3, 5, 7, 9].map(v => (
            <line key={v}
              x1={padL} y1={yScale(v).toFixed(1)}
              x2={W - padR} y2={yScale(v).toFixed(1)}
              stroke="#e8e8e8" strokeWidth="0.3"
            />
          ))}

          {/* target zone */}
          <rect
            x={padL} y={yZoneTop.toFixed(1)}
            width={chartW} height={(yZoneBot - yZoneTop).toFixed(1)}
            fill="rgba(122,173,0,0.06)"
          />

          {/* selected vertical */}
          <line
            x1={xPos(selectedIdx).toFixed(1)} y1={padT}
            x2={xPos(selectedIdx).toFixed(1)} y2={H - padB}
            stroke="rgba(122,173,0,0.3)" strokeWidth="1" strokeDasharray="3,3"
          />

          {/* fill under line */}
          {fillPath && (
            <path d={fillPath} fill={metric.color} opacity="0.06" />
          )}

          {/* line */}
          {validPts.length >= 2 && (
            <path d={path} fill="none" stroke={metric.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* dots */}
          {pts.map((p, i) => {
            if (!p) return null
            const isSel = i === selectedIdx
            return (
              <circle
                key={i}
                cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                r={isSel ? 5 : 3}
                fill={isSel ? metric.color : '#fff'}
                stroke={metric.color} strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(i)}
              >
                <title>C{evals[i].cyclus}: {p.v}/10</title>
              </circle>
            )
          })}

          {/* x labels */}
          {evals.map((e, i) => (
            <text
              key={e.id}
              x={xPos(i).toFixed(1)} y={H - 2}
              textAnchor="middle" fontSize="10"
              fill={i === selectedIdx ? '#7aad00' : '#ccc'}
              fontWeight={i === selectedIdx ? '600' : '400'}
              fontFamily="Raleway, system-ui, sans-serif"
            >
              C{e.cyclus}
            </text>
          ))}
        </svg>
      </div>

      {deltaEl}
    </div>
  )
}

// ── Fysiek table ───────────────────────────────────────────────────────

function FysiekTable({ evals }: { evals: Evaluatie[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
            <th style={{ padding: '8px 12px 8px 0', textAlign: 'left', color: '#999', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Meting</th>
            {evals.map(ev => (
              <th key={ev.id} style={{ padding: '8px 10px', textAlign: 'center', color: '#999', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>C{ev.cyclus}</th>
            ))}
            <th style={{ padding: '8px 0 8px 10px', textAlign: 'right', color: '#999', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {FYSIEK.map(({ key, label, unit, lowerIsBetter }) => {
            const values = evals.map(e => e[key as keyof Evaluatie] as number | null)
            const firstVal = values.find(v => v !== null) ?? null
            const lastVal  = [...values].reverse().find(v => v !== null) ?? null
            const diff = firstVal !== null && lastVal !== null ? lastVal - firstVal : null
            const improved = diff !== null ? (lowerIsBetter ? diff < 0 : diff > 0) : null

            return (
              <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px 10px 0', color: '#444', fontWeight: 500 }}>{label}</td>
                {evals.map(ev => {
                  const val = ev[key as keyof Evaluatie] as number | null
                  return (
                    <td key={ev.id} style={{ padding: '10px', textAlign: 'center', color: val !== null ? '#1a1a1a' : '#ccc' }}>
                      {val !== null ? <>{val}{unit && <span style={{ fontSize: 10, color: '#aaa', marginLeft: 2 }}>{unit}</span>}</> : '—'}
                    </td>
                  )
                })}
                <td style={{ padding: '10px 0 10px 10px', textAlign: 'right' }}>
                  {diff !== null && diff !== 0 ? (
                    <span style={{ fontWeight: 600, color: improved ? '#3a6e00' : '#a03030' }}>
                      {diff > 0 ? '+' : '−'}{Math.abs(+diff.toFixed(1))}{unit && <span style={{ fontSize: 10, marginLeft: 1 }}>{unit}</span>}
                    </span>
                  ) : <span style={{ color: '#ccc' }}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────

export default function VooruitgangPage() {
  const { id } = useParams()
  const router = useRouter()

  const [evals, setEvals]   = useState<Evaluatie[]>([])
  const [lid, setLid]       = useState<Lid | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tab, setTab] = useState<'leefstijl' | 'fysiek'>('leefstijl')

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      const { data: lidData } = await supabase
        .from('leden').select('voornaam, achternaam, lid_id').eq('id', id).single()
      setLid(lidData)
      const { data: evalData } = await supabase
        .from('evaluaties')
        .select('id, cyclus, datum, slaap, energie, stress, voeding, beweging, motivatie, tevredenheid, gewicht_kg, vetpercentage, spiermassa_kg, visceraal_vet, buikomvang_cm, doelen_behaald')
        .eq('lid_id', id)
        .order('cyclus', { ascending: true })
      const data = evalData ?? []
      setEvals(data)
      setSelectedIdx(data.length - 1)
      setLoading(false)
    }
    if (id) load()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8faf3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#A8C800' }} />
    </div>
  )

  if (!lid) return (
    <div style={{ minHeight: '100vh', background: '#f8faf3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontFamily: 'Raleway, sans-serif', fontSize: '0.8rem' }}>
      Lid niet gevonden.
    </div>
  )

  if (evals.length === 0) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: '#f8faf3', color: '#aaa', fontFamily: 'Raleway, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Geen evaluaties gevonden</span>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#A8C800', fontFamily: 'Raleway, sans-serif', fontSize: '0.72rem', cursor: 'pointer' }}>
          ← Terug naar {lid.voornaam}
        </button>
      </div>
    </>
  )

  const selectedEval = evals[selectedIdx]
  const trend = overallTrend(evals)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { background: #f4f7ec; }
        .vg-root { min-height: 100vh; background: #f4f7ec; font-family: Raleway, system-ui, sans-serif; padding-bottom: 60px; }
        .vg-header { background: #fff; border-bottom: 1px solid #e5ecd0; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 56px; position: sticky; top: 0; z-index: 100; }
        .vg-logo { font-size: 15px; font-weight: 700; color: #4a6e00; letter-spacing: -0.02em; }
        .vg-logo span { color: #92b800; }
        .vg-back { background: none; border: none; color: #999; font-family: Raleway, sans-serif; font-size: 0.72rem; cursor: pointer; letter-spacing: 0.06em; }
        .vg-back:hover { color: #7aad00; }
        .vg-card { background: #fff; border: 1px solid #e5ecd0; border-radius: 16px; overflow: hidden; max-width: 680px; margin: 28px auto 0; }
        .vg-card-head { background: #f4f7ec; padding: 20px 24px 16px; border-bottom: 1px solid #e5ecd0; display: flex; justify-content: space-between; align-items: flex-start; }
        .vg-member-name { font-size: 22px; font-weight: 600; color: #1a1a1a; margin: 0 0 4px; letter-spacing: -0.02em; }
        .vg-member-meta { font-size: 12px; color: #999; }
        .vg-cycles-strip { display: flex; gap: 6px; padding: 12px 24px; border-bottom: 1px solid #f0f0f0; overflow-x: auto; flex-wrap: wrap; }
        .vg-cyc-btn { padding: 4px 14px; border-radius: 20px; border: 1.5px solid #dde0d8; background: #fafafa; color: #888; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: Raleway, sans-serif; white-space: nowrap; }
        .vg-cyc-btn:hover { border-color: #92b800; color: #4a6e00; background: #f4f7ec; }
        .vg-cyc-btn.active { border-color: #7aad00; background: #eef5d0; color: #3a5e00; }
        .vg-rings { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; padding: 20px 24px; border-bottom: 1px solid #f0f0f0; }
        .vg-tabs { display: flex; gap: 4px; padding: 14px 24px 0; }
        .vg-tab { padding: 6px 16px; border-radius: 8px 8px 0 0; border: 1px solid transparent; background: transparent; color: #aaa; font-family: Raleway, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; transition: all 0.15s; border-bottom: none; }
        .vg-tab.active { background: #f8faf3; border-color: #e5ecd0; color: #4a6e00; }
        .vg-tab-body { padding: 20px 24px 24px; background: #f8faf3; border-top: 1px solid #e5ecd0; display: flex; flex-direction: column; gap: 12px; }
        .vg-footer-strip { padding: 12px 24px; background: #f4f7ec; border-top: 1px solid #e5ecd0; display: flex; justify-content: space-between; align-items: center; }
      `}</style>

      <div className="vg-root">
        {/* Header */}
        <div className="vg-header">
          <div className="vg-logo">wav<span>-e</span> studios</div>
          <button className="vg-back" onClick={() => router.back()}>← terug</button>
        </div>

        <div className="vg-card">
          {/* Name + cycle info */}
          <div className="vg-card-head">
            <div>
              <div className="vg-member-name">{lid.voornaam} {lid.achternaam}</div>
              <div className="vg-member-meta">{lid.lid_id} · {evals.length} cyclus{evals.length !== 1 ? 'sen' : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Cyclus {selectedEval.cyclus}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{formatDate(selectedEval.datum)}</div>
            </div>
          </div>

          {/* Cycle selector */}
          <div className="vg-cycles-strip">
            {evals.map((e, i) => (
              <button
                key={e.id}
                className={`vg-cyc-btn${i === selectedIdx ? ' active' : ''}`}
                onClick={() => setSelectedIdx(i)}
              >
                C{e.cyclus} · {formatDate(e.datum)}
              </button>
            ))}
          </div>

          {/* Rings — all 6 leefstijl metrics */}
          <div className="vg-rings">
            {METRICS.map(m => (
              <Ring
                key={m.key}
                metric={m}
                val={selectedEval[m.key as keyof Evaluatie] as number | null}
                onClick={() => {}}
                active={false}
              />
            ))}
          </div>

          {/* Tabs */}
          <div className="vg-tabs">
            {(['leefstijl', 'fysiek'] as const).map(t => (
              <button
                key={t}
                className={`vg-tab${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'leefstijl' ? 'Leefstijl' : 'Fysiek'}
              </button>
            ))}
          </div>

          {/* Tab body */}
          <div className="vg-tab-body">
            {tab === 'leefstijl' && METRICS.map(m => (
              <MetricChart
                key={m.key}
                metric={m}
                evals={evals}
                selectedIdx={selectedIdx}
                onSelect={setSelectedIdx}
              />
            ))}
            {tab === 'fysiek' && <FysiekTable evals={evals} />}
          </div>

          {/* Footer */}
          <div className="vg-footer-strip">
            {trend && (
              <span style={{ fontSize: 12, fontWeight: 500, color: trend.color }}>{trend.label}</span>
            )}
            <span style={{ fontSize: 11, color: '#bbb' }}>
              {evals[0] ? formatDate(evals[0].datum) : ''} – {formatDate(selectedEval.datum)}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
