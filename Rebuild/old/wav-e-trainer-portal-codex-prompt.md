# Codex Task — WAV-e Trainer Portal Redesign + Acties Page

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
Primary file: `src/app/trainer/[trainerId]/page.tsx`
New file: `src/app/trainer/[trainerId]/acties/page.tsx`

**This task touches two files and nothing else.** No API routes, no DB, no middleware, no other pages.

Read both sections of this prompt in full before writing a single line.

---

## What this task does

The trainer dashboard is being restructured from a data-heavy page into an **entry portal** — a page with a clear information hierarchy and obvious entry points. Three structural changes:

1. **Header becomes identity-only** — action buttons move out of the header into the page body
2. **A portal action grid replaces the inline buttons** — three large touch-friendly tiles below the stoplicht section
3. **Open acties moves to a dedicated page** — the dashboard shows a summary tile only; the full list lives at `/trainer/[trainerId]/acties`

All existing logic, data fetching, types, helpers, and components (`MomentumStrip`, `AddLidModal`) are preserved exactly. This is a layout and UX restructure, not a logic rewrite.

---

## Step 1 — Read the current file in full

Read `src/app/trainer/[trainerId]/page.tsx` before writing anything. Map:

1. All state variables
2. All refs (`gesprekRef`, `stoplichtRef`)
3. The full `useEffect` load block — all six queries in `Promise.all`
4. `MomentumStrip` component — preserve verbatim
5. `AddLidModal` component — preserve verbatim
6. All CSS class names in the `<style>` block
7. The JSX structure: header → greeting → momentum → stoplicht → notities comment → section header → acties list

Do not write until you have mapped the full file.

---

## File 1 — `src/app/trainer/[trainerId]/page.tsx`

### Change 1 — Header

**Remove** from the header's `td-header-right` div:
- `+ Nieuw lid` button
- `Mijn leden` button
- `+ Nieuw gesprek` button with its dropdown and `gesprekRef`

**Keep** in the header:
- Wordmark (`td-wordmark`)
- Trainer name (`td-trainer-name`)
- Uitloggen button

The header becomes: wordmark left, trainer name + uitloggen right. Nothing else.

**Remove** `gesprekRef` and `gesprekOpen` state — the gesprek dropdown moves to the portal grid (see Change 3). Remove the `useEffect` handler that closes the gesprek dropdown on outside click, but keep the stoplicht outside-click handler.

Keep `stoplichtRef` — it is still needed for the stoplicht bar.

### Change 2 — Remove acties from dashboard body

**Remove** from the JSX body:
- The entire `td-section-header` block for "Open acties"
- The entire acties render block (the `loading ? ... : acties.length === 0 ? ... : (() => { ... })()` block)

**Keep** the `acties` state and all data fetching for acties in the `useEffect` — the acties page will need it passed via URL state or re-fetched. Actually: **keep the full acties data fetch as-is** in the dashboard load. The acties count is used by the summary tile (see Change 3).

### Change 3 — Portal action grid

Add this section between the stoplicht summary bar and the management notities comment block.

**JSX:**

