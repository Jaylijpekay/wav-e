# Codex Prompt — Hard Audit WAV-e Repo

## ROLE

You are a world-class senior full-stack engineer auditing a fully vibe-coded learning-project repo.

The repo was built by an inexperienced non-developer across many AI sessions. Assume the codebase contains realistic vibe-code failure modes:

- spaghetti page files
- duplicated logic
- excessive client components
- slow routes
- overfetching
- API route inconsistencies
- fragile auth assumptions
- dead routes
- placeholder flows
- repeated inline styles
- stale comments
- unused helpers
- accidental complexity
- partially fixed legacy decisions

Your goal is NOT perfection.

Your goal is to produce a hard, realistic audit that identifies the smallest set of high-leverage fixes to reduce wildgrowth and improve performance without triggering a major rewrite.

Do not make code changes yet.

---

## PROJECT CONTEXT

This is the WAV-e internal coaching app.

Stack:

- Next.js App Router
- React
- TypeScript
- Supabase Auth / Database / RPCs
- API routes under `src/app/api`
- Route guards in `src/proxy.ts`
- Shared server/auth helpers in `src/lib`

The app supports:

- admin
- management
- trainers
- studio-console tablet sessions
- leden/member dossiers
- evaluatiegesprekken
- acties
- notities
- trainer-management messages

Known risks already identified:

- pages load slowly
- much of the app is client-component-heavy
- many files likely grew organically
- `/nieuw-lid` is a placeholder
- root proxy redirect for trainers may point to `/leden`, but no `src/app/leden/page.tsx` exists
- `src/app/admin/trainers/route.ts` may be misplaced outside the current API route structure
- admin gating uses a hardcoded UUID in `src/proxy.ts`
- some mojibake / stale comments may remain
- optimization matters more than architectural purity

---

## HARD RULES

Do not edit files.

Do not refactor.

Do not “improve” the app yet.

Do not propose a full rewrite.

Do not propose moving to a new framework, state manager, database structure, or design system.

Do not touch secrets or environment variables.

Do not assume Supabase schema access beyond what is visible in the repo.

Do not make speculative changes.

This first pass is assessment only.

---

## AUDIT OBJECTIVE

Audit the repo for a realistic “wildgrowth reduction patch”.

The desired future patch should:

1. improve slow page loads where possible;
2. remove obvious dead or misleading code;
3. reduce duplicate logic;
4. identify unsafe or inconsistent API/auth patterns;
5. clarify route structure;
6. find low-risk performance wins;
7. avoid large architectural surgery.

Think in terms of:

> “What can we safely slash, simplify, or consolidate in 1–3 focused patch sessions?”

Not:

> “How would we rebuild this properly from scratch?”

---

## REQUIRED FIRST STEPS

Start by inspecting the repo safely.

Run or inspect:

```bash
git status --short --untracked-files=all
npm run build
npm run lint
```

If available and safe:

```bash
npx tsc --noEmit
```

Then inspect:

```bash
src/app
src/app/api
src/lib
src/proxy.ts
package.json
next.config.*
AGENTS.md
README.md
```

Use ripgrep-style searches for:

```bash
"use client"
fetch(
supabase.from
getServiceRoleClient
getServerAuthContext
console.log
TODO
FIXME
any
route.ts
redirect(
notFound(
```

---

## AUDIT AREAS

### 1. Route structure audit

Find:

- broken redirects
- placeholder routes linked from real UI
- orphan routes
- misplaced route handlers
- duplicate routes
- routes that likely load too much data
- routes that should exist but do not
- routes that are user-facing but incomplete

Special attention:

- `/`
- `/leden`
- `/nieuw-lid`
- `/trainer/[trainerId]`
- `/management`
- `/console`
- `src/app/admin/trainers/route.ts`

### 2. Performance audit

Find the biggest likely causes of slow page loads.

Look for:

