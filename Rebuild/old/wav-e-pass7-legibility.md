# WAV-e Rebuild — Pass 7: Code Legibility for Bart

**Branch:** `main`
**Session type:** Low risk. Comments and cleanup only. No logic changes. No CSS changes.

---

## Context

WAV-e is a coaching intelligence layer for an EMS studio built on Next.js 14 (App Router, TypeScript, Tailwind CSS) with Supabase as the backend. All UI copy and DB column names are in Dutch.

Bart is the client and will maintain this codebase going forward. He is not a developer by training. He can read code but needs clear signposting to understand what each file does, what data it touches, and what roles can access it. He should be able to open any page file and understand it without asking for help.

This is Pass 7 of an 8-pass rebuild. No logic changes. No CSS changes. Comments, cleanup, and dead code removal only.

---

## Instructions

### Step 1 — Add a comment block to every page file

Add a comment block at the very top of each page file (below any `'use client'` directive, above imports). Use this exact format:

```typescript
/*
 * [PAGINANAAM]
 *
 * Wat doet deze pagina:
 * [One or two sentences describing what this page does in plain Dutch]
 *
 * Data:
 * [List the Supabase tables this page reads from or writes to]
 *
 * Toegang:
 * [Which roles can access this page: admin / management / trainer / lid]
 *
 * Gerelateerde API routes:
 * [List any API routes this page calls, e.g. /api/admin/console-tokens]
 */
```

Write the content in Dutch. Keep it factual and short — Bart reads this when something breaks, not for fun.

Apply to every file in `src/app/` that is a page file (`page.tsx`). Do not add comment blocks to API routes, components, or utility files.

Pages to cover:
- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/console/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/management/page.tsx`
- `src/app/trainer/[trainerId]/page.tsx`
- `src/app/trainer/[trainerId]/leden/page.tsx`
- `src/app/leden/[id]/page.tsx`
- `src/app/leden/[id]/evaluatie/[cyclus]/page.tsx`
- `src/app/leden/[id]/vooruitgang/page.tsx`
- `src/app/gesprek/new/page.tsx`

### Step 2 — Add inline comments to stoplight logic

Open `src/lib/stoplight.ts`. The `getStoplight()` function must have an inline comment block explaining:
- What each threshold means in plain Dutch
- Why the thresholds are 14 and 28 days
- What `null` means (no contact on record)

Use this format:

```typescript
/*
 * Stoplicht logica:
 *
 * groen  = contact binnen 14 dagen — lid is op koers
 * oranje = 15 tot 28 dagen — aandacht nodig
 * rood   = 29 dagen of meer, of geen contact bekend — urgent
 *
 * De drempelwaarden (14 en 28 dagen) zijn gebaseerd op de coachingscyclus:
 * een EMS-trainer zou elke twee weken contact moeten hebben met actieve leden.
 * Bij geen datum (null) gaan we uit van het slechtste geval: rood.
 */
```

Also add a one-line comment above `daysSince()` and `getLatestContactDatum()` explaining what each returns.

### Step 3 — Remove dead code and commented-out blocks

Remove the following flagged items from the Pass 1 audit:

- `src/app/leden/[id]/vooruitgang/page.tsx:43` — unused `MetricKey` type (if not already removed in Pass 6)
- `src/app/leden/[id]/vooruitgang/page.tsx:194` — unused `col` variable (if not already removed in Pass 6)
- `src/app/leden/[id]/vooruitgang/page.tsx:110` — lint-disable comment (if no longer needed)

Also scan all page files for:
- Commented-out code blocks (not documentation comments) — remove them
- Any remaining `console.log` statements — remove them
- Any unused imports not caught in previous passes — remove them

Do not remove any comments that are documentation (explaining what something does). Only remove commented-out code.

### Step 4 — Verify unused API route parameters

The audit flagged unused `req` parameters in several API routes:
- `src/app/admin/trainers/route.ts:32`
- `src/app/api/admin/console-tokens/route.ts:34`
- `src/app/api/admin/list/route.ts:32`
- `src/app/api/admin/pins/route.ts:32`

In Next.js App Router, unused request parameters in route handlers should be prefixed with `_` to suppress lint warnings. Change `req` to `_req` where the parameter is genuinely unused. Do not remove the parameter — Next.js route handler signatures require it.

---

## Constraints

- Do not change any logic, data fetching, or component structure
- Do not change any CSS or styling
- Write all comments in Dutch
- Do not add comments to API routes, components, or `src/lib/` files — only page files and `stoplight.ts`
- If you are unsure what a page does, read it fully before writing the comment — do not guess

---

## Output

After all changes are made, produce a summary:

1. List of page files that received comment blocks
2. Confirm stoplight comments were added to `src/lib/stoplight.ts`
3. List of dead code removed (file + what was removed)
4. List of API route parameters prefixed with `_`
5. Anything found but not changed

Then stop. Do not proceed to Pass 8.

---

## Gate

After this pass:
1. `npm run build` zero errors
2. Open `src/app/trainer/[trainerId]/page.tsx` — read the comment block at the top
3. If you can follow what the page does, what data it reads, and who can access it without reading the rest of the file — the pass is done

---

*WAV-e Rebuild Plan | Serendipity Projects | Mei 2026*
