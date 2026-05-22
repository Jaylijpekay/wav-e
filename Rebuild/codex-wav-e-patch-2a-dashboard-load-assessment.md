# Codex Prompt — WAV-e Patch 2A: Dashboard Load Reduction Assessment

## ROLE

You are a senior full-stack engineer auditing performance bottlenecks in a fully vibe-coded Next.js/Supabase repo.

The app works and builds. Patch 1 already cleaned obvious route problems. This next pass is about dashboard load reduction, but it must be assessment-first.

Do not edit files yet.

Your job is to inspect the actual data flow behind slow pages and produce a precise, low-risk Patch 2B implementation plan.

The repo was built by a non-developer through many AI sessions. Expect oversized client pages, broad API payloads, duplicated data shaping, hidden global fetches, and client waterfalls.

Your task is optimization, not perfection.

---

## CONTEXT

This is the WAV-e internal coaching app.

Stack:

- Next.js App Router
- React
- TypeScript
- Supabase
- API routes under `src/app/api`
- route guards in `src/proxy.ts`
- shared helpers in `src/lib`

Important current flows:

- management dashboard: `/management`
- trainer dashboard: `/trainer/[trainerId]`
- member dossier: `/leden/[id]`
- evaluation flow: `/gesprek/new`
- admin/global navigation helpers
- console tablet flow

Patch 1 already fixed:

- trainer root redirect to missing `/leden`
- broken `/leden` fallback links
- visible `/nieuw-lid` placeholder exposure
- empty `/nieuw-lid` route

Do not redo Patch 1.

---

## HARD RULES

Do not edit files.

Do not refactor dashboards.

Do not split giant page files yet.

Do not introduce a new state manager.

Do not change Supabase schema, RPCs, RLS, or migrations.

Do not change auth behavior.

Do not change console behavior.

Do not change evaluation save behavior.

Do not redesign UI.

Do not optimize by guessing.

Do not propose a full rewrite.

This pass must end with an assessment and a safe Patch 2B implementation plan.

---

## OBJECTIVE

Find the smallest safe dashboard-load improvements.

The likely best wins are:

1. Shape `/api/management/data` so it returns less unnecessary data.
2. Lazy-load heavy `AdminBar` dropdown data only when needed.
3. Reduce obvious client waterfalls where one page always fetches the same data.
4. Avoid UI extraction until the data path is lighter.

Think like this:

> “What can we reduce without changing what the user sees?”

Not:

> “How do we architect this properly from scratch?”

---

## REQUIRED COMMANDS

Run:

```bash
git status --short --untracked-files=all
npm run build
npm run lint
npx tsc --noEmit
```

Then inspect/search:

```bash
rg "fetch\(" src/app src/lib
rg "useEffect" src/app/management src/app/trainer src/app/leden src/app/components
rg "api/management/data" src
rg "api/trainer" src/app src/lib
rg "api/auth-context" src
rg "AdminBar" src
rg "contact_momenten|evaluaties|acties|notities|trainer_notities|leden|trainers" src/app/api src/lib src/app/management src/app/trainer src/app/leden
```

Open and inspect:

```text
src/app/api/management/data/route.ts
src/app/management/page.tsx
src/app/components/AdminBar.tsx
src/app/components/Navigation.tsx
src/app/api/trainer/[trainer_id]/dashboard/route.ts
src/app/trainer/[trainerId]/page.tsx
src/lib/trainerData.ts
src/app/leden/[id]/page.tsx
src/app/api/leden/[id]/route.ts
```

If files differ from these names, inspect the actual matching routes.

---

## AUDIT AREA 1 — Management Dashboard Payload

For `src/app/api/management/data/route.ts`, answer:

- Which tables are queried?
- Are full rows returned where only counts/summaries are needed?
- Are inactive/stopped members included unnecessarily?
- Are all evaluations/contact moments returned, or only latest relevant ones?
- Are all actions returned, or only open/recent ones?
- Which fields does `src/app/management/page.tsx` actually consume?
- Which fields appear unused?
- What can be safely shaped server-side without changing UI behavior?

Produce a “current payload shape vs used payload shape” summary.

### Required output table

| Dataset | Current Query / Shape | Actually Used By UI | Waste / Risk | Safe Reduction |
|---|---|---|---|---|

---

## AUDIT AREA 2 — Management Page Client Work

For `src/app/management/page.tsx`, answer:

- What derived summaries are calculated client-side?
- Which derived summaries could safely be calculated in the API route?
- Are there repeated filters/maps over the same large arrays?
- Are expensive calculations done on every render?
- Are modals or rarely used workflows causing initial-load cost?
- Are there obvious `useMemo` opportunities that do not change behavior?

Do not recommend splitting the file unless there is a clear low-risk reason.

### Required output table

