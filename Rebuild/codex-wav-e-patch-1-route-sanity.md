# Codex Prompt — WAV-e Patch 1: Route Sanity + Dead Flow Cleanup

## ROLE

You are a senior full-stack engineer applying a small, gated cleanup patch to a fully vibe-coded Next.js/Supabase repo.

The repo is functional but organically grown. Your job is not to perfect it. Your job is to remove obvious broken/misleading route behavior without triggering a broader refactor.

This patch follows the previous audit recommendation:

> Patch 1 — Route Sanity + Dead Flow Cleanup

Goal:
Remove broken/empty navigation paths and misleading routes.

---

## HARD RULES

Do not redesign the app.

Do not refactor dashboards.

Do not touch Supabase schema, RPCs, RLS, or database migrations.

Do not change the console auth model.

Do not change evaluation flow.

Do not introduce a new routing architecture.

Do not move large components around.

Do not create a new design system.

Do not fix dashboard performance yet.

Only touch files needed for this route sanity patch.

Before editing, inspect current usage with search. Do not delete or move anything unless usage is confirmed.

---

## KNOWN AUDIT FINDINGS TO FIX

The audit found these route issues:

1. `src/proxy.ts`
   - Trainer root redirect points to `/leden`.
   - There is no `src/app/leden/page.tsx`.
   - Real trainer flow is `/trainer/[trainerId]`.

2. `/nieuw-lid`
   - `src/app/nieuw-lid/page.tsx` is an empty placeholder.
   - The start page links to it.
   - Real member creation exists via trainer dashboard or management flow.

3. `src/app/components/Navigation.tsx`
   - Fallback trainer navigation links to `/leden`, which does not exist.
   - Trainer member list should route to `/trainer/[trainerId]/leden` when trainerId is known.

4. `src/app/page.tsx`
   - Start page exposes direct trainer selector and placeholder Nieuw lid link.
   - Proxy often redirects authenticated users away anyway.
   - It should not advertise broken or placeholder flows.

5. `src/app/admin/trainers/route.ts`
   - JSON route handler appears under `/admin/trainers`, not `/api/admin/trainers`.
   - Build exposes it as `/admin/trainers`.
   - Confirm whether anything calls it before touching it.

---

## PATCH OBJECTIVE

Make the app stop sending users to missing or empty routes.

The desired result:

- No authenticated trainer should be redirected to `/leden`.
- No visible navigation should link to `/leden` unless a real `/leden` page is intentionally created.
- No visible navigation should send users to an empty `/nieuw-lid` placeholder.
- `/nieuw-lid` should either redirect to an existing real flow or be removed from visible entry points.
- `src/app/admin/trainers/route.ts` should be left alone unless confirmed unused/misplaced and safe to remove or relocate.

Prefer the smallest correct fix.

---

## REQUIRED INSPECTION BEFORE EDITING

Run:

```bash
git status --short --untracked-files=all
npm run build
npm run lint
npx tsc --noEmit
```

Then inspect/search:

```bash
rg "/leden" src
rg "nieuw-lid" src
rg "admin/trainers" src
rg "trainerId" src/proxy.ts src/app/components src/lib
rg "get_my_trainer_id|get_my_role|user_roles|trainers" src/proxy.ts src/lib src/app/api
```

Open and understand:

```text
src/proxy.ts
src/app/page.tsx
src/app/components/Navigation.tsx
src/app/nieuw-lid/page.tsx
src/app/admin/trainers/route.ts
src/lib/serverAuth.ts
src/lib/trainerData.ts
```

Do not edit until you know current callers.

---

## IMPLEMENTATION GUIDANCE

### 1. Fix trainer root redirect

In `src/proxy.ts`, change the trainer redirect away from `/leden`.

Preferred behavior:

- If authenticated user is trainer and trainer id can be safely resolved in proxy:
  - redirect `/` to `/trainer/[trainerId]`
- If trainer id cannot be safely resolved in proxy without risky new logic:
  - redirect to the safest existing trainer route or preserve current flow only after explaining why.
  - Do not invent a fake `/leden` route just to hide the bug.

Use existing patterns already present in the repo. Do not add a heavy new database/auth abstraction in proxy.

### 2. Fix Navigation trainer fallback

In `src/app/components/Navigation.tsx`:

- Remove fallback links to `/leden`.
- If `trainerId` is available, link to:
  - `/trainer/[trainerId]`
  - `/trainer/[trainerId]/leden`
  - `/trainer/[trainerId]/acties`
- If `trainerId` is not available, do not show broken trainer-specific links.
- Do not add new fetch waterfalls unless already present and necessary.

### 3. Fix `/nieuw-lid` exposure

In `src/app/page.tsx` and any navigation:

- Remove visible links/buttons to `/nieuw-lid` if it is still a placeholder.
- Prefer routing users to the real existing add-member flow:
  - trainer dashboard member creation if trainer context exists;
  - management dashboard member creation if management context exists.
- If no safe direct route exists, remove the link and leave member creation inside the existing dashboards.

For `src/app/nieuw-lid/page.tsx`:

Choose the smallest safe option:

Option A, preferred:
- Replace the empty placeholder with a simple redirect to `/` or another real existing route.

Option B:
- Keep a minimal explanatory page that says member creation happens from trainer or management dashboard.
- Include links only to real routes.

Do not build a new member creation UI.

### 4. Audit `src/app/admin/trainers/route.ts`

Do not immediately delete.

First confirm with search:

- Is `/admin/trainers` called anywhere?
- Is there already an equivalent `/api/admin/...` route?
- Does deleting or moving it break build or callers?

If unused and clearly misplaced:
- Prefer delete only if safe.
- Otherwise leave it and add a short comment explaining it is intentionally kept or requires later cleanup.

Do not create a broad API route migration.

---

## ACCEPTANCE CRITERIA

After the patch:

- `npm run build` passes.
- `npm run lint` passes or has no new warnings.
- `npx tsc --noEmit` passes.
- `rg "/leden" src` shows no broken direct navigation to a non-existing `/leden` page.
- `/` no longer redirects trainers to missing `/leden`.
- Visible UI no longer advertises the empty `/nieuw-lid` flow.
- `/nieuw-lid` is no longer an empty `<div />`.
- No auth model, database model, dashboard structure, or console flow is changed.
- The diff is small and explainable.

---

## OUTPUT FORMAT

When done, report:

## Patch 1 Implementation Report

### 1. Commands Run

List commands and outcomes.

### 2. Files Changed

List each changed file with 1–2 bullets explaining why.

### 3. Route Behavior Before / After

Table:

| Area | Before | After |
|---|---|---|

### 4. Usage Search Results

Summarize results for:

- `/leden`
- `nieuw-lid`
- `admin/trainers`

### 5. Risks / Caveats

Mention anything intentionally left alone.

### 6. Verification

Confirm:

- build
- lint
- typecheck
- no new warnings/errors

Do not proceed to Patch 2.
Stop after Patch 1.
