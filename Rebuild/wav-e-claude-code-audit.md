# WAV-e Post-Fix Audit — Claude Code Prompt
*Serendipity Projects | Mei 2026*

---

## Your role

You are a senior engineer performing an independent verification audit on WAV-e. A previous automated agent (Codex) ran a fix pass on six flagged security and architecture issues. Your job is to verify that every fix was applied correctly, completely, and without introducing regressions. You are not fixing — you are auditing. If you find something wrong, you describe it precisely and stop. You do not apply fixes unless explicitly asked.

One exception: if you find a critical security issue (auth bypass, UUID exposed in bundle) that Codex introduced or left unfixed, flag it as `CRITICAL` and apply the minimal targeted fix immediately, then document what you did and why.

---

## Stack

- Next.js 16 App Router, TypeScript strict mode
- Supabase (`@supabase/ssr`) — service role key in API routes, anon key in client
- Auth: session cookie → `createServerClient` → `supabase.auth.getUser()` → `get_my_role()` RPC
- Inline styles only — no Tailwind
- All UI pages are `'use client'`
- Deployed on Vercel via GitHub (`Jaylijpekay/wav-e`)

---

## Ground truth — authoritative reference

### Auth model

`get_my_role()` is a Postgres security-definer function. It returns `'admin'` for the hardcoded UUID, otherwise reads from `user_roles`. This function is the **only** legitimate way to derive role in application code. Any other mechanism — UUID comparison, custom claims, metadata fields — is wrong.

`get_my_trainer_id()` same pattern, returns the `trainer_id` from `user_roles` or `null` for admin.

`user_roles`: `user_id uuid`, `role text` (`'trainer'` | `'management'`), `trainer_id uuid nullable`

### Correct API route auth pattern

This is the only acceptable auth pattern for API routes. Verify every touched route matches this exactly:

```typescript
const cookieStore = await cookies()
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll() {},
    },
  }
)

const { data: { user }, error: userError } = await supabase.auth.getUser()
if (userError || !user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

const { data: role } = await supabase.rpc('get_my_role')
if (role !== 'admin') return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
```

Deviations to flag:
- Missing `await cookies()`
- Using anon key instead of service role key in API routes
- Checking `user.id` against any UUID string
- Calling `supabase.auth.admin.*` without first verifying the caller is admin via `get_my_role()`
- Role check on `user.user_metadata` or `user.app_metadata` instead of RPC

### Correct client component role pattern

Client components derive role via:
```typescript
const supabase = getSupabase() // anon key client from src/lib/supabase.ts
const { data: role } = await supabase.rpc('get_my_role')
```

Flag any client file that still compares `user.id` to a UUID string.

### Live DB schema (authoritative)

**`trainers`:** `id`, `voornaam`, `achternaam`, `naam`, `email`, `actief`, `pin_hash`, `rol` (legacy — must not be written to), `aangemaakt`, `created_at`

**`acties`:** `id`, `trainer_id`, `lid_id`, `type`, `omschrijving`, `deadline`, `status`, `aangemaakt_door`, `bron`, `completed_at`, `aangemaakt`, `evaluatie_id`, `afgerond`, `afgerond_op`

**`acties` check constraints:**
- `status`: `'open'` | `'afgerond'` | `'overdue'`
- `bron`: `'manual'` | `'auto'` | `'management'`
- `type`: `'resize'` | `'foto'` | `'evaluatie'` | `'eiwittenlijst'` | `'custom'`

**`notities`:** `id`, `lid_id`, `evaluatie_id`, `auteur_id`, `auteur_type`, `tekst`, `aangemaakt_op`, `verwijderd`, `verwijderd_op`, `toon_aan_trainer`, `gezien`, `gezien_op`

**`trainer_notities`:** `id`, `trainer_id`, `auteur_id`, `auteur_type`, `tekst`, `aangemaakt_op`, `verwijderd`, `verwijderd_op`, `gelezen_door_management`, `gelezen_op`, `lid_id`

