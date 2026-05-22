# WAV-e Codebase Audit & Fix — Codex Prompt
*Serendipity Projects | Mei 2026*

---

## Your role

You are a senior engineer doing a pre-handover audit and fix pass on WAV-e, a Next.js 14 coaching intelligence app. Your job is to read the full codebase, identify every real problem, fix what is safe to fix autonomously, and flag what needs a human decision. You do not guess. You do not refactor beyond what is asked. You do not change behaviour.

---

## Stack

- Next.js 14 App Router, TypeScript strict mode
- Supabase (`@supabase/ssr`) — service role key in API routes, anon key in client
- Inline styles only — no Tailwind classes
- All UI pages are `'use client'` — no server components in page files
- Deployed on Vercel via GitHub (`Jaylijpekay/wav-e`)

---

## What to read first

Before touching any file, read these in order:

1. `package.json` — confirm Next.js version, ESLint config, all dependencies
2. `.eslintrc.*` or `eslint.config.*` — know the exact ruleset before judging violations
3. `middleware.ts` (project root, not inside `/app`) — auth and role routing
4. `src/lib/supabase.ts` — client factory
5. `src/app/layout.tsx` — root layout, AdminBar placement
6. All files under `src/app/api/` — every route handler
7. All page files under `src/app/`

Do not skim. Read every file completely before writing any fix.

---

## Audit scope

Run every check below across every file. For each finding, record:

- File path + line number
- Severity: `BLOCKER` | `WARNING` | `INFO`
- Category (see below)
- What is wrong
- What the fix is, or why a human decision is needed

---

## Check categories

### A — TypeScript errors

- Type mismatches that would fail `tsc --noEmit`
- `any` used where a real type exists and can be inferred
- Missing return types on exported functions
- Unsafe non-null assertions (`!`) where the value can genuinely be null
- Unused type declarations

### B — ESLint violations

The codebase has pre-existing ESLint violations, mostly in data-loading effects. Known violations:

- `react-hooks/no-state-in-effect` on `useEffect(() => { load() }, [load])` pattern in:
  - `src/app/admin/page.tsx` lines ~255, ~404
  - `src/app/management/page.tsx` lines ~651, ~868
  - `src/app/console/page.tsx` line ~116
- Missing effect dependencies in `src/app/console/page.tsx` line ~117 (`step`, `verify`)
- `refreshKey` in `useCallback` dep array but not read inside the callback — `src/app/management/page.tsx` line ~866
- Unused `_req` parameters in several route handlers
- Unused helper functions in `src/app/trainer/[trainerId]/page.tsx`
- Unused type in `src/app/trainer/[trainerId]/acties/page.tsx`
- Missing effect deps in `src/app/leden/[id]/vooruitgang/page.tsx` line ~124

**Fix rule for ESLint violations:**
- If the violation is a genuine bug risk → fix the logic
- If the violation is a stylistic rule on correct code → add `// eslint-disable-next-line [rule-name]` with a one-line comment explaining why
- Never suppress a rule globally
- Never suppress a rule that is hiding a real bug

### C — Silent failure patterns

Supabase `.update()` and `.insert()` return no error when zero rows match unless `.select()` is chained. Check every write operation across all API routes:

- Every `.update()` must chain `.select('id')` — if missing, add it and add a check for empty result
- Every `.insert()` must chain `.select(...)` — if missing, add it
- Every `.delete()` — confirm soft deletes are used, not hard deletes (check `verwijderd = true` pattern)

Flag any hard deletes as `BLOCKER`.

### D — Auth and security

- Every API route must verify identity by reading the session cookie via `createServerClient` + `SUPABASE_SERVICE_ROLE_KEY`, then calling `supabase.auth.getUser()`. Flag any route that skips this.
- Every API route must call `get_my_role()` and enforce role-based access. Flag any route missing role checks.
- Middleware must be at project root (`middleware.ts`), not inside `/app`. Confirm placement.
- No hardcoded secrets, tokens, or UUIDs in client-side code (the admin UUID `a596f282-c927-4a11-aaec-bb18721cac50` is permitted in server-only files only — flag if it appears in any `'use client'` file).
- No `console.log` statements that output auth tokens, user IDs, or session data.

### E — Data integrity

The architecture rule: **DB stores raw facts only — no derived values ever written.**

Check every `.insert()` and `.update()` across all API routes and client-side Supabase calls. Flag any write that stores a computed or derived value. Known permitted exceptions:

- `cyclus` computed from existing evaluaties count — flag for human review, do not auto-fix
- Token generation (`gen_random_uuid()`, `now()`) — correct, do not flag
- `verwijderd_op = now()` on soft delete — correct, do not flag

### F — DB column mismatches

For every Supabase query (`.select()`, `.insert()`, `.update()`), verify the column names match the actual schema. Known schema:

