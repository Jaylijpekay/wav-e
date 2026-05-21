'use client'

/*
 * Vooruitgang
 *
 * Wat doet deze pagina:
 * Deze pagina toont de ontwikkeling van een lid over meerdere evaluatiecycli. Trainers en management kunnen leefstijl- en fysieke metingen over tijd vergelijken.
 *
 * Data:
 * Leest uit: leden, evaluaties.
 *
 * Toegang:
 * management / trainer
 *
 * Gerelateerde API routes:
 * Geen.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
  { key: 'slaap',    label: 'Slaap',    icon: '🌙', inv: false, color: 'var(--metric-blue)', tip: (v: number) => v >= 7 ? 'Goed hersteld ✓'       : v >= 6 ? 'Bijna op niveau'  : 'Slaaptekort — aandacht!' },
  { key: 'energie',  label: 'Energie',  icon: '⚡', inv: false, color: 'var(--metric-gold)', tip: (v: number) => v >= 7 ? 'Vol energie ✓'          : v >= 6 ? 'Redelijk'          : 'Energieniveau laag'      },
  { key: 'stress',   label: 'Stress',   icon: '🧠', inv: true,  color: 'var(--metric-red)', tip: (v: number) => v <= 5 ? 'Lekker ontspannen ✓'    : v <= 7 ? 'Beheersbaar'       : 'Hoge stressbelasting!'   },
  { key: 'voeding',  label: 'Voeding',  icon: '🥗', inv: false, color: 'var(--metric-green)', tip: (v: number) => v >= 7 ? 'Voeding op orde ✓'      : v >= 6 ? 'Goed bezig'        : 'Ruimte voor verbetering' },
  { key: 'beweging', label: 'Beweging', icon: '🏃', inv: false, color: 'var(--metric-teal)', tip: (v: number) => v >= 7 ? 'Actief bezig ✓'         : v >= 6 ? 'Goed'              : 'Meer beweging gewenst'   },
  { key: 'motivatie',label: 'Motivatie',icon: '🎯', inv: false, color: 'var(--metric-purple)', tip: (v: number) => v >= 8 ? 'Hoog gemotiveerd ✓'     : v >= 6 ? 'Betrokken'         : 'Motivatie aandacht'      },
] as const

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
  if (bad)  return { fill: 'var(--health-red-fill)', stroke: 'var(--health-red-line)', text: 'var(--health-red-text)' }
  if (warn) return { fill: 'var(--health-amber-fill)', stroke: 'var(--health-amber-line)', text: 'var(--health-amber-text)' }
  return       { fill: 'var(--report-green-tint)', stroke: 'var(--health-green-line)', text: 'var(--health-green-text)' }
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
  const [pressed, setPressed] = useState(false)
  const arcRef  = useRef<SVGCircleElement>(null)
  const fillRef = useRef<SVGCircleElement>(null)
  const textRef = useRef<SVGTextElement>(null)
  const prevVal = useRef<number | null>(null)

  const r = 22, cx = 28, cy = 28
  const circ = +(2 * Math.PI * r).toFixed(1)
  const toOffset = useCallback(
    (v: number | null) =>
      v !== null ? circ * (1 - (metric.inv ? (10 - v) / 10 : v / 10)) : circ,
    [circ, metric.inv]
  )

  useEffect(() => {
    const arc  = arcRef.current
    const text = textRef.current
    if (!arc || !text) return
    const from = toOffset(prevVal.current)
    const to   = toOffset(val)
    const col  = val !== null ? sigCol(metric.inv, val) : { fill: 'var(--report-surface-soft)', stroke: 'var(--report-border-muted)', text: 'var(--report-text-soft)' }
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
  }, [metric.inv, toOffset, val])

  const col = val !== null ? sigCol(metric.inv, val) : { fill: 'var(--report-surface-soft)', stroke: 'var(--report-border-muted)', text: 'var(--report-text-soft)' }
  const initialOffset = toOffset(val)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setPressed(true)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => { setPressed(false); onClick() }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        position: 'relative',
        // Larger touch target
        padding: '6px 4px',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        fontSize: 15, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: pressed ? 'scale(1.35) rotate(-8deg)' : 'scale(1)',
        transition: 'transform 0.2s ease',
      }}>
        {metric.icon}
      </div>
      <svg
        width="58" height="58" viewBox="0 0 56 56"
        style={{
          display: 'block',
          transform: pressed ? 'scale(1.08)' : active ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 0.2s ease',
        }}
      >
        <circle ref={fillRef} cx={cx} cy={cy} r={r} fill={col.fill} stroke="var(--report-border-light)" strokeWidth="5" />
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
      <div style={{ fontSize: 11, color: 'var(--wave-gray)', textAlign: 'center' }}>{metric.label}</div>
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
  const W = 460, H = 100
  const padL = 6, padR = 6, padT = 10, padB = 22
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const n = evals.length
  const xStep = n > 1 ? chartW / (n - 1) : 0
  const yScale = (v: number) => padT + chartH - ((v - 1) / 9) * chartH
  const xPos = (i: number) => padL + i * xStep

  const vals = evals.map(e => e[metric.key as keyof Evaluatie] as number | null)
  const selectedVal = vals[selectedIdx] ?? null
  const lastVal     = [...vals].reverse().find(v => v !== null) ?? null
  let deltaEl: React.ReactNode = null
  if (selectedVal !== null && lastVal !== null && selectedIdx !== evals.length - 1) {
    const diff = lastVal - selectedVal
    const improved = metric.inv ? diff < 0 : diff > 0
    const sign = diff > 0 ? '+' : '−'
    deltaEl = (
      <span style={{ fontSize: 12, fontWeight: 500, color: improved ? 'var(--delta-positive)' : 'var(--delta-negative)', minWidth: 32, textAlign: 'right' }}
        title={`C${evals[selectedIdx].cyclus} → C${evals[evals.length-1].cyclus}`}>
        {sign}{Math.abs(diff)}
      </span>
    )
  } else if (selectedVal !== null && lastVal !== null) {
    deltaEl = <span style={{ fontSize: 12, color: 'var(--report-border-strong)', minWidth: 32, textAlign: 'right' }}>±0</span>
  } else {
    deltaEl = <span style={{ minWidth: 32 }} />
  }

  const pts = evals.map((e, i) => {
    const v = e[metric.key as keyof Evaluatie] as number | null
    return v !== null ? { x: xPos(i), y: yScale(v), v } : null
  })

  const validPts = pts.filter(Boolean) as { x: number; y: number; v: number }[]
  const path = validPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillPath = validPts.length > 1
    ? `${path} L${validPts[validPts.length - 1].x.toFixed(1)},${(H - padB).toFixed(1)} L${validPts[0].x.toFixed(1)},${(H - padB).toFixed(1)} Z`
    : ''

  const yZoneTop = yScale(metric.inv ? 6 : 7)
  const yZoneBot = yScale(metric.inv ? 8 : 6)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 15 }}>{metric.icon}</span>
        <span style={{ fontSize: 10, color: 'var(--report-text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{metric.label}</span>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
          {[3, 5, 7, 9].map(v => (
            <line key={v}
              x1={padL} y1={yScale(v).toFixed(1)}
              x2={W - padR} y2={yScale(v).toFixed(1)}
              stroke="var(--report-border)" strokeWidth="0.3"
            />
          ))}
          <rect
            x={padL} y={yZoneTop.toFixed(1)}
            width={chartW} height={(yZoneBot - yZoneTop).toFixed(1)}
            fill="rgba(122,173,0,0.06)"
          />
          <line
            x1={xPos(selectedIdx).toFixed(1)} y1={padT}
            x2={xPos(selectedIdx).toFixed(1)} y2={H - padB}
            stroke="rgba(122,173,0,0.3)" strokeWidth="1" strokeDasharray="3,3"
          />
          {fillPath && (
            <path d={fillPath} fill={metric.color} opacity="0.06" />
          )}
          {validPts.length >= 2 && (
            <path d={path} fill="none" stroke={metric.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {pts.map((p, i) => {
            if (!p) return null
            const isSel = i === selectedIdx
            return (
              <circle
                key={i}
                cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                // Larger dots for easier tapping on chart
                r={isSel ? 7 : 5}
                fill={isSel ? metric.color : 'var(--color-white)'}
                stroke={metric.color} strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(i)}
              >
                <title>C{evals[i].cyclus}: {p.v}/10</title>
              </circle>
            )
          })}
          {evals.map((e, i) => (
            <text
              key={e.id}
              x={xPos(i).toFixed(1)} y={H - 2}
              textAnchor="middle" fontSize="10"
              fill={i === selectedIdx ? 'var(--report-chart-selected)' : 'var(--report-border-strong)'}
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
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--report-border)' }}>
            <th style={{ padding: '10px 12px 10px 0', textAlign: 'left', color: 'var(--report-text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Meting</th>
            {evals.map(ev => (
              <th key={ev.id} style={{ padding: '10px', textAlign: 'center', color: 'var(--report-text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>C{ev.cyclus}</th>
            ))}
            <th style={{ padding: '10px 0 10px 10px', textAlign: 'right', color: 'var(--report-text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Δ</th>
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
              <tr key={key} style={{ borderBottom: '1px solid var(--report-border-soft)' }}>
                <td style={{ padding: '14px 12px 14px 0', color: 'var(--text-quieter)', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</td>
                {evals.map(ev => {
                  const val = ev[key as keyof Evaluatie] as number | null
                  return (
                    <td key={ev.id} style={{ padding: '14px 10px', textAlign: 'center', color: val !== null ? 'var(--surface-pressed)' : 'var(--report-border-strong)' }}>
                      {val !== null ? <>{val}{unit && <span style={{ fontSize: 10, color: 'var(--report-text-soft)', marginLeft: 2 }}>{unit}</span>}</> : '—'}
                    </td>
                  )
                })}
                <td style={{ padding: '14px 0 14px 10px', textAlign: 'right' }}>
                  {diff !== null && diff !== 0 ? (
                    <span style={{ fontWeight: 600, color: improved ? 'var(--delta-positive)' : 'var(--delta-negative)' }}>
                      {diff > 0 ? '+' : '−'}{Math.abs(+diff.toFixed(1))}{unit && <span style={{ fontSize: 10, marginLeft: 1 }}>{unit}</span>}
                    </span>
                  ) : <span style={{ color: 'var(--report-border-strong)' }}>—</span>}
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
      try {
        const res = await fetch(`/api/leden/${id}`)
        if (res.ok) {
          const { lid: lidData, evaluaties: evalData } = await res.json()
          setLid(lidData ?? null)
          // API returns DESC; vooruitgang chart needs ASC
          const sorted = (evalData ?? []).slice().sort((a: { cyclus: number }, b: { cyclus: number }) => a.cyclus - b.cyclus)
          setEvals(sorted)
          setSelectedIdx(sorted.length - 1)
        }
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--report-surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--wave-green)' }} />
    </div>
  )

  if (!lid) return (
    <div style={{ minHeight: '100vh', background: 'var(--report-surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--report-text-muted)', fontFamily: 'Raleway, sans-serif', fontSize: '0.8rem' }}>
      Lid niet gevonden.
    </div>
  )

  if (evals.length === 0) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');`}</style>
      <div style={{ minHeight: '100vh', background: 'var(--report-surface-muted)', color: 'var(--report-text-soft)', fontFamily: 'Raleway, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Geen evaluaties gevonden</span>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--wave-green)', fontFamily: 'Raleway, sans-serif', fontSize: '0.72rem', cursor: 'pointer', minHeight: 44 }}>
          ← Terug naar {lid.voornaam}
        </button>
      </div>
    </>
  )

  const selectedEval = evals[selectedIdx]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        body { background: var(--report-green-soft); }

        .vg-root {
          min-height: 100vh;
          min-height: 100dvh;
          background: var(--report-green-soft);
          font-family: Raleway, system-ui, sans-serif;
          padding-bottom: 60px;
          -webkit-tap-highlight-color: transparent;
        }

        /* ── Header ── */
        .vg-header {
          background: var(--color-white);
          border-bottom: 1px solid var(--report-green-border);
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .vg-logo { font-size: 15px; font-weight: 700; color: var(--report-green-dark); letter-spacing: -0.02em; }
        .vg-logo span { color: var(--report-green); }

        .vg-back {
          background: none;
          border: none;
          color: var(--report-text-muted);
          font-family: Raleway, sans-serif;
          font-size: 0.72rem;
          cursor: pointer;
          letter-spacing: 0.06em;
          /* Tap target */
          min-height: 44px;
          padding: 0 4px;
          display: flex;
          align-items: center;
          touch-action: manipulation;
        }
        .vg-back:hover  { color: var(--report-chart-selected); }
        .vg-back:active { color: var(--report-chart-selected); }

        /* ── Card ── */
        .vg-card {
          background: var(--color-white);
          border: 1px solid var(--report-green-border);
          border-radius: 16px;
          overflow: hidden;
          width: 90vw;
          max-width: none;
          margin: 24px auto 0;
        }

        .vg-card-head {
          background: var(--report-green-soft);
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--report-green-border);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .vg-member-name { font-size: 22px; font-weight: 600; color: var(--surface-pressed); margin: 0 0 4px; letter-spacing: -0.02em; }
        .vg-member-meta { font-size: 12px; color: var(--report-text-muted); }

        /* ── Cycle strip — horizontally scrollable on tablet ── */
        .vg-cycles-strip {
          display: flex;
          gap: 6px;
          padding: 12px 24px;
          border-bottom: 1px solid var(--report-border-soft);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          flex-wrap: nowrap;
        }
        .vg-cycles-strip::-webkit-scrollbar { display: none; }

        .vg-cyc-btn {
          padding: 8px 16px;
          min-height: 40px;
          border-radius: 20px;
          border: 1.5px solid var(--report-green-border-muted);
          background: var(--report-bg);
          color: var(--wave-gray);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          font-family: Raleway, sans-serif;
          white-space: nowrap;
          flex-shrink: 0;
          touch-action: manipulation;
        }
        .vg-cyc-btn:hover  { border-color: var(--report-green); color: var(--report-green-dark); background: var(--report-green-soft); }
        .vg-cyc-btn:active { transform: scale(0.96); }
        .vg-cyc-btn.active { border-color: var(--report-chart-selected); background: var(--report-green-fill); color: var(--health-green-text); }

        /* ── Rings ── */
        .vg-rings {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          padding: 20px 24px;
          border-bottom: 1px solid var(--report-border-soft);
        }

        /* ── Tabs ── */
        .vg-tabs { display: flex; gap: 4px; padding: 14px 24px 0; }

        .vg-tab {
          padding: 10px 16px;
          min-height: 44px;
          border-radius: 8px 8px 0 0;
          border: 1px solid transparent;
          background: transparent;
          color: var(--report-text-soft);
          font-family: Raleway, sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          border-bottom: none;
          touch-action: manipulation;
        }
        .vg-tab:active { transform: scale(0.96); }
        .vg-tab.active { background: var(--report-surface-muted); border-color: var(--report-green-border); color: var(--report-green-dark); }

        /* ── Tab body ── */
        .vg-tab-body {
          padding: 20px 24px 24px;
          background: var(--report-surface-muted);
          border-top: 1px solid var(--report-green-border);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── Footer ── */
        .vg-footer-strip {
          padding: 12px 24px;
          background: var(--report-green-soft);
          border-top: 1px solid var(--report-green-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* ── Tablet: iPad 7th gen ── */
        @media (min-width: 768px) and (pointer: coarse) {
          .vg-header { height: 64px; }
          .vg-back { font-size: 0.82rem; }

          /* Card fills more of the tablet viewport */
          .vg-card { width: 92vw; margin: 28px auto 0; }

          /* Rings: bigger on tablet */
          .vg-rings { padding: 24px 28px; gap: 12px; }

          /* Cycle buttons: taller */
          .vg-cyc-btn { padding: 10px 20px; min-height: 48px; font-size: 14px; }

          /* Tab bar */
          .vg-tab { padding: 12px 20px; min-height: 48px; font-size: 13px; }

          /* Tab body: more breathing room */
          .vg-tab-body { padding: 24px 28px 28px; gap: 16px; }

          /* Fysiek table rows taller */
        }

        /* Portrait tablet: card nearly full width */
        @media (max-width: 899px) and (pointer: coarse) and (orientation: portrait) {
          .vg-card { width: 96vw; border-radius: 12px; }
          /* Rings: 3 per row on portrait to avoid cramping */
          .vg-rings { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        }

        /* Landscape tablet: keep 6-col rings, wider card */
        @media (min-width: 900px) and (pointer: coarse) and (orientation: landscape) {
          .vg-card { width: 92vw; }
        }
      `}</style>

      <div className="vg-root">
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
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--surface-pressed)' }}>Cyclus {selectedEval.cyclus}</div>
              <div style={{ fontSize: 12, color: 'var(--report-text-muted)', marginTop: 2 }}>{formatDate(selectedEval.datum)}</div>
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

          {/* Rings */}
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
            <span />
            <span style={{ fontSize: 11, color: 'var(--report-text-subtle)' }}>
              {evals[0] ? formatDate(evals[0].datum) : ''} – {formatDate(selectedEval.datum)}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