**`management_gebruikers`:** `id`, `voornaam`, `achternaam`, `email`, `actief`, `aangemaakt`, `pin_hash`

**`user_roles`:** `id`, `user_id`, `role`, `trainer_id`, `created_at`

**`console_tokens`:** `id`, `token`, `naam`, `trainer_id`, `actief`, `aangemaakt_door`, `aangemaakt_op`, `laatst_gebruikt`

---

## What Codex was supposed to fix

These are the six issues from the original fix pass. Verify each one fully.

---

### Issue 1 — Admin routes use UUID checks instead of `get_my_role()`

**File:** `src/app/api/admin/create/route.ts`

**What Codex should have done:**
- Removed any hardcoded UUID constant or comparison
- Applied the standard auth pattern: `getUser()` → `get_my_role()` → `role === 'admin'`
- After creating the Supabase auth user, inserted into `user_roles` with correct role and `trainer_id`
- Stopped writing to `trainers.rol`

**Verify:**

1. Read the full file. Search for any string matching the admin UUID `a596f282-c927-4a11-aaec-bb18721cac50` — must not appear
2. Confirm `get_my_role()` is called and its result is used for the access check
3. Confirm `user_roles` insert exists after user creation, with correct fields: `user_id` (new auth user id), `role` (passed in body), `trainer_id` (trainer row id for trainer role, null for management)
4. Confirm no write to `trainers.rol`
5. Confirm the rollback/cleanup path on partial failure does not hard-delete rows (soft flag or omit only)
6. Confirm TypeScript compiles without errors on this file: run `npx tsc --noEmit`

**Flag if:**
- UUID still present anywhere in the file
- `user_roles` insert is missing
- `trainers.rol` is still being written
- Hard delete exists in any code path
- Role check is on `user.user_metadata` or any non-RPC source

---

### Issue 2 — Console API routes missing session auth

**Files:** All routes under `src/app/api/admin/` that handle console token operations (create, revoke, list, reactivate)

**What Codex should have done:**
- Added `getUser()` + `get_my_role()` auth check to every console token management route
- Role check: `role === 'admin'`
- Left the `/console` page token validation flow untouched

**Verify:**

1. List every file under `src/app/api/admin/` — read each one
2. For each console token route, confirm the standard auth pattern is present at the top of every handler
3. Confirm `/console` page itself (`src/app/console/page.tsx`) is unchanged — it authenticates via token string, not session
4. Confirm `src/app/api/admin/console-tokens/route.ts` (if it exists) has auth on both GET and POST handlers

**Flag if:**
- Any admin route handler returns data or performs a write without first calling `getUser()` and checking `get_my_role()`
- Auth check is present on one HTTP method but missing on another in the same file
- `/console` page auth flow has been modified

---

### Issue 3 — Hard deletes in admin delete route

**File:** `src/app/api/admin/delete/route.ts`

**What Codex should have done:**
- Replaced hard delete of application data rows with soft deactivate (`actief = false`)
- Kept or added `supabase.auth.admin.deleteUser(userId)` to invalidate the auth session
- Chained `.select('id')` after the update to catch silent failures
- Returned `{ success: true }` on success

**Verify:**

1. Read the full file
2. Confirm no `DELETE FROM trainers` or `DELETE FROM management_gebruikers` or equivalent hard delete
3. Confirm `UPDATE ... SET actief = false` exists and `.select('id')` is chained
4. Confirm empty result after update is caught and returns an appropriate error
5. Confirm `supabase.auth.admin.deleteUser()` is called with the correct user id — this is the only acceptable hard delete in this file
6. Confirm the response is `{ success: true }` on the happy path

**Flag if:**
- Any `.delete()` call exists on `trainers` or `management_gebruikers`
- `.select('id')` is missing after the update
- Auth user deletion is missing (the Supabase auth session must be invalidated)
- The route still lacks session auth (Issue 2 applies here too if this route was missed)

