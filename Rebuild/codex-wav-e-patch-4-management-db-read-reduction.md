# Codex Prompt — WAV-e Patch 4: Management DB Read Reduction

## WHERE THIS PATCH SITS

This is Patch 4 in the WAV-e cleanup sequence.

Previous work:

1. **Hard Audit**
   - Repo is salvageable without a rewrite.
   - Main issues: wildgrown routes, broad dashboard payloads, giant client pages, hidden global fetches.

2. **Patch 1 — Route Sanity**
   - Fixed trainer redirect away from missing `/leden`.
   - Removed broken fallback nav to `/leden`.
   - Removed visible `/nieuw-lid` placeholder exposure.

3. **Patch 2A — Dashboard Load Assessment**
   - Identified management dashboard payload and AdminBar eager fetches as the best first performance targets.

4. **Patch 3 — Lean Dashboard Load Fix**
   - `AdminBar` now lazy-loads dropdown data.
   - `/api/management/data` enriches leden server-side with latest contact/evaluation fields.
   - `/management` no longer receives full historical `contact_momenten` and `evaluaties`.
   - Build/lint/typecheck passed.
   - Remaining risk: the API still reads full historical contact/evaluation tables server-side before collapsing them.

This patch targets only that remaining risk.

---

## IMPORTANT SUPABASE FACTS FROM SCHEMA CHECK

Claude/Supabase schema check confirmed:

1. Foreign keys exist:
   - `contact_momenten.lid_id -> leden.id`
   - `evaluaties.lid_id -> leden.id`

2. Indexes:
   - Separate indexes exist on `lid_id` and `datum` for both `contact_momenten` and `evaluaties`.
   - No composite `(lid_id, datum)` index.
   - This is acceptable at current scale.

3. Current test row counts:
   - `leden`: 16
   - `contact_momenten`: 0
   - `evaluaties`: 1

4. Embedded PostgREST selects are technically possible because FKs exist.

5. However:
   - PostgREST embedded `order + limit(1)` per related row is not reliable enough to depend on here.
   - Do not use embedded selects as the core optimization.

6. Safest option without migrations/RPCs/views:
   - Fetch leden flat.
   - Extract relevant lid ids.
   - Fetch `contact_momenten` once, filtered to relevant lid ids.
   - Fetch `evaluaties` once, filtered to relevant lid ids.
   - Sort/collapse latest per lid in Node.
   - Total: three relevant queries, not N+1.

That is the target for this patch.

---

## ROLE

You are a senior full-stack engineer applying a small, gated backend performance patch.

Be surgical.

The goal is not to redesign the dashboard. The goal is to reduce database read volume for `/api/management/data` safely, without schema or auth changes.

---

## HARD RULES

Do not redesign the app.

Do not refactor dashboards.

Do not split page files.

Do not change UI behavior.

Do not change Supabase schema.

Do not add migrations.

Do not add RPCs.

Do not add views.

Do not change RLS.

Do not change auth behavior.

Do not change console behavior.

Do not change evaluation save behavior.

Do not touch `src/proxy.ts`.

Do not touch `src/app/admin/trainers/route.ts`.

Do not introduce N+1 queries per member.

Do not replace one broad read with dozens/hundreds of per-lid reads.

Do not depend on unreliable embedded `order + limit(1)` behavior.

Do not add dependencies.

Do not do a broad audit.

Only touch the management data path if the optimization is safe.

---

## PATCH OBJECTIVE

Reduce database read volume in:

```text
src/app/api/management/data/route.ts
```

Current post-Patch-3 state:

- The API returns enriched leden with latest contact/evaluation fields.
- But the API likely still queries all historical `contact_momenten` and all historical `evaluaties` server-side, then collapses them in Node.

Desired Patch-4 state:

- Query `leden` first.
- Build the relevant `lid_id` set from those leden.
- Query `contact_momenten` once with `.in("lid_id", relevantIds)`.
- Query `evaluaties` once with `.in("lid_id", relevantIds)`.
- Select only fields needed by the management dashboard.
- Sort/collapse latest contact/evaluation per lid in Node.
- Preserve the exact response shape expected by `src/app/management/page.tsx`.
- Preserve all visible dashboard behavior.