```tsx
{/* Portal action grid */}
{!loading && (
  <div className="td-portal-grid">

    {/* Nieuw gesprek — primary action */}
    <div style={{ position: 'relative' }} ref={gesprekRef}>
      <button
        className="td-portal-tile td-portal-tile--primary"
        onClick={() => setGesprekOpen(o => !o)}
      >
        <span className="td-portal-tile-icon">↗</span>
        <div className="td-portal-tile-body">
          <span className="td-portal-tile-label">Nieuw gesprek</span>
          <span className="td-portal-tile-sub">Start een cyclus</span>
        </div>
      </button>
      {gesprekOpen && (
        <div className="td-dropdown">
          {ledenDropdown.length === 0
            ? <div className="td-dropdown-empty">Geen leden gevonden</div>
            : ledenDropdown.map(lid => (
              <div key={lid.id} className="td-dropdown-item" onClick={() => handleGesprekSelect(lid)}>
                <span className="td-dropdown-name">{lid.voornaam} {lid.achternaam}</span>
                <span className="td-dropdown-meta">{lid.lid_id}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>

    {/* Open acties — navigates to acties page */}
    <button
      className="td-portal-tile"
      onClick={() => router.push(`/trainer/${trainerId}/acties`)}
    >
      <span className="td-portal-tile-icon">✓</span>
      <div className="td-portal-tile-body">
        <span className="td-portal-tile-label">Open acties</span>
        <span className="td-portal-tile-sub">
          {acties.length === 0
            ? 'Alles afgerond'
            : `${acties.length} open${acties.some(a => {
                const d = a.deadline?.slice(0,10) ?? null
                return d !== null && d < todayIsoDate()
              }) ? ' · let op verlopen' : ''}`
          }
        </span>
      </div>
    </button>

    {/* Mijn leden */}
    <button
      className="td-portal-tile"
      onClick={() => router.push(`/trainer/${trainerId}/leden`)}
    >
      <span className="td-portal-tile-icon">◈</span>
      <div className="td-portal-tile-body">
        <span className="td-portal-tile-label">Mijn leden</span>
        <span className="td-portal-tile-sub">{leden.length} actief</span>
      </div>
    </button>

    {/* Nieuw lid */}
    <button
      className="td-portal-tile"
      onClick={() => setShowAddLid(true)}
    >
      <span className="td-portal-tile-icon">+</span>
      <div className="td-portal-tile-body">
        <span className="td-portal-tile-label">Nieuw lid</span>
        <span className="td-portal-tile-sub">Lid toevoegen</span>
      </div>
    </button>

  </div>
)}
```

**Restore `gesprekRef` and `gesprekOpen`** — they now live in the portal grid instead of the header. The `gesprekRef` ref must be declared at the top of the component. The outside-click handler for `gesprekRef` must be restored in the `useEffect`.

**CSS for portal grid:**