---

### Issue 4 — Admin UUID in client-side files

**Files:**
- `src/app/components/AdminBar.tsx`
- `src/app/components/Navigation.tsx`
- `src/app/login/page.tsx`

**What Codex should have done:**
- Removed UUID constant and comparison from each file
- Replaced with `supabase.rpc('get_my_role')` on the client using the anon key client from `src/lib/supabase.ts`
- Gated admin-specific UI or redirects on `role === 'admin'`

**Verify:**

1. Read each file in full
2. Search for the UUID string `a596f282-c927-4a11-aaec-bb18721cac50` — must not appear in any of these files
3. Search for any other UUID-format string (`[0-9a-f]{8}-[0-9a-f]{4}-`) — flag any found that are not clearly member/trainer IDs passed in at runtime
4. Confirm `get_my_role()` RPC is called and its result drives admin visibility/routing
5. Confirm the Supabase client used is the anon key client (from `src/lib/supabase.ts`), not a service role client — service role must never be in client components
6. Confirm loading state is handled — admin UI should not flash visible before role is resolved

**Flag if:**
- UUID appears in any form (string literal, constant, variable assigned the UUID value)
- `user.id` comparison is used instead of RPC result
- Service role key is referenced in any client component
- Role state is not initialised (causes admin UI to briefly render for non-admins)

---

### Issue 5 — `cyclus` computed client-side before insert

**File:** `src/app/gesprek/new/page.tsx` and (if created by Codex) `src/app/api/gesprek/route.ts`

**What Codex should have done (either Option A or B):**

Option A: Moved cyclus computation to an existing or new API route. Client sends payload without `cyclus`. API queries `COUNT(*) FROM evaluaties WHERE lid_id = $1`, computes `cyclus = count + 1`, inserts.

Option B: If direct client insert remained, computation was moved server-side via an API route regardless.

**Verify:**

1. Read `src/app/gesprek/new/page.tsx` in full
2. Search for `cyclus` — it must not be computed on the client (no `count + 1`, no `evaluaties.length + 1`, no derived numeric value assigned to a `cyclus` variable that is then passed to an insert)
3. If an API route was created, read it in full and confirm:
   - Auth pattern is present
   - `cyclus` is computed server-side from a DB query
   - The insert does not receive `cyclus` from the request body
   - `.select()` is chained after insert
4. Confirm `npm run build` passes with the new structure

**Flag if:**
- `cyclus` is still computed on the client
- `cyclus` is accepted as a body parameter in the API route (means client can still pass an arbitrary value)
- The API route is missing auth
- `npm run build` fails

---

### Issue 6 — Next 16 middleware convention

**File:** `middleware.ts` (project root)

**What Codex should have done:**
- Read the installed Next docs and confirmed `middleware.ts` at project root is still correct for Next 16
- Added a comment confirming this if no structural change was needed
- Performed a structural migration only if the docs genuinely required it

**Verify:**

1. Confirm `middleware.ts` exists at project root (not inside `/app` or `/src`)
2. Read the file — confirm the auth and role-routing logic is completely unchanged from before the fix pass
3. If Codex added a clarifying comment, confirm it is accurate
4. If Codex performed a structural migration, read the result carefully — confirm routing logic is equivalent and no role is incorrectly redirected
5. Run the dev server and manually verify that:
   - `/management` redirects unauthenticated users to `/login`
   - `/admin` redirects non-admin users to their role-appropriate page
   - `/trainer/[id]` is inaccessible to management users directly

**Flag if:**
- Middleware file was moved or renamed without equivalent routing logic
- Any role redirect is missing or changed
- The file now lives inside `/app` (wrong location — Next middleware must be at project root)
- Auth logic was touched in any way

---

## Additional checks — run on all touched files

