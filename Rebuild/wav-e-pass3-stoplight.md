# WAV-e Rebuild — Pass 3: Stoplight Consolidation & Contact Status Fix

**Branch:** `rebuild/v0.2`
**Session type:** High risk. Logic changes only. No CSS changes. No UI restructuring.

---

## Context

WAV-e is a coaching intelligence layer for an EMS studio built on Next.js 14 (App Router, TypeScript, Tailwind CSS) with Supabase as the backend. All UI copy and DB column names are in Dutch.

This is Pass 3 of an 8-pass rebuild. Two problems to fix in one session:

1. Stoplight logic exists in six places. Extract it to one shared utility.
2. Contact status logic reads from `contact_momenten` and `evaluaties` as separate values in three views — it must combine them to find the true latest contact date.

These two problems are fixed together because they live in the same files and the stoplight depends on the corrected contact date.

---

## Problem 1 — Stoplight logic is duplicated in six files

**Audit findings:**
1. `src/app/gesprek/new/page.tsx:33-41,568`
2. `src/app/leden/[id]/evaluatie/[cyclus]/page.tsx:46-54,488`
3. `src/app/leden/[id]/page.tsx:75-82,126-132`
4. `src/app/management/page.tsx:61-75,602-603`
5. `src/app/trainer/[trainerId]/leden/page.tsx:36-51,131-137,393-399`
6. `src/app/trainer/[trainerId]/page.tsx:48-81,362-367,954,999-1000`

**Fix:** Extract to `src/lib/stoplight.ts`. All six files import from there.

---

## Problem 2 — Contact status uses separate values instead of combined latest

**Audit findings (management and both trainer views):**
- `src/app/management/page.tsx:61-68,578-589` — stores `laatste_contact` from only `contact_momenten`, `laatste_evaluatie` from only `evaluaties`
- `src/app/trainer/[trainerId]/leden/page.tsx:36-43,101-116` — same pattern
- `src/app/trainer/[trainerId]/page.tsx:48-56,294-309` — same pattern

**Current broken behaviour:** A member who had a gesprek (evaluatie) 3 days ago but no recent contact_moment shows as amber or "Nog geen contact" because the stoplight only reads `contact_momenten`.

**Fix:** In all three views, compute a single `lastContactDays` from whichever is more recent — `contact_momenten.datum` or `evaluaties.datum`. The stoplight and the "Nog geen contact" label both use this combined value.

---

## Instructions

### Step 1 — Read before writing

Read the current implementation in all six files listed under Problem 1. Understand the existing threshold values and logic before extracting. Do not assume — read the actual code.

Also read `src/app/leden/[id]/page.tsx:215-220` — this is the one view that already combines both sources correctly. Use it as the reference implementation.

### Step 2 — Create `src/lib/stoplight.ts`

Create a single shared utility with the following exports:

```typescript
// Returns the number of days between a given date string and today.
// Returns null if date is null or undefined.
export function daysSince(datum: string | null | undefined): number | null

// Returns 'groen' | 'oranje' | 'rood' based on lastContactDays.
// groen:  lastContactDays <= 14
// oranje: lastContactDays > 14 and <= 28
// rood:   lastContactDays > 28 or lastContactDays is null
export function getStoplight(lastContactDays: number | null): 'groen' | 'oranje' | 'rood'

// Returns the combined latest contact date from contact_momenten and evaluaties.
// Takes the most recent datum from either source.
// Returns null if both are absent.
export function getLatestContactDatum(
  contactDatum: string | null | undefined,
  evaluatieDatum: string | null | undefined
): string | null
```

Add an inline comment above `getStoplight` explaining the thresholds:

```typescript
// Stoplight thresholds:
// groen  = contact within 14 days — on track
// oranje = 15–28 days — attention needed
// rood   = 29+ days or no contact on record — urgent
// Source: coaching cycle spec, WAV-e v2.0
```

### Step 3 — Fix contact status in management and trainer views

In `src/app/management/page.tsx`, `src/app/trainer/[trainerId]/leden/page.tsx`, and `src/app/trainer/[trainerId]/page.tsx`:

Replace the separate `laatste_contact` / `laatste_evaluatie` pattern with a single combined value using `getLatestContactDatum()` from the shared utility.

The correct pattern:

```typescript
const lastContactDatum = getLatestContactDatum(
  contacten[0]?.datum,       // most recent contact_moment
  latestEvaluatie?.datum     // most recent evaluatie
)
const lastContactDays = daysSince(lastContactDatum)
const stoplight = getStoplight(lastContactDays)
```

Apply this pattern consistently in all three files. The "Nog geen contact" label must read from `lastContactDatum === null`, not from a separate contact-only check.

### Step 4 — Replace duplicate implementations

In all six files from the audit, remove the local stoplight and daysSince implementations and replace with imports from `src/lib/stoplight.ts`.

```typescript
import { daysSince, getStoplight, getLatestContactDatum } from '@/lib/stoplight'
```

Do not leave any local copies of these functions behind.

### Step 5 — Do not touch

- `src/app/gesprek/new/page.tsx` score stoplight (lines 33-41, 568) — this is a score-based health signal, not a contact-based stoplight. Flag it in your summary but do not change it.
- `src/app/leden/[id]/evaluatie/[cyclus]/page.tsx` score stoplight (lines 46-54, 488) — same reason.
- Any CSS, layout, or component structure.
- Any API routes.
- Section 5 items from the audit (derived values written to DB) — explicitly out of scope for this pass.

---

## Constraints

- The shared utility must be pure TypeScript with no Supabase imports and no React imports
- Do not change what data is fetched from the DB — only change how it is computed after fetch
- Do not rename any variables that are used in JSX render output — only the computation logic above the return statement
- If you find a fourth location with the separate contact/evaluatie pattern that was not in the audit, fix it and note it in your summary

---

## Output

After all changes are made, produce a summary:

1. Confirm `src/lib/stoplight.ts` was created — list the three exports
2. List all files modified
3. Confirm the score-based stoplights in `gesprek/new` and `evaluatie/[cyclus]` were left untouched
4. Any additional locations found and fixed beyond the audit list
5. Any uncertainties or things you flagged but did not change

Then stop. Do not proceed to Pass 4.

---

## Gate

After this pass:
1. `npm run build` zero errors
2. Deploy to Vercel
3. Open member record WE-002 (Bart) — confirm contact status shows correct date, not "Nog geen contact"
4. Open member record WE-001 (Glenn) — confirm same
5. Confirm stoplight colour reflects the combined latest contact date, not contact_momenten only

---

*WAV-e Rebuild Plan | Serendipity Projects | Mei 2026*
