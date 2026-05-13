# WAV-e Rebuild — Pass 5: Management Screen Fixes

**Branch:** `rebuild/v0.2`
**Session type:** Low risk. UI only. No logic changes. No API changes.

---

## Context

WAV-e is a coaching intelligence layer for an EMS studio built on Next.js 14 (App Router, TypeScript, Tailwind CSS) with Supabase as the backend. All UI copy is in Dutch.

This is Pass 5 of an 8-pass rebuild. Two fixes to the management screen, plus one carry-over cleanup from Pass 4.

---

## Fix 1 — Button spacing in member rows

**Problem:** On the management screen, the "actie" and "deactiveren" buttons in member rows are too close together. On a tablet (iPad Safari) this causes accidental taps.

**Fix:**
- Minimum gap of `16px` between the two buttons
- Both buttons must meet the `44px` minimum touch target height
- Use `gap` on the button container, not margin on individual buttons
- Verify the fix holds in both portrait and landscape orientation at 768px viewport width

### Step 1 — Read before writing

Read `src/app/management/page.tsx`. Find the member row component and the button container. Understand the current layout before changing anything.

### Step 2 — Apply spacing fix

Add `gap-4` (16px) to the button container. If the container is not a flex or grid element, make it one. Do not change button labels, colors, or click handlers.

---

## Fix 2 — Minimum touch targets on management screen

**Problem:** Interactive elements on the management screen may not meet the 44px minimum touch target required for reliable tablet use.

**Fix:** Audit every interactive element on `src/app/management/page.tsx` and confirm each meets:
- `min-height: 44px`
- `min-width: 44px` where applicable (icon buttons, small controls)

Apply `min-h-[44px]` via Tailwind where missing. Do not change visual styling beyond what is needed for the touch target.

---

## Fix 3 — Carry-over from Pass 4: actie card "0d" counter

**Problem:** Overdue actie cards currently show both `VERLOPEN` and a `0d` days-remaining counter simultaneously. This is contradictory.

**Fix:** In the actie card rendering (trainer dashboard, `src/app/trainer/[trainerId]/page.tsx`):
- If the actie is overdue (deadline in the past + status `open`): show `VERLOPEN` only, hide the days-remaining counter
- If the deadline is today: show `Vandaag` in amber, no counter
- If the deadline is in the future: show the days-remaining counter as currently implemented
- If status is `afgerond`: show nothing

This is a conditional render change only. Do not touch the overdue detection logic from Pass 4.

---

## Constraints

- Do not change any business logic, API routes, or DB writes
- Do not change stoplight logic
- Use CSS tokens from `globals.css` for all colors — no new hardcoded hex values
- Dutch UI copy only

---

## Output

After all changes are made, produce a summary:

1. Confirm button spacing fix — describe the gap applied and container type
2. Confirm touch target audit — list any elements that needed fixing
3. Confirm `0d` counter fix — describe the conditional render logic applied
4. Any other issues noticed but not changed (flag only, do not fix)

Then stop. Do not proceed to Pass 6.

---

## Gate

After this pass:
1. `npm run build` zero errors
2. Deploy to Vercel
3. Open management screen — verify button spacing in member rows
4. Open management screen in browser dev tools at 768px width — verify no accidental tap zones
5. Log in as trainer — verify overdue actie cards show `VERLOPEN` only, no `0d`

---

*WAV-e Rebuild Plan | Serendipity Projects | Mei 2026*