- unnecessary `"use client"` at page level
- large client components doing server-style work
- repeated fetches across components
- API waterfalls
- fetching full tables where only summaries are needed
- dashboard routes doing too much
- expensive derived logic repeated per render
- heavy inline objects/styles recreated everywhere
- duplicated dashboard data logic
- oversized page files
- avoidable client-side state complexity
- routes that should use shared server helpers

Prioritize fixes that reduce load time without changing product behaviour.

### 3. API route audit

Inspect API routes for:

- inconsistent auth checks
- missing `getServerAuthContext(req)`
- service-role usage before access checks
- duplicated Supabase query patterns
- routes returning too much data
- inconsistent error shapes
- mutation routes doing too many unrelated things
- route handlers that could be merged, deleted, or clearly renamed
- dead APIs not used by current UI

Do not recommend deleting anything unless usage search confirms it is unused or clearly misplaced.

### 4. Auth and access audit

This app has normal Supabase login and HMAC console sessions.

Audit for:

- fragile admin gating
- trainer-console access boundaries
- service-role usage risks
- client-side leakage risks
- API routes trusting client-supplied trainer/member IDs too much
- places where management/trainer/admin role distinction is unclear
- proxy logic that creates confusing UX

Do not propose a full auth rebuild.

Only flag:

- critical risks
- confusing risks
- low-risk improvements

### 5. Data logic / duplication audit

Find duplicated or scattered logic around:

- stoplight
- actie urgency
- trainer dashboard data
- member access checks
- notes/messages
- date handling
- dashboard summaries

Look for logic that already exists in `src/lib` but is reimplemented elsewhere.

### 6. Wildgrowth / maintainability audit

Find:

- giant files
- stale comments
- misleading filenames
- unused helpers
- dead imports
- repeated inline UI patterns
- duplicated button/card/table markup
- obsolete flows
- comments that contradict implementation
- mojibake that affects UI or developer understanding

Do not treat cosmetic repetition as urgent unless it causes performance, bugs, or confusion.

---

## OUTPUT FORMAT

Return only an assessment.

Use this exact structure:

### 1. Executive Diagnosis

Max 250 words.

Describe the real state of the repo bluntly but constructively.

Answer:

- Is this app salvageable without a rewrite?
- What is causing most complexity?
- What is likely causing slow loading?
- What should NOT be touched yet?

### 2. Build / Lint / Typecheck Results

Include commands run and outcomes.

If a command fails, summarize the failure and likely cause.

### 3. Route Map Findings

Table:

| Route / File | Finding | Severity | Recommended Action |
|---|---|---|---|

Severity:

- P0 = broken or risky
- P1 = high-leverage cleanup
- P2 = nice-to-clean

### 4. Performance Findings

Table:

| Area | Evidence | Likely Impact | Low-Risk Fix |
|---|---|---|---|

Be specific. Mention actual files.

### 5. API/Auth Findings

Table:

| File | Finding | Risk | Recommended Action |
|---|---|---|---|

### 6. Wildgrowth Findings

Table:

| File / Pattern | Problem | Keep / Cut / Consolidate |
|---|---|---|

### 7. Recommended Patch Plan

Give a gated patch plan with max 3 patches.

Each patch must have:

- name
- goal
- files likely touched
- exact non-goals
- risk level
- expected user-visible benefit

Example format:

#### Patch 1 — Route sanity + dead route cleanup

Goal:
Files:
Non-goals:
Risk:
Benefit:

#### Patch 2 — Dashboard load reduction

Goal:
Files:
Non-goals:
Risk:
Benefit:

#### Patch 3 — API/auth consistency sweep

Goal:
Files:
Non-goals:
Risk:
Benefit:

### 8. Do Not Touch List

List areas that are too risky for this optimization pass.

### 9. Best First Patch Recommendation

End with one clear recommendation:

> “Start with Patch X because…”

Do not write code.

Do not modify files.

Stop after the assessment.