Beyond the six issues, run these checks on every file Codex modified:

### Build and type integrity
```bash
npm run build
npx tsc --noEmit
npm run lint
```

All three must pass cleanly. Report any errors with file and line.

### Silent failure patterns
Every `.update()` must chain `.select('id')`. Every `.insert()` must chain `.select(...)`. Check every Supabase write in every touched file. Flag any missing chain.

### Regression check — untouched files
Confirm Codex did not modify any file outside the six issues. Run:
```bash
git diff --name-only HEAD~1
```
or equivalent. List every changed file. Flag any file that was changed but not in scope.

### Bundle exposure check
```bash
grep -r "a596f282-c927-4a11-aaec-bb18721cac50" src/
```
Must return zero results. If any match, flag as `CRITICAL` and remove immediately.

---

## Output format

Produce a structured verification report.

### Per issue

```
ISSUE: 1 — Admin routes UUID check
STATUS: PASS | FAIL | PARTIAL
FILES CHECKED: src/app/api/admin/create/route.ts
FINDINGS:
  - UUID removed ✓
  - get_my_role() present ✓
  - user_roles insert present ✓
  - trainers.rol not written ✓
  - No hard delete in rollback path ✓
RESIDUAL ISSUES: none
```

or if failed:

```
ISSUE: 3 — Hard deletes
STATUS: FAIL
FILES CHECKED: src/app/api/admin/delete/route.ts
FINDINGS:
  - Hard delete on trainers still present at line 58 ✗
  - .select('id') missing after update ✗
  - Auth user deletion present ✓
RESIDUAL ISSUES:
  FILE: src/app/api/admin/delete/route.ts
  LINE: 58
  SEVERITY: BLOCKER
  PROBLEM: DELETE FROM trainers still executes on the happy path.
  FIX REQUIRED: Replace with UPDATE trainers SET actief = false WHERE id = $1,
                chain .select('id'), check for empty result.
```

### Summary table

```
| Issue | Status  | Files Checked | Residual BLOCKERs |
|-------|---------|---------------|-------------------|
| 1     | PASS    | 1             | 0                 |
| 2     | PARTIAL | 3             | 1                 |
| 3     | FAIL    | 1             | 2                 |
| 4     | PASS    | 3             | 0                 |
| 5     | PASS    | 2             | 0                 |
| 6     | PASS    | 1             | 0                 |
```

### Build results

```
npm run build:  PASS | FAIL (include error output if fail)
tsc --noEmit:   PASS | FAIL
npm run lint:   PASS | FAIL
```

### Regression report

List every file changed by Codex. Flag any out-of-scope changes.

### Bundle exposure

```
UUID grep result: 0 matches ✓ | N matches ✗ (list files)
```

---

## Execution order

1. Run `git diff --name-only HEAD~1` — record every file Codex changed
2. Run `npm run build`, `npx tsc --noEmit`, `npm run lint` — record baseline
3. Run UUID grep across `src/` — record result
4. Read every file in the changed list, completely
5. Verify Issue 1 → write findings
6. Verify Issue 2 → write findings
7. Verify Issue 3 → write findings
8. Verify Issue 4 → write findings
9. Verify Issue 5 → write findings
10. Verify Issue 6 → write findings
11. Apply any `CRITICAL` fixes found — document each
12. Re-run build, tsc, lint after any fixes
13. Produce final report

---

## What not to do

- Do not refactor code that passes verification
- Do not apply non-critical fixes — describe them and stop
- Do not change Dutch copy
- Do not add features, components, or new routes
- Do not modify DB functions, migrations, or RLS policies
- Do not change the `/console` page auth flow
- Do not upgrade dependencies
- Do not write to `trainers.rol`
- Do not hard-delete any application data rows

---

*WAV-e Post-Fix Audit | Serendipity Projects | Mei 2026*
*Authors: Jay Kerkhof + Claude (Anthropic)*