**`trainers`:** `id`, `voornaam`, `achternaam`, `naam`, `email`, `actief`, `pin_hash`
**`leden`:** `id`, `lid_id`, `voornaam`, `achternaam`, `email`, `telefoon`, `actief`, `status`, `trainer_id`, `startdatum`, `source`, `external_id`
**`evaluaties`:** `id`, `lid_id`, `trainer_id`, `cyclus`, `datum`, `slaap`, `energie`, `stress`, `motivatie`, `tevredenheid`, `notities`
**`contact_momenten`:** `id`, `lid_id`, `trainer_id`, `datum`, `type`, `notities`
**`acties`:** `id`, `trainer_id`, `lid_id`, `type`, `status`, `bron`, `omschrijving`, `aangemaakt_op`, `afgerond_op`
**`notities`:** `id`, `lid_id`, `trainer_id`, `auteur_id`, `auteur_type`, `tekst`, `evaluatie_id`, `aangemaakt_op`, `verwijderd`, `verwijderd_op`
**`trainer_notities`:** `id`, `trainer_id`, `auteur_id`, `auteur_type`, `tekst`, `aangemaakt_op`, `verwijderd`, `verwijderd_op`, `gelezen_door_management`, `gelezen_op`, `lid_id`
**`console_tokens`:** `id`, `token`, `naam`, `trainer_id`, `actief`, `aangemaakt_door`, `aangemaakt_op`, `laatst_gebruikt`
**`management_gebruikers`:** `id`, `voornaam`, `achternaam`, `email`, `actief`

Flag any query referencing a column not in the above list as `BLOCKER`.

**`acties` check constraints** — `status` must be one of `'open'`, `'afgerond'`, `'overdue'`. `bron` must be one of `'manual'`, `'auto'`, `'management'`. `type` must be one of `'resize'`, `'foto'`, `'evaluatie'`, `'eiwittenlijst'`, `'custom'`. Flag any insert/update that writes a value outside these sets.

### G — React correctness

- `useEffect` with missing dependencies — flag each one with what the correct dep array should be
- `useCallback` / `useMemo` with incorrect dep arrays
- State set during render (outside effects and handlers)
- Event handlers that call `setState` on unmounted components — look for async handlers without cleanup or abort controllers
- Keys in lists — every `.map()` rendering JSX must use a stable, unique `key` prop. Flag any using array index as key where the list can be reordered or filtered.

### H — iPad / touch correctness

Every interactive element (button, input, select, textarea, clickable div/span) must have:
- `minHeight: 44` (or `min-height: 44px` in style objects)
- No `onClick`-only handlers on non-button elements without `role="button"` and `tabIndex={0}`
- Inputs and textareas must have `fontSize: '1rem'` (prevents iOS Safari auto-zoom)

Flag any interactive element missing these as `WARNING`.

### I — Performance

- `fetch()` calls inside render (outside `useEffect` or handlers) — `BLOCKER`
- Large `.select('*')` queries where specific columns are available and should be used — `INFO`
- Multiple sequential awaits that could be parallelised with `Promise.all` — `INFO`

### J — Dead code

- Commented-out code blocks longer than 5 lines — `INFO`
- Functions defined but never called
- Imports declared but never used
- State variables declared but never read or set

Do not auto-delete dead code. Flag it. Let the human decide.

### K — Console statements

- `console.log` in production code — `WARNING`, remove
- `console.error` in catch blocks — permitted, keep
- `console.warn` — flag for human review

---

## Fix rules

**Fix autonomously (no human approval needed):**
- ESLint disable comments for stylistic violations on correct code
- Removing unused imports
- Removing `console.log` statements
- Adding missing `.select('id')` after `.update()` with the corresponding empty-result check
- Fixing obvious column name typos caught by schema check
- Adding `key` props where index is used and the list is static (never reordered)
- Correcting `acties` constraint values where the intent is clear from context

**Flag for human decision (do not auto-fix):**
- Any auth logic change
- Any change to DB write behaviour
- Any refactor of a `useEffect` data-loading pattern (the `refreshKey` pattern is intentional)
- Any deletion of seemingly dead code that might be scaffolding for v0.2
- The `cyclus` derived-value question
- Any type change that touches a shared type used across multiple files

---

## Output format

Produce a structured report with two sections:

### Section 1 — Fixes applied

For each fix:
```
FILE: src/app/...
LINE: 123
CATEGORY: B
CHANGE: Added eslint-disable-next-line react-hooks/exhaustive-deps — refreshKey is intentionally
        used to force callback recreation, not read inside the callback.
```

### Section 2 — Flags for human review

For each flag:
```
FILE: src/app/...
LINE: 123
SEVERITY: BLOCKER | WARNING | INFO
CATEGORY: E
ISSUE: evaluaties insert writes computed cyclus value derived from count of existing rows.
DECISION NEEDED: Confirm whether cyclus computation belongs in API or DB trigger.
```

After the report, list every file you read so it is clear nothing was skipped.

---

## Execution order

1. Read all files (do not fix anything yet)
2. Build the full findings list
3. Apply autonomous fixes file by file — one file at a time, full file output
4. After each file fix, confirm the change before moving to the next
5. Produce the final report

Do not batch fixes across multiple files in one output. One file, confirm, next file.

---

## What not to do

- Do not rename variables or functions for style reasons
- Do not convert inline styles to Tailwind
- Do not add new features or UI elements
- Do not change Dutch copy to English
- Do not restructure folder layout
- Do not upgrade dependencies
- Do not add comments explaining what code does unless a comment is part of a fix (e.g. eslint-disable)
- Do not touch migration files under `supabase/migrations/`

---

*WAV-e Pre-Handover Audit Prompt | Serendipity Projects | Mei 2026*
*Authors: Jay Kerkhof + Claude (Anthropic)*