```css
/* ── Portal action grid ── */
.td-portal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 2rem;
  animation: fadeUp 0.5s ease-out 0.18s both;
}

.td-portal-tile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 22px;
  min-height: 72px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  text-align: left;
  font-family: 'Raleway', sans-serif;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  touch-action: manipulation;
  width: 100%;
  position: relative;
}

.td-portal-tile:hover {
  border-color: rgba(168,200,0,0.25);
  background: rgba(168,200,0,0.05);
}

.td-portal-tile:active {
  transform: scale(0.98);
  background: rgba(168,200,0,0.08);
}

.td-portal-tile--primary {
  border-color: rgba(168,200,0,0.3);
  background: rgba(168,200,0,0.07);
}

.td-portal-tile--primary:hover {
  border-color: rgba(168,200,0,0.5);
  background: rgba(168,200,0,0.11);
  box-shadow: 0 4px 20px rgba(168,200,0,0.12);
}

.td-portal-tile-icon {
  font-size: 1.3rem;
  color: var(--wave-green);
  flex-shrink: 0;
  width: 28px;
  text-align: center;
  opacity: 0.8;
}

.td-portal-tile-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.td-portal-tile-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-warm);
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.td-portal-tile-sub {
  font-size: 0.65rem;
  color: var(--text-faint);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

**Add to tablet breakpoint** (`@media (min-width: 768px) and (pointer: coarse)`):

```css
.td-portal-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
.td-portal-tile { padding: 24px 26px; min-height: 80px; }
.td-portal-tile-label { font-size: 0.95rem; }
.td-portal-tile-icon { font-size: 1.5rem; width: 32px; }
```

**Add to portrait tablet breakpoint** (`@media (max-width: 899px) and (pointer: coarse) and (orientation: portrait)`):

```css
.td-portal-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
.td-portal-tile { padding: 18px 16px; min-height: 68px; gap: 12px; }
```

### Change 4 — Update animation stagger

The new body load order is:
1. Greeting → `0s`
2. Momentum → `0.08s`
3. Stoplicht bar → `0.14s`
4. Portal grid → `0.18s`
5. Management notities slot → `0.22s` (already commented out, update the delay in the CSS)

Update `.td-summary-bar` animation delay to `0.14s` if not already set.
Update `.td-portal-grid` animation delay to `0.18s` (already in CSS above).
Update `.td-notities` animation delay to `0.22s`.

Remove `.td-section-header` and `.td-list` animation declarations — those classes are no longer used on this page (they move to the acties page).

### Change 5 — Remove now-unused CSS

Remove from the `<style>` block:
- `.td-section-header` and `.td-section-title` and `.td-section-count`
- `.td-list`
- `.td-row`, `.td-row-actie`, `.td-row-dagen`, `.td-row-deadline`
- `.td-row-deadline.neutral`, `.td-row-deadline.today`, `.td-row-deadline.overdue`
- `.td-mgmt-badge`
- `.td-group-header`, `.td-group-header:active`, `.td-group-header.no-nav`
- `.td-empty`

These are moved to the acties page. Removing them from the dashboard keeps the bundle clean.

**Keep:**
- All momentum CSS
- All stoplight CSS
- All dropdown CSS
- All button CSS
- All header CSS
- `.td-portal-*` (new)
- `.td-notities`, `.td-notitie-card`, `.td-notitie-tekst`, `.td-notitie-meta`

---

## File 2 — `src/app/trainer/[trainerId]/acties/page.tsx`

Create this file from scratch. It is a self-contained client component that fetches and renders the full open acties list for a trainer.

### What it contains

- All types from the dashboard: `Lid`, `Actie`, `LidDropdown`, `Trainer`
- All helpers: `toUiStoplight`, `getLidStoplight`, `STOPLIGHT`, `todayIsoDate`, `addDaysIsoDate`, `getIsoDatePart`, `formatDeadlineDate`, `isActieOverdue`, `getActieDeadlineDaysRemaining`, `getActieDeadlineLabel`, `getLidActieSortTier`, `DUTCH_MONTHS`
- Its own data fetch — same queries as the dashboard for acties and leden, same pattern
- Its own `<style>` block — copy the acties-specific CSS from the dashboard: `td-section-header`, `td-section-title`, `td-section-count`, `td-list`, `td-row`, `td-row-actie`, `td-row-dagen`, `td-row-deadline`, `td-mgmt-badge`, `td-group-header`, `td-empty`; plus root, header, body, button styles matching the dashboard's aesthetic
- A sticky header with: wordmark left, back button (← Dashboard) right
- The full acties render logic verbatim from the dashboard

### Data fetch

```typescript
useEffect(() => {
  const load = async () => {
    const supabase = getSupabase()

    const { data: trainerData } = await supabase
      .from('trainers').select('id, naam').eq('id', trainerId).single()
    setTrainer(trainerData)

    const { data: ledenData } = await supabase
      .from('leden').select('id, lid_id, voornaam, achternaam')
      .eq('trainer_id', trainerId).eq('actief', true).order('voornaam')

    if (!ledenData || ledenData.length === 0) { setLoading(false); return }

    const lidIds = ledenData.map(l => l.id)
    const today = todayIsoDate()

    const [
      { data: contacten },
      { data: evaluaties },
      { data: actiesData },
      { data: trainerActies },
    ] = await Promise.all([
      supabase.from('contact_momenten').select('lid_id, datum').in('lid_id', lidIds).order('datum', { ascending: false }),
      supabase.from('evaluaties').select('lid_id, datum, slaap, energie, stress, cyclus').in('lid_id', lidIds).order('cyclus', { ascending: false }),
      supabase.from('acties').select('id, lid_id, omschrijving, aangemaakt, deadline, status').in('lid_id', lidIds).eq('status', 'open').order('aangemaakt', { ascending: true }),
      supabase.from('acties').select('id, lid_id, omschrijving, aangemaakt, deadline, status').eq('trainer_id', trainerId as string).is('lid_id', null).eq('status', 'open').order('aangemaakt', { ascending: true }),
    ])

    const openActiesPerLid: Record<string, number> = {}
    for (const a of actiesData ?? []) openActiesPerLid[a.lid_id] = (openActiesPerLid[a.lid_id] ?? 0) + 1

    const enrichedLeden: Lid[] = ledenData.map(l => {
      const lastContact = contacten?.find(c => c.lid_id === l.id)
      const lastEval = evaluaties?.find(e => e.lid_id === l.id)
      const lastContactDatum = getLatestContactDatum(lastContact?.datum, lastEval?.datum)
      return {
        id: l.id, lid_id: l.lid_id, voornaam: l.voornaam, achternaam: l.achternaam,
        laatste_contact: lastContactDatum,
        laatste_evaluatie: lastEval?.datum ?? null,
        slaap: lastEval?.slaap ?? null,
        energie: lastEval?.energie ?? null,
        stress: lastEval?.stress ?? null,
        open_acties: openActiesPerLid[l.id] ?? 0,
      }
    })
    setLeden(enrichedLeden)

    const memberActies: Actie[] = (actiesData ?? []).map(a => {
      const lid = ledenData.find(l => l.id === a.lid_id)
      return {
        id: a.id, lid_uuid: a.lid_id, lid_id: lid?.lid_id ?? '—',
        voornaam: lid?.voornaam ?? '—', achternaam: lid?.achternaam ?? '',
        omschrijving: a.omschrijving, aangemaakt: a.aangemaakt,
        deadline: a.deadline ?? null, status: a.status,
        is_management: false,
      }
    })

    const mgmtActies: Actie[] = (trainerActies ?? []).map(a => ({
      id: a.id, lid_uuid: null, lid_id: '',
      voornaam: 'Management', achternaam: '',
      omschrijving: a.omschrijving, aangemaakt: a.aangemaakt,
      deadline: a.deadline ?? null, status: a.status,
      is_management: true,
    }))

    setActies([...mgmtActies, ...memberActies])
    setLoading(false)
  }
  if (trainerId) load()
}, [trainerId])
```

### Header JSX

```tsx
<header className="td-header">
  <div className="td-header-inner">
    <div className="td-wordmark">
      <span className="td-wordmark-wav">wav</span>
      <span className="td-wordmark-e">-e</span>
    </div>
    <div className="td-header-right">
      {trainer?.naam && <span className="td-trainer-name">{trainer.naam}</span>}
      <button
        className="td-btn-secondary"
        onClick={() => router.push(`/trainer/${trainerId}`)}
      >
        ← Dashboard
      </button>
    </div>
  </div>
