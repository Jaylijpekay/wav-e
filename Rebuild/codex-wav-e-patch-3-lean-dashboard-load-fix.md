# Codex Prompt — WAV-e Patch 3: Lean Dashboard Load Fix

## WHERE THIS PATCH SITS

This is the third Codex prompt in the WAV-e cleanup sequence:

1. **Hard Audit**
   - Codex inspected the repo without editing.
   - Conclusion: app is salvageable without a rewrite.
   - Main issues: wildgrown route structure, broad dashboard data loading, giant client pages, hidden global fetches.

2. **Patch 1 — Route Sanity + Dead Flow Cleanup**
   - Fixed broken trainer redirect from `/` to missing `/leden`.
   - Removed broken fallback navigation to `/leden`.
   - Removed visible `/nieuw-lid` placeholder exposure.
   - Replaced empty `/nieuw-lid` page with redirect.
   - Left `src/app/admin/trainers/route.ts` alone because no caller was found and touching it would increase blast radius.

3. **Patch 2A — Dashboard Load Reduction Assessment**
   - Codex inspected slow-load candidates without editing.
   - Conclusion: stop auditing and implement two concrete improvements:
     - Lazy-load `AdminBar` dropdown data.
     - Reduce management dashboard payload where safely possible.

This prompt is the execution patch after Patch 2A.

Do not re-audit the repo.

---

## ROLE

You are a senior full-stack engineer applying a small, gated performance patch to a fully vibe-coded Next.js/Supabase repo.

The app works and builds. The goal is not perfection. The goal is to reduce obvious load waste without triggering a refactor spiral.

Be surgical.

---

## HARD RULES

Do not redesign the app.

Do not refactor dashboards broadly.

Do not split giant page files.

Do not introduce a new state manager.

Do not change Supabase schema, RPCs, RLS, or migrations.

Do not change auth behavior.

Do not change console behavior.

Do not change evaluation save behavior.

Do not change route guards.

Do not touch `src/proxy.ts`.

Do not touch `src/app/admin/trainers/route.ts`.

Do not create a new design system.

Do not do another broad assessment.

Only implement the scoped changes below.

---

## PATCH OBJECTIVE

Reduce avoidable dashboard/page-load work while preserving visible behavior.

Implement only these two changes:

1. Lazy-load `AdminBar` dropdown data.
2. Shape the management dashboard payload only if it can be done safely and without a large rewrite.

---

# CHANGE 1 — Lazy-load AdminBar dropdown data

## File

```text
src/app/components/AdminBar.tsx
```

## Current problem

Patch 2A found that `AdminBar` is mounted globally from `src/app/layout.tsx`.

For admin users, it currently fetches active `leden` and `trainers` on mount, even though those lists are only needed if the admin opens the relevant dropdown/search.

This creates hidden global load.

## Required behavior

Keep the existing admin visibility/auth check.

But:

- Do **not** fetch all active leden on page mount.
- Do **not** fetch all trainers on page mount.
- Fetch leden only when the leden dropdown/search is opened.
- Fetch trainers only when the trainer dropdown/search is opened.
- Cache each result in component state after first successful load.
- Add separate loading state if needed.
- Preserve the existing UI and navigation behavior.
- Preserve the existing selected routes/links.
- Keep the existing fields unless narrowing is trivially safe.

## Non-goals

- No auth changes.
- No layout changes.
- No visual redesign.
- No new API routes.
- No new shared data layer.
- No global cache.

## Acceptance criteria

- AdminBar still appears for admins.
- Non-admins do not see AdminBar.
- Opening the leden dropdown still shows/navigates to leden.
- Opening the trainer dropdown still shows/navigates to trainers.
- Leden and trainers are fetched at most once per page lifetime unless existing behavior already refetches intentionally.
- Initial page load for admins no longer fetches leden/trainers purely because AdminBar mounted.

---

# CHANGE 2 — Management dashboard payload shaping, only if small

## Files

```text
src/app/api/management/data/route.ts
src/app/management/page.tsx
```

## Current problem

Patch 2A found that `/api/management/data` likely sends too much historical data:

- all `contact_momenten`
- all `evaluaties`

The management page then scans these arrays client-side to find only the latest contact/evaluation per lid.

That means the page ships and processes historical data it does not need for the dashboard.

## Required behavior

Attempt a small safe reduction:

- API should return only the latest contact/evaluation data needed per lid.
- The management page should keep the same visible behavior.
- Stoplight/status behavior must remain identical.
- Trainer stats must remain identical.
- Member list, stopped list, and counts must remain identical.

## Preferred approach

If the current code already maps leden into enriched member objects, move the latest contact/evaluation enrichment closer to the API response.

Return a shape that lets the page avoid scanning all historical `contact_momenten` and `evaluaties`.

Only do this if the diff stays small and understandable.

## Hard stop

If this requires a large rewrite of `src/app/management/page.tsx`, stop after Change 1 and report why.

Do **not** force it.

## Non-goals

- Do not split `management/page.tsx`.
- Do not redesign management UI.
- Do not change mutations.
- Do not change stopped-member behavior.
- Do not change PIN handling.
- Do not change add-member behavior.
- Do not change action semantics.
- Do not change schema/RLS/RPCs.
- Do not create database views.
- Do not optimize every dashboard calculation.
- Do not touch trainer dashboard yet.
- Do not touch member dossier waterfalls yet.

## Acceptance criteria if implemented

- Management dashboard still renders.
- Member rows still show the same names/status/trainer assignment.
- Stoplight totals remain consistent.
- Trainer stats remain consistent.
- Stopped members still appear where expected.
- Open action counts remain consistent.
- The API no longer returns full historical contact/evaluation arrays if only latest values are needed.

---

## REQUIRED COMMANDS

Before editing:

```bash
git status --short --untracked-files=all
```

After editing:

```bash
npm run build
npm run lint
npx tsc --noEmit
```

Also run targeted searches as needed:

```bash
rg "AdminBar" src
rg "contact_momenten|evaluaties" src/app/api/management src/app/management
rg "laatste|latest|contact|evaluatie" src/app/api/management src/app/management
```

---

## OUTPUT FORMAT

Report only this:

## Patch 3 Implementation Report

### 1. Files Changed

List each changed file with 1–2 bullets.

### 2. What Changed

Separate:

- AdminBar lazy-loading
- Management payload shaping

If management payload shaping was not implemented, explain clearly why it was stopped.

### 3. What Was Intentionally Not Changed

Be explicit.

### 4. Verification Results

Include:

- build
- lint
- typecheck

### 5. Remaining Risk

Mention only real risks from this patch.

No broad audit tables.

No Patch 4 planning.

No extra recommendations unless a hard blocker was found.
