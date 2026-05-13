# Codex Task — WAV-e Trainer Dashboard UX Rebuild

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
Target file: `src/app/trainer/[trainerId]/page.tsx`

This is a UX rebuild of the existing trainer dashboard. All existing logic, data fetching, types, and functionality must be preserved exactly. This task is purely additive: new UI sections, new CSS, new component, new data queries. No existing features may be removed or broken.

---

## Objective

Rebuild the trainer landing page into a **cockpit** — the first thing a trainer sees when they log in. It should feel like a portal that says "here's your day, grab it." Tone: focused, slightly lighter than pure dark, energising without being loud. Not as bright as the member-facing pages. Think mission control, not dashboard.

---

## Step 1 — Read before touching anything

Read `src/app/trainer/[trainerId]/page.tsx` in full before writing a single line. Identify:

1. All existing state variables
2. The `useEffect` data load block — specifically what queries run and what they set
3. The `AddLidModal` component — it must survive unchanged
4. All existing CSS class names in the `<style>` block
5. The JSX structure: header → stoplight bar → section header → acties list

Do not begin writing until you have mapped the full file.

---

## Step 2 — Background and colour

Change the root background from `var(--color-black-soft)` to `#1a1c18` — one step warmer and slightly lighter than the current near-black. Keep all existing CSS variables in use; this is the only background change.

Replace the existing `td-root::before` radial gradient with two radial gradients:

```css
.td-root::before {
  content: '';
  position: fixed; inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 90% -10%, rgba(168,200,0,0.07) 0%, transparent 60%),
    radial-gradient(ellipse 40% 40% at 10% 90%, rgba(168,200,0,0.03) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}
```

Update the existing acties row and list backgrounds to use low-opacity whites instead of opaque surface variables, so they breathe on the new background:

```css
.td-list { border: 1px solid rgba(255,255,255,0.05); }
.td-row  { background: rgba(255,255,255,0.02); }
.td-row:hover:not(.no-nav) { background: rgba(255,255,255,0.04); }
.td-group-header { background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.04); }
.td-summary-card { border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); }
```

---

## Step 3 — Portal greeting

Add a greeting block immediately at the top of `td-body`, before the stoplight bar. Render only when `!loading && trainer`.

**Logic:**
```typescript
const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}
```

**JSX:**
```tsx
<div className="td-greeting">
  <div className="td-greeting-text">{greeting()}, {trainer.naam.split(' ')[0]}.</div>
  <div className="td-greeting-sub">Hier is je overzicht voor vandaag</div>
</div>
```

**CSS:**
```css
.td-greeting {
  margin-bottom: 2rem;
  animation: fadeUp 0.5s ease-out both;
}
.td-greeting-text {
  font-size: 1.55rem; font-weight: 700; color: var(--text-warm);
  letter-spacing: -0.01em; line-height: 1.2;
}
.td-greeting-sub {
  font-size: 0.72rem; color: var(--text-faint);
  letter-spacing: 0.08em; margin-top: 4px; text-transform: uppercase;
}
```

---

## Step 4 — MomentumStrip component

### Interface

Define this interface in the file, above the component:

```typescript
interface MomentumProps {
  gesprekken: number
  actiesAfgerond: number
  // v0.2: sessiesGegeven will be added here when Onlineafspraken.nl integration lands
}
```

### Component

Add a `MomentumStrip` function component in the file, below the helpers and above `AddLidModal`:

```typescript
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
    <div className="td-momentum">
      <div className="td-momentum-label">Deze maand · {maand}</div>
      <div className="td-momentum-counters">
        <div className="td-momentum-item">
          <span className="td-momentum-number">{dispGesprekken}</span>
          <span className="td-momentum-sublabel">Gesprekken</span>
        </div>
        <div className="td-momentum-divider" />
        <div className="td-momentum-item">
          <span className="td-momentum-number">{dispActies}</span>
          <span className="td-momentum-sublabel">Acties afgerond</span>
        </div>
        {/* v0.2 slot: sessiesGegeven counter goes here */}
      </div>
    </div>
  )
}
```

### CSS

Add to the `<style>` block:

```css
.td-momentum {
  margin-bottom: 2rem;
  padding: 20px 24px;
  border-radius: 4px;
  border: 1px solid rgba(168,200,0,0.18);
  background: rgba(168,200,0,0.05);
  animation: fadeUp 0.5s ease-out 0.08s both;
  position: relative;
  overflow: hidden;
}
.td-momentum::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(168,200,0,0.5), transparent);
}
.td-momentum-label {
  font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--wave-green); margin-bottom: 12px; opacity: 0.7;
}
.td-momentum-counters {
  display: flex; align-items: center;
}
.td-momentum-item {
  display: flex; flex-direction: column; gap: 3px; flex: 1;
}
.td-momentum-number {
  font-size: 2.4rem; font-weight: 700; letter-spacing: -0.03em;
  line-height: 1; color: var(--wave-green); font-variant-numeric: tabular-nums;
}
.td-momentum-sublabel {
  font-size: 0.68rem; color: var(--text-faint);
  letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;
}
.td-momentum-divider {
  width: 1px; height: 48px;
  background: rgba(168,200,0,0.15); margin: 0 28px; flex-shrink: 0;
}
```

Add to the tablet breakpoint (`@media (min-width: 768px) and (pointer: coarse)`):

```css
.td-momentum-number { font-size: 3rem; }
```

