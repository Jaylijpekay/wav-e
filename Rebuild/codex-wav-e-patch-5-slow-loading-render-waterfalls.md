# Codex Prompt — WAV-e Patch 5: Slow Loading Fix — Render + Waterfall Reduction

## WHERE THIS PATCH SITS

This is Patch 5 in the WAV-e cleanup sequence.

Previous work:

1. **Hard Audit**
   - Repo is salvageable without a rewrite.
   - Main issues: wildgrown routes, broad dashboard payloads, giant client pages, hidden global fetches.

2. **Patch 1 — Route Sanity**
   - Fixed broken trainer redirects/navigation.
   - Removed visible `/nieuw-lid` placeholder exposure.

3. **Patch 2A — Dashboard Load Assessment**
   - Identified management dashboard data and AdminBar eager fetches as real speed targets.

4. **Patch 3 — Browser Load Reduction**
   - `AdminBar` now lazy-loads dropdown data.
   - `/management` no longer receives full historical contact/evaluation arrays.
   - Management page consumes enriched leden directly.

5. **Patch 4 — Backend Read Reduction**
   - `/api/management/data` now queries leden first.
   - It only fetches contact/evaluation history for relevant leden.
   - No N+1 queries.
   - No schema/RPC/auth changes.
   - App was manually tested after Patch 4 and everything still works.

Now fix slow loading further.

Do not re-audit from scratch.

---

## ROLE

You are a senior full-stack engineer applying a practical performance patch to a fully vibe-coded Next.js/Supabase app.

The user has confirmed the app still works after Patches 1–4.

Your job is to make the app feel faster without changing behavior, redesigning UI, or starting a refactor spiral.

Be surgical.

---

## HARD RULES

Do not redesign the app.

Do not split giant page files.

Do not introduce a new state manager.

Do not change Supabase schema, RPCs, RLS, migrations, or auth.

Do not change console behavior.

Do not change evaluation save behavior.

Do not touch `src/proxy.ts`.

Do not touch `src/app/admin/trainers/route.ts`.

Do not change data semantics.

Do not change visible dashboard behavior.

Do not add dependencies.

Do not create a new performance framework.

Do not do another broad assessment.

Do not produce a long review.

Implement only targeted slow-loading fixes below.

---

## PATCH OBJECTIVE

Reduce slow loading and sluggish dashboard rendering by targeting three known causes:

1. Repeated expensive client-side calculations in large client pages.
2. Sequential fetch waterfalls on member dossier pages.
3. Avoidable extra initial fetches on trainer dashboard.

This patch should improve perceived speed while keeping the same UI and flows.

---

# CHANGE 1 — Memoize management dashboard derived data

## Files

Primary:

```text
src/app/management/page.tsx
```

## Current problem

Patch 2A found repeated render-time work:

- member filtering/searching
- stopped member filtering
- studio counts
- trainer stats
- PIN lookup mapping
- repeated `.filter()` / `.map()` over `leden`, `trainers`, `acties`, and PIN arrays

Patch 3/4 already improved API data. Now reduce render churn.

## Required behavior

Use `useMemo` for derived values that are currently recalculated on every render.

Candidate values:

- active/stopped/inactive member counts
- filtered visible members
- stopped members list
- trainer stats
- PIN lookup map
- any derived stoplight/stat arrays that are pure functions of state

Keep dependencies correct.

Do not change the visual output.

Do not move logic to new files unless absolutely tiny and obviously safe.

## Non-goals

- No component splitting.
- No UI redesign.
- No API changes unless absolutely required.
- No new helper library.
- No behavior changes.

---

# CHANGE 2 — Memoize trainer dashboard derived data

## Files

Primary:

```text
src/app/trainer/[trainerId]/page.tsx
```

Possibly:

```text
src/lib/trainerData.ts
src/app/api/trainer/[trainer_id]/dashboard/route.ts
```

Only touch API/lib files if there is a very small obvious win.

## Current problem

Patch 2A found trainer dashboard does repeated client work:

- stoplight counts via repeated filters
- dashboard action sorting/filtering
- member/action/message derived arrays
- possible extra initial fetch for trainer messages

## Required behavior

Use `useMemo` for pure derived values recalculated on render.

Candidate values:

- stoplight counts
- dashboard actions
- sorted/open actions
- member dropdown or visible member lists
- any repeated filters/maps over `leden`, `acties`, or messages

If the trainer page separately fetches messages after dashboard data:

- only combine this into dashboard API if the change is very small and obviously safe;
- otherwise leave it alone and only memoize render work.

## Non-goals

- No dashboard redesign.
- No API contract rewrite.
- No message semantics changes.
- No trainer flow changes.
- No splitting page file.

---

# CHANGE 3 — Parallelize obvious member dossier fetches

## Files

Primary:

```text
src/app/leden/[id]/page.tsx
```

Possibly related pages only if tiny and safe:

```text
src/app/leden/[id]/evaluatie/[cyclus]/page.tsx
src/app/leden/[id]/vooruitgang/page.tsx
```

## Current problem

Patch 2A found `/leden/[id]` fetches several resources on load:

- `/api/auth-context`
- `/api/leden/[id]`
- `/api/notities/[id]`
- `/api/acties?lid_id=...`

Some are independent but may currently be sequential or split across effects.

## Required behavior

Reduce waterfall without changing data shape.

Preferred small fix:

- Fetch independent initial resources with `Promise.all`.
- Keep auth-sensitive UI behavior identical.
- Keep notes/actions/member data behavior identical.
- Preserve loading and error states.
- Avoid duplicate refetches.

Only do this if the current code structure makes it safe.

If the page has separate effects for good reason, do not force a rewrite.

## Non-goals

- Do not create a new dossier API.
- Do not merge notes/actions into `/api/leden/[id]`.
- Do not change evaluation pages unless there is a tiny obvious parallel fetch.
- Do not change access rules.
- Do not change mutation/refetch behavior after contact save.

---

## REQUIRED COMMANDS

Before editing:

```bash
git status --short --untracked-files=all
```

Inspect only the relevant files:

```bash
rg "useMemo|useEffect|fetch\(|filter\(|map\(|sort\(" src/app/management/page.tsx
rg "useMemo|useEffect|fetch\(|filter\(|map\(|sort\(" src/app/trainer/[trainerId]/page.tsx
rg "useMemo|useEffect|fetch\(|Promise.all|api/auth-context|api/notities|api/acties|api/leden" src/app/leden/[id]/page.tsx
```

After editing:

```bash
npm run build
npm run lint
npx tsc --noEmit
```

---

## IMPLEMENTATION PRIORITY

Work in this order:

1. Management dashboard `useMemo` fixes.
2. Trainer dashboard `useMemo` fixes.
3. Member dossier fetch parallelization.

Stop after each area if the next area would require broad rewriting.

A small diff that improves the two dashboards is better than a large risky patch.

---

## ACCEPTANCE CRITERIA

After the patch:

- Build passes.
- Lint passes with no new warnings.
- Typecheck passes.
- Management dashboard still shows the same data.
- Trainer dashboard still shows the same data.
- Member dossier still shows the same member, notes, actions, and controls.
- No auth/schema/API behavior changes.
- No broad page splitting.
- No visual redesign.
- No new dependencies.

---

## OUTPUT FORMAT

Report only this:

## Patch 5 Implementation Report

### 1. Files Changed

List each changed file with 1–2 bullets.

### 2. What Changed

Separate:

- Management render optimization
- Trainer render optimization
- Member dossier waterfall reduction

If one area was skipped, say why briefly.

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

No Patch 6 planning.

No general recommendations unless a hard blocker was found.