This is a **partial optimization** by design:
- It reduces unrelated historical table reads.
- It avoids N+1.
- It does not require schema/RPC/view work.
- It does not guarantee true DB-level latest-per-lid.

---

## FILES IN SCOPE

Primary:

```text
src/app/api/management/data/route.ts
```

Only if required for type/shape alignment:

```text
src/app/management/page.tsx
```

Do not touch anything else unless absolutely necessary.

---

## REQUIRED INSPECTION BEFORE EDITING

Run:

```bash
git status --short --untracked-files=all
```

Inspect:

```bash
rg "contact_momenten|evaluaties|laatste|latest" src/app/api/management/data/route.ts src/app/management/page.tsx
rg "foreignTable|referencedTable|limit\(" src
rg "contact_momenten\(" src
rg "evaluaties\(" src
```

Open:

```text
src/app/api/management/data/route.ts
src/app/management/page.tsx
```

Understand the current post-Patch-3 response contract before changing anything.

---

## IMPLEMENTATION STRATEGY

### Step 1 — Query leden first

Use the existing leden query/result as the source of truth for which member ids are relevant to the management dashboard.

Do not query unrelated contacts/evaluations for members that are not present in the management dashboard response.

### Step 2 — Build relevant ids safely

From the leden result, build:

```ts
const lidIds = leden.map((lid) => lid.id).filter(Boolean)
```

Use the actual field names/types already present in the file.

If no leden exist:

- skip contact/evaluation queries;
- use empty maps;
- return a valid dashboard payload.

### Step 3 — Query contacts once

Use one query against `contact_momenten`:

- filter with `.in("lid_id", lidIds)`;
- select only fields used for latest-contact enrichment;
- order by `datum` descending if current logic depends on sorted order.

Do not query per lid.

### Step 4 — Query evaluations once

Use one query against `evaluaties`:

- filter with `.in("lid_id", lidIds)`;
- select only fields used for latest-evaluation enrichment:
  - `lid_id`
  - `datum`
  - `slaap`
  - `energie`
  - `stress`
  - `cyclus` if currently used
  - any other field already required by the current management page contract
- order by `datum` descending if current logic depends on sorted order.

Do not query per lid.

### Step 5 — Collapse latest per lid in Node

Because the query is ordered descending by date, build maps:

```ts
const latestContactByLidId = new Map()
const latestEvaluationByLidId = new Map()
```

For each row:

- if map does not already have `lid_id`, set it;
- skip later/older rows.

This preserves current behavior while avoiding unrelated history.

### Step 6 — Preserve response contract

Do not force a management page rewrite.

Keep enriched leden field names stable.

Do not change:

- stoplight behavior
- trainer stats
- member status
- stopped member handling
- open action counts
- PIN behavior
- add-member behavior
- filters/search

---

## ACCEPTANCE CRITERIA

After the patch:

- `npm run build` passes.
- `npm run lint` passes with no new warnings.
- `npx tsc --noEmit` passes.
- `/management` response shape remains compatible.
- No UI behavior changes are introduced.
- `/api/management/data` no longer reads contact/evaluation rows for unrelated leden.
- No N+1 per-member query pattern is introduced.
- No schema/RPC/view/RLS/auth changes are introduced.
- The optimization is reported as **Partial**, not Full.

---

## REQUIRED VERIFICATION

After editing, run:

```bash
npm run build
npm run lint
npx tsc --noEmit
```

Also run targeted searches:

```bash
rg "contact_momenten|evaluaties" src/app/api/management/data/route.ts
rg "for .*await|Promise.all\(.*map" src/app/api/management/data/route.ts
```

Confirm there is no per-member async query loop.

---

## OUTPUT FORMAT

Report only this:

## Patch 4 Implementation Report

### 1. Files Changed

List each changed file with 1–2 bullets.

### 2. What Changed

Separate:

- DB read reduction
- Response contract preservation

### 3. Optimization Level Achieved

Use this exact label unless something unexpected happens:

**Partial:** queries are narrowed to relevant leden/fields, but still collapse history server-side.

Explain briefly.

### 4. What Was Intentionally Not Changed

Be explicit.

### 5. Verification Results

Include:

- build
- lint
- typecheck
- no N+1 query loop confirmation

### 6. Remaining Risk

Mention only real risks from this patch.

No broad audit tables.

No Patch 5 planning.

No extra recommendations unless a hard blocker was found.
