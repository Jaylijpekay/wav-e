# WAV-e Rebuild — Pass 2: CSS & Globals Cleanup

**Branch:** `rebuild/v0.2`
**Session type:** Low risk. CSS and styling changes only. No logic changes.

---

## Context

WAV-e is a coaching intelligence layer for an EMS studio built on Next.js 14 (App Router, TypeScript, Tailwind CSS) with Supabase as the backend. All UI copy is in Dutch.

This is Pass 2 of an 8-pass rebuild. Your job is to move all hardcoded hex values to CSS tokens in `globals.css`, clean up dead CSS, verify `@import` position, and remove unused imports flagged in the audit. No logic changes. No component restructuring. No stoplight changes.

---

## What the audit found

The following files contain hardcoded hex values that need to be tokenised:

- `src/app/admin/page.tsx`
- `src/app/components/AdminBar.tsx`
- `src/app/components/Navigation.tsx`
- `src/app/console/page.tsx`
- `src/app/gesprek/new/page.tsx`
- `src/app/leden/[id]/evaluatie/[cyclus]/page.tsx`
- `src/app/leden/[id]/vooruitgang/page.tsx`
- `src/app/leden/[id]/page.tsx`
- `src/app/login/page.tsx`
- `src/app/management/page.tsx`
- `src/app/trainer/[trainerId]/leden/page.tsx`
- `src/app/trainer/[trainerId]/page.tsx`

The following unused imports were flagged:

- `src/app/leden/[id]/page.tsx:6` — unused `Navigation` import
- `src/app/leden/[id]/vooruitgang/page.tsx:43` — unused `MetricKey` type
- `src/app/leden/[id]/vooruitgang/page.tsx:194` — unused `col` variable
- `src/app/leden/[id]/vooruitgang/page.tsx:110` — lint-disable comment (remove if no longer needed after unused variable is removed)

---

## Instructions

### Step 1 — Inventory existing tokens

Read `src/app/globals.css` first. List every CSS variable already defined (e.g. `--color-*`, `--bg-*`, or equivalent). Do not create duplicates.

### Step 2 — Group and name new tokens

Before writing anything, group all unique hex values found across the files above into semantic token names. Use a consistent naming convention that matches whatever is already in `globals.css`. Examples:

```css
--color-stoplight-groen: #...;
--color-stoplight-oranje: #...;
--color-stoplight-rood: #...;
--color-bg-card: #...;
--color-text-muted: #...;
```

If the same hex value appears in multiple files under different apparent semantics, use the most descriptive name and apply it consistently. Do not create one token per file — group by meaning.

### Step 3 — Add tokens to globals.css

Add all new tokens to the `:root` block in `globals.css`. Place the `@import` statement at the very top of the file if it is not already there.

### Step 4 — Replace hardcoded values in page files

Replace every hardcoded hex value in the files listed above with the corresponding CSS variable. Use `var(--token-name)` syntax. Do not change any logic, layout, or component structure — only the color values.

### Step 5 — Remove unused imports

Remove the flagged unused imports and variables:
- `Navigation` import from `src/app/leden/[id]/page.tsx`
- `MetricKey` type from `src/app/leden/[id]/vooruitgang/page.tsx`
- `col` variable from `src/app/leden/[id]/vooruitgang/page.tsx`
- lint-disable comment from `src/app/leden/[id]/vooruitgang/page.tsx` if it was only suppressing the `col` warning

### Step 6 — Dead CSS

Scan `globals.css` for any class definitions that are not referenced anywhere in the codebase. Remove them. Do not remove tokens added in Step 3.

---

## Constraints

- Do not change any TypeScript logic, API routes, or data fetching
- Do not rename or restructure components
- Do not change Tailwind utility classes — only replace raw hex values used in inline styles or CSS
- If a hex value is used inside a Tailwind `style={{}}` prop, replace it with `var(--token-name)` in the same prop
- If you are uncertain whether a hex value is used for stoplight logic specifically, flag it in a comment at the end of your output — do not guess

---

## Output

After all changes are made, produce a short summary:

1. List of all new CSS tokens added to `globals.css`
2. List of files modified
3. Any hex values you flagged as uncertain (if any)

Then stop. Do not proceed to Pass 3.

---

## Gate

After this pass: `npm run build` must complete with zero errors. Deploy to Vercel. Visually verify the app renders correctly across at least: login, trainer dashboard, management page, and one member detail page.

---

*WAV-e Rebuild Plan | Serendipity Projects | Mei 2026*