</header>
```

### Body JSX

```tsx
<div className="td-body">
  <div className="td-section-header">
    <span className="td-section-title">Open acties</span>
    <span className="td-section-count">{acties.length}</span>
  </div>

  {/* Full acties render logic — copy verbatim from dashboard */}
  {loading ? (
    <div className="td-empty">Laden…</div>
  ) : acties.length === 0 ? (
    <div className="td-empty">Geen open acties.</div>
  ) : (() => {
    /* ... exact acties render block from dashboard page ... */
  })()}
</div>
```

The acties render block inside the IIFE is the **exact same code** that was in the dashboard. Copy it verbatim. Do not rewrite or simplify.

### CSS for acties page

The acties page uses the same `td-*` CSS namespace. Copy verbatim from the dashboard:
- Root, header, body styles (same background, same header)
- All button styles
- Dropdown styles
- The acties-specific classes: `td-section-header`, `td-section-title`, `td-section-count`, `td-list`, `td-row`, `td-row-actie`, `td-row-dagen`, `td-row-deadline.*`, `td-mgmt-badge`, `td-group-header`, `td-empty`
- The `@keyframes fadeUp` and `@keyframes dropIn` declarations
- Tablet and portrait breakpoints for the above

---

## Step 2 — Verify before committing

1. `npm run build` passes with zero TypeScript errors
2. No imports are missing on the acties page (`getLatestContactDatum` comes from `@/lib/stoplight` — verify the import)
3. On the dashboard: header has wordmark + trainer name + uitloggen only — no action buttons
4. On the dashboard: portal grid renders with 4 tiles after data loads
5. `Nieuw gesprek` tile opens the lid dropdown — tap a lid, navigates to gesprek
6. `Open acties` tile navigates to `/trainer/[trainerId]/acties`
7. `Mijn leden` tile navigates to `/trainer/[trainerId]/leden`
8. `Nieuw lid` tile opens the `AddLidModal`
9. Acties page loads independently, shows full list, back button returns to dashboard
10. `AddLidModal` still works from the portal tile

---

## Do not touch

- `src/app/trainer/[trainerId]/leden/page.tsx`
- Any API routes
- Any DB or migrations
- Middleware
- Any other page

---

## Notes

- `getLatestContactDatum` is imported from `@/lib/stoplight` — the acties page needs this import
- Windows line endings (CRLF) — do not convert
- Dutch UI copy only in all rendered text
- The `acties` state on the dashboard is kept even though the list is no longer rendered there — it feeds the portal tile sub-label (open count + verlopen warning)
- The `gesprekRef` ref must be re-declared on the dashboard even though the button moved — it is now on the portal grid tile, not the header
