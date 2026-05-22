# WAV-e Rebuild — Pass 4: Acties Deadline Display

**Branch:** `rebuild/v0.2`
**Session type:** Low risk. UI only. No logic changes. No API changes.

---

## Context

WAV-e is a coaching intelligence layer for an EMS studio built on Next.js 14 (App Router, TypeScript, Tailwind CSS) with Supabase as the backend. All UI copy is in Dutch.

This is Pass 4 of an 8-pass rebuild. Three UI fixes to the acties display in the trainer dashboard:

1. Surface the `deadline` field on every actie card
2. Sort members by most recent/urgent actie
3. Add a visual overdue state — deadline passed + status still open

---

## DB schema reference

`acties` table columns relevant to this pass:

```
id
lid_id          -- nullable, links to leden
trainer_id
type            -- 'resize' | 'foto' | 'evaluatie' | 'eiwittenlijst' | 'custom'
status          -- 'open' | 'afgerond' | 'overdue'
bron            -- 'manual' | 'auto' | 'management'
deadline        -- date string (ISO), nullable
omschrijving    -- free text description
aangemaakt_op   -- timestamp
```

---

## Instructions

### Step 1 — Read before writing

Read the current actie card rendering in `src/app/trainer/[trainerId]/page.tsx`. Understand the current card structure, what fields are already displayed, and how acties are currently grouped or sorted per member.

Also read `src/app/trainer/[trainerId]/leden/page.tsx` — confirm whether acties are rendered there too and apply the same fixes if so.

### Step 2 — Surface deadline on every actie card

Every actie card must show the `deadline` field. Display rules:

- If `deadline` is null: show nothing (no empty label, no dash)
- If `deadline` is in the future and status is `open`: show date in neutral style — `Deadline: DD MMM` (Dutch month abbreviation: jan, feb, mrt, apr, mei, jun, jul, aug, sep, okt, nov, dec)
- If `deadline` is today: show `Vandaag` in amber
- If `deadline` is in the past and status is `open`: overdue state (see Step 4)
- If status is `afgerond`: do not show deadline — actie is done

Format the date as `DD MMM` using the Dutch abbreviations above. Do not use a date library — compute from the ISO string directly.

### Step 3 — Sort members by most urgent actie

In the trainer dashboard, members are currently listed in some default order. Change the sort so that:

- Members with at least one overdue open actie (deadline past, status `open`) appear first
- Then members with at least one open actie with a deadline today or in the next 7 days
- Then members with other open acties
- Then members with no open acties

Within each group, sort alphabetically by member name.

This sort runs on the already-fetched data — do not add a new DB query.

### Step 4 — Overdue visual state

An actie is overdue when: `deadline` is not null AND `deadline` is in the past AND `status` is `open`.

Note: the DB has a `status` value of `'overdue'` but do not rely on it being set correctly — compute overdue state from the deadline date at render time. This is read-only display logic, do not write back to the DB.

Overdue actie card visual:
- Left border or badge in `var(--color-stoplight-rood)` (use the token from Pass 2)
- Label: `Verlopen` in rood
- Do not hide or disable the actie — it remains actionable

### Step 5 — Verify data is being fetched

Before rendering, confirm the `deadline` field is included in the Supabase select query for acties. If it is not, add it. Do not change anything else about the query.

---

## Constraints

- Do not change any business logic, API routes, or DB writes
- Do not change the stoplight logic — that is done in Pass 3
- Do not add new DB queries — sort and filter on already-fetched data
- Use CSS tokens from `globals.css` for all colors — no new hardcoded hex values
- Dutch UI copy only — no English labels

---

## Output

After all changes are made, produce a summary:

1. Confirm deadline is visible on actie cards — describe the display format used
2. Confirm sort order is applied — describe the four tiers
3. Confirm overdue visual state — describe what it looks like
4. Confirm `deadline` field was present in the fetch query (or note that you added it)
5. Confirm whether `trainer/[trainerId]/leden/page.tsx` also needed changes and what was done

Then stop. Do not proceed to Pass 5.

---

## Gate

After this pass:
1. `npm run build` zero errors
2. Deploy to Vercel
3. Log in as trainer
4. Confirm actie cards show deadline date in correct format
5. Confirm members with overdue acties appear at the top
6. Confirm overdue acties are visually distinct

---

*WAV-e Rebuild Plan | Serendipity Projects | Mei 2026*