| Client-Side Work | Evidence | Cost | Safer Location / Fix |
|---|---|---|---|

---

## AUDIT AREA 3 — AdminBar Hidden Global Load

For `src/app/components/AdminBar.tsx`, answer:

- Does it fetch all trainers/leden on mount?
- Does it appear on many pages?
- Is the fetched data only needed when a dropdown/search is opened?
- Can the fetch be lazy-loaded on first open?
- Can the API response be narrowed?
- Can it cache after first fetch inside the component?

This is likely a high-leverage low-risk Patch 2B candidate.

### Required output table

| Current Behavior | Evidence | Impact | Low-Risk Lazy-Load Fix |
|---|---|---|---|

---

## AUDIT AREA 4 — Trainer Dashboard

Inspect:

```text
src/app/api/trainer/[trainer_id]/dashboard/route.ts
src/lib/trainerData.ts
src/app/trainer/[trainerId]/page.tsx
```

Answer:

- What data does the trainer dashboard API return?
- Does it already shape data reasonably?
- Does the page fetch additional data separately after the dashboard fetch?
- Are there client waterfalls?
- Are action/message/member datasets loaded efficiently?
- What can be improved without changing trainer behavior?

### Required output table

| Area | Current Behavior | Likely Impact | Safe Fix |
|---|---|---|---|

---

## AUDIT AREA 5 — Member Dossier Waterfalls

Inspect:

```text
src/app/leden/[id]/page.tsx
src/app/api/leden/[id]/route.ts
```

Also inspect related member pages if relevant:

```text
src/app/leden/[id]/vooruitgang
src/app/leden/[id]/evaluatie/[cyclus]
```

Answer:

- Which fetches happen on page load?
- Are auth-context, member data, notes, actions, evaluations, and contact moments fetched separately?
- Are there obvious parallelization opportunities?
- Should the API route return a complete dossier payload?
- Would this be safe now, or should it wait until after management dashboard optimization?

### Required output table

| Page | Fetch Pattern | Impact | Fix Now / Later |
|---|---|---|---|

---

## AUDIT AREA 6 — Measurement / Verification Options

Without adding dependencies unless already present, identify whether the repo has:

- bundle analyzer
- Next.js build route size output
- API logging
- obvious places to temporarily measure payload size
- browser-side load timings
- existing scripts that help inspect performance

Do not add tooling yet. Just report what is available and what minimal measurement would be safe in Patch 2B.

---

## PRIORITIZATION RULES

Rank findings by this order:

1. High user-visible speed gain
2. Low blast radius
3. Easy to verify with build/lint/typecheck
4. No schema/auth changes
5. No visual/UI behavior changes
6. Small diff

Avoid changes that require deep rewiring.

---

## OUTPUT FORMAT

Return only an assessment.

Use this exact structure:

## Patch 2A Assessment Report

### 1. Executive Summary

Max 250 words.

Answer:

- What is the likely main dashboard bottleneck?
- Is `/api/management/data` the best first target?
- Is `AdminBar` a safe quick win?
- What should not be touched yet?

### 2. Commands Run

List commands and outcomes.

### 3. Management Dashboard Payload Audit

Use table:

| Dataset | Current Query / Shape | Actually Used By UI | Waste / Risk | Safe Reduction |
|---|---|---|---|---|

### 4. Management Page Client Work Audit

Use table:

| Client-Side Work | Evidence | Cost | Safer Location / Fix |
|---|---|---|---|

### 5. AdminBar Global Load Audit

Use table:

| Current Behavior | Evidence | Impact | Low-Risk Lazy-Load Fix |
|---|---|---|---|

### 6. Trainer Dashboard Audit

Use table:

| Area | Current Behavior | Likely Impact | Safe Fix |
|---|---|---|---|

### 7. Member Dossier Waterfall Audit

Use table:

| Page | Fetch Pattern | Impact | Fix Now / Later |
|---|---|---|---|

### 8. Measurement Options

List what can be measured safely before/after Patch 2B.

### 9. Recommended Patch 2B Plan

Give max 3 implementation steps.

Each step must include:

- goal
- files likely touched
- exact non-goals
- risk level
- verification method
- expected user-visible benefit

Suggested structure:

#### Step 1 — Lazy-load AdminBar data

Goal:
Files:
Non-goals:
Risk:
Verification:
Benefit:

#### Step 2 — Shape management dashboard payload

Goal:
Files:
Non-goals:
Risk:
Verification:
Benefit:

#### Step 3 — Reduce one obvious waterfall

Goal:
Files:
Non-goals:
Risk:
Verification:
Benefit:

### 10. Do Not Touch List

List areas too risky for Patch 2B.

### 11. Best First Implementation Recommendation

End with one clear recommendation:

> “Start Patch 2B with Step X because…”

Do not write code.

Do not modify files.

Stop after this assessment.