---

## Step 5 — Data queries for momentum

Inside the existing `useEffect` load function, add two additional Supabase queries to the existing `Promise.all` call. The existing queries must remain unchanged — only extend the array.

First, compute these two values at the top of the load function, before the `Promise.all`:

```typescript
const now = new Date()
const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
const today = todayIsoDate()
```

Add to the `Promise.all` array:

```typescript
// Momentum: gesprekken (evaluaties) deze maand
supabase.from('evaluaties').select('id').in('lid_id', lidIds).gte('datum', firstOfMonth).lte('datum', today),

// Momentum: acties afgerond deze maand
supabase.from('acties').select('id').in('lid_id', lidIds).eq('status', 'afgerond').gte('afgerond_op', firstOfMonth),
```

Destructure the two new results from the `Promise.all` response alongside the existing ones. Name them `evalsMaand` and `actiesAfgerondData`.

After the `Promise.all`, set momentum state:

```typescript
setMomentum({
  gesprekken:     evalsMaand?.length        ?? 0,
  actiesAfgerond: actiesAfgerondData?.length ?? 0,
})
```

Add the state variable at the top of `TrainerDashboard`:

```typescript
const [momentum, setMomentum] = useState<MomentumProps>({ gesprekken: 0, actiesAfgerond: 0 })
```

---

## Step 6 — Management notities slot (future-proof, not active yet)

Add the following commented-out block to the JSX, between the stoplight summary bar and the `td-section-header` for open acties. This is a placeholder for when the `notities` table is built in v0.1.1:

```tsx
{/* Management notities — v0.1.1 ready slot
    When notities table exists, fetch from /api/notities/trainer/[trainerId]
    and render here. Management writes; trainers see read-only. */}
{/* {managementNotities.length > 0 && (
  <div className="td-notities">
    <div className="td-section-header">
      <span className="td-section-title">Van management</span>
      <span className="td-section-count">{managementNotities.length}</span>
    </div>
    {managementNotities.map(n => (
      <div key={n.id} className="td-notitie-card">
        <div className="td-notitie-tekst">{n.tekst}</div>
        <div className="td-notitie-meta">{n.auteur_naam} · {new Date(n.aangemaakt_op).toLocaleDateString('nl-NL')}</div>
      </div>
    ))}
  </div>
)} */}
```

Add CSS for the slot (even though it's commented out, it must be present for when it activates):

```css
.td-notities { margin-bottom: 2rem; animation: fadeUp 0.5s ease-out 0.18s both; }
.td-notitie-card {
  padding: 14px 18px; margin-bottom: 8px; border-radius: 3px;
  background: rgba(99,102,241,0.06);
  border: 1px solid rgba(99,102,241,0.16);
  border-left: 3px solid rgba(99,102,241,0.5);
}
.td-notitie-tekst { font-size: 0.85rem; color: var(--text-dim); line-height: 1.5; }
.td-notitie-meta  { font-size: 0.62rem; color: var(--text-faint); letter-spacing: 0.06em; margin-top: 6px; text-transform: uppercase; }
```

---

## Step 7 — Render MomentumStrip in JSX

In the JSX body, between the greeting and the stoplight summary bar, add:

```tsx
{!loading && (
  <MomentumStrip
    gesprekken={momentum.gesprekken}
    actiesAfgerond={momentum.actiesAfgerond}
  />
)}
```

---

## Step 8 — Stagger the existing animations

Update the animation delays on existing elements so the page loads in sequence:

```
td-greeting        → animation-delay: 0s
td-momentum        → animation-delay: 0.08s   (already in CSS above)
td-summary-bar     → animation-delay: 0.14s
td-section-header  → animation-delay: 0.20s
td-list            → animation-delay: 0.22s
```

Find the existing `animation` declarations on `.td-summary-bar`, `.td-section-header`, and `.td-list` and update their delays to match.

---

## Step 9 — Do not touch

- `AddLidModal` component — zero changes
- All existing Actie rendering logic — zero changes
- All existing stoplight dropdown behaviour — zero changes
- All existing tablet breakpoint rules — only extend, never replace
- Middleware, API routes, DB — nothing outside this one file

---

## Step 10 — Verify before committing

1. `npm run build` passes with zero TypeScript errors
2. The `Promise.all` destructuring correctly maps all results — count them before and after
3. `afgerond_op` column exists on `acties` table — if uncertain, check Supabase schema before querying it
4. MomentumStrip animates on page load (numbers count up from 0)
5. Greeting shows correct time-of-day salutation
6. All existing functionality works: stoplight dropdowns, gesprek dropdown, add lid modal, navigation

---

## Acceptance criteria

- Trainer logs in and immediately sees: greeting with first name, momentum strip with this month's counts, stoplight bar, open acties
- Momentum numbers animate up from 0 on load (~800ms)
- Page feels like a portal — purposeful, slightly warm, not oppressively dark
- Management notities slot is present in comments, ready to uncomment
- No existing features broken

---

## Notes

- `afgerond_op` must exist as a column on `acties` before querying it. Verify with Supabase MCP or schema inspection before writing the query. If absent, the query must be omitted and `actiesAfgerond` hardcoded to 0 with a TODO comment.
- Dutch UI copy only — no English labels in rendered output
- Windows line endings (CRLF) — do not convert
- This repo uses `@/lib/supabase` for client access — do not import from `@supabase/ssr` directly in this file
