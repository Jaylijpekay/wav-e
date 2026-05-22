# WAV-e Section 2 Fix Pass — Codex Prompt
*Serendipity Projects | Mei 2026*

---

## Context

This is a targeted fix pass following a full codebase audit of WAV-e (Next.js 14 / Supabase coaching app). The audit produced a Section 2 flagged issues list. Your job is to fix every flagged item in scope, leave everything else untouched, and produce a fix report when done.

The previous pass (Section 1) already handled ESLint suppressions, missing `.select()` chains, and hook dep arrays. Do not revisit those.

---

## Stack

- Next.js 16 App Router, TypeScript strict mode
- Supabase (`@supabase/ssr`) — service role key in API routes, anon key in client
- Auth: session cookie → `createServerClient` → `supabase.auth.getUser()` → `get_my_role()` RPC
- Inline styles only — no Tailwind
- All UI pages are `'use client'`
- Deployed on Vercel via GitHub (`Jaylijpekay/wav-e`)

---

## Ground truth — read this before touching any file

### Auth model (DB-level, do not change)

`get_my_role()` is a Postgres security-definer function:
```sql
SELECT CASE
  WHEN auth.uid() = 'a596f282-c927-4a11-aaec-bb18721cac50' THEN 'admin'
  ELSE (SELECT role FROM user_roles WHERE user_id = auth.uid())
END;
```

`get_my_trainer_id()`:
```sql
SELECT CASE
  WHEN auth.uid() = 'a596f282-c927-4a11-aaec-bb18721cac50' THEN NULL
  ELSE (SELECT trainer_id FROM user_roles WHERE user_id = auth.uid())
END;
```

`user_roles` table: `user_id uuid`, `role text` (`'trainer'` | `'management'`), `trainer_id uuid nullable`

The admin UUID hardcode lives **only in the DB functions**. It must not appear in any application code. RLS policies and all API routes must derive role exclusively from `get_my_role()`.

### Correct API route auth pattern

Every API route must follow this exact pattern — no exceptions:

```typescript
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
)

const { data: { user }, error: userError } = await supabase.auth.getUser()
if (userError || !user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

const { data: role } = await supabase.rpc('get_my_role')
if (role !== 'admin') return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
```

Replace `role !== 'admin'` with the appropriate role check for that route.

### Live DB schema (authoritative)

**`trainers`:** `id`, `voornaam`, `achternaam`, `naam`, `email`, `actief`, `pin_hash`, `rol` (legacy column — exists, do not write to it, do not delete it), `aangemaakt`, `created_at`

**`leden`:** `id`, `lid_id`, `voornaam`, `achternaam`, `email`, `telefoon`, `actief`, `status`, `trainer_id`, `startdatum`, `source`, `external_id`

**`evaluaties`:** `id`, `lid_id`, `trainer_id`, `cyclus`, `datum`, `slaap`, `energie`, `stress`, `motivatie`, `tevredenheid`, `notities`

**`contact_momenten`:** `id`, `lid_id`, `trainer_id`, `datum`, `type`, `notities`

**`acties`:** `id`, `trainer_id`, `lid_id`, `type`, `omschrijving`, `deadline`, `status`, `aangemaakt_door`, `bron`, `completed_at`, `aangemaakt`, `evaluatie_id`, `afgerond`, `afgerond_op`

**`acties` check constraints:**
- `status`: `'open'` | `'afgerond'` | `'overdue'`
- `bron`: `'manual'` | `'auto'` | `'management'`
- `type`: `'resize'` | `'foto'` | `'evaluatie'` | `'eiwittenlijst'` | `'custom'`

**`notities`:** `id`, `lid_id`, `evaluatie_id`, `auteur_id`, `auteur_type`, `tekst`, `aangemaakt_op`, `verwijderd`, `verwijderd_op`, `toon_aan_trainer`, `gezien`, `gezien_op`

**`trainer_notities`:** `id`, `trainer_id`, `auteur_id`, `auteur_type`, `tekst`, `aangemaakt_op`, `verwijderd`, `verwijderd_op`, `gelezen_door_management`, `gelezen_op`, `lid_id`

**`management_gebruikers`:** `id`, `voornaam`, `achternaam`, `email`, `actief`, `aangemaakt`, `pin_hash`

**`console_tokens`:** `id`, `token`, `naam`, `trainer_id`, `actief`, `aangemaakt_door`, `aangemaakt_op`, `laatst_gebruikt`

**`user_roles`:** `id`, `user_id`, `role`, `trainer_id`, `created_at`

---

## Issues to fix

Work through these in order. Do not skip any. Do not fix anything not listed here.

---

### Issue 1 — BLOCKER/D: Admin routes use UUID checks instead of `get_my_role()`

**File:** `src/app/api/admin/create/route.ts`

**Problem:** Route checks `user.id === ADMIN_UUID` or equivalent hardcoded UUID comparison to gate admin access instead of calling `get_my_role()`.

**Fix:**
1. Remove any hardcoded UUID constant or comparison
2. Replace with the standard auth pattern: `getUser()` → `get_my_role()` → check `role === 'admin'`
3. The route creates both trainer and management users. After creating the Supabase auth user, insert into `user_roles` with the appropriate role and `trainer_id` (for trainers, look up the newly created trainer row id; for management, `trainer_id` is null)
4. Do not write to `trainers.rol` — that column is legacy and unused by the auth system
5. Return the created user record on success

**Verify:** After fix, `npm run build` must pass. A non-admin authenticated user hitting this route must receive 403.

---

### Issue 2 — BLOCKER/D: Console API routes use service role without session auth

**File:** Any route under `src/app/api/admin/` that handles console token operations

**Problem:** Console token routes bypass session auth entirely, relying only on the service role key being present on the server. There is no check that the caller is authenticated as admin.

**Fix:** Apply the standard auth pattern to every console token route. Role check: `role === 'admin'`.

**Note:** The console itself (`/console` page) authenticates via token, not session — that is correct and must not change. Only the *management* routes that create/revoke/list tokens need session auth added.

---

### Issue 3 — BLOCKER/C: Hard deletes in admin delete route

**File:** `src/app/api/admin/delete/route.ts` (line ~58)

**Problem:** Route performs a hard delete (`DELETE FROM`) on trainer or management records, making them unrecoverable.

**Fix:**
- Replace hard delete of application data with soft deactivate: `UPDATE trainers SET actief = false WHERE id = [id]` or equivalent for management users
- The Supabase auth user (`auth.users`) may still be hard-deleted via `supabase.auth.admin.deleteUser(userId)` — this is acceptable and intentional (prevents re-login). Keep this if it exists.
- After deactivation, return `{ success: true }`
- Chain `.select('id')` after the update to catch silent failures

**Also check:** `src/app/api/admin/create/route.ts` line ~81 — if there is a rollback/cleanup hard delete there (e.g. deleting a trainer row if auth user creation fails), replace with a flag or simply omit the row — do not hard delete.

---

### Issue 4 — WARNING/D: Admin UUID in client-side files

**Files:**
- `src/app/components/AdminBar.tsx` line ~7
- `src/app/components/Navigation.tsx` line ~22
- `src/app/login/page.tsx` line ~47

**Problem:** The admin UUID `a596f282-c927-4a11-aaec-bb18721cac50` is hardcoded in client-side files. This exposes the UUID in the browser bundle — anyone can read it in DevTools. The UUID should exist only in DB functions.

**Fix:** In each file, replace the UUID-based admin check with a role derived from the session.

The correct pattern for client components:

```typescript
// On mount, fetch role from the session via the Supabase client
const supabase = getSupabase() // existing client factory in src/lib/supabase.ts
const { data: { user } } = await supabase.auth.getUser()
// Then use user metadata or an RPC to get role — do NOT compare user.id to a UUID
```

If the existing client factory does not expose a way to call RPCs, use:
```typescript
const { data: role } = await supabase.rpc('get_my_role')
```

Then gate the AdminBar render, nav items, or login redirect on `role === 'admin'` instead of `user.id === ADMIN_UUID`.

**Important:** `getSupabase()` in client components uses the anon key — `get_my_role()` is a security-definer function accessible to authenticated users via the anon key. This is correct and will work.

---

### Issue 5 — WARNING/E: `cyclus` computed client-side before insert

**File:** `src/app/gesprek/new/page.tsx` line ~109

**Problem:** `cyclus` is derived from a count of existing evaluaties for the lid, computed client-side, then written to the DB insert. This is a derived value being stored, which violates the architecture rule.

**Fix options — choose the one that matches the existing code structure:**

**Option A (preferred):** Move the cyclus computation to the API route. The client sends `{ lid_id, ... }` without `cyclus`. The API route queries `SELECT COUNT(*) FROM evaluaties WHERE lid_id = $1` and computes `cyclus = count + 1` server-side before inserting.

**Option B:** If there is no API route for gesprek creation (direct client-side Supabase insert), add one at `src/app/api/gesprek/route.ts` that accepts the evaluatie payload without `cyclus`, computes it, and inserts.

Do not leave cyclus computation on the client. Pick whichever option requires fewer new files given the existing code structure — read the file first.

---

### Issue 6 — INFO/Next 16: `middleware.ts` deprecation warning

**File:** `middleware.ts` (project root)

**Problem:** Codex noted that Next 16 local docs reference `proxy.ts` as the new middleware convention, and flagged `middleware.ts` as potentially deprecated.

**Fix:** Read the installed Next version's actual middleware documentation in `node_modules/next/dist/`. If `middleware.ts` at the project root is still the correct location and convention for the installed version, add a one-line comment at the top of the file:

```typescript
// Next 16: middleware.ts at project root remains the correct convention.
// proxy.ts is an internal Next.js concept, not a replacement for middleware.
```

If the docs genuinely require migration to a different file or export format, perform that migration. Do not change the middleware logic — only the file structure if required.

Do not touch middleware auth logic under any circumstances.

---

## Fix rules

**Fix autonomously:**
- All six issues above, exactly as specified
- Removing any remaining `console.log` statements discovered in the touched files

**Do not touch:**
- Any file not referenced in the issues above
- DB functions, migrations, or RLS policies
- The console token auth flow on `/console` page itself
- The `trainers.rol` column — leave it in place, just stop writing to it
- Any Dutch copy or label text
- Middleware auth logic (Issue 6 is comment-only unless a genuine structural migration is required)

**One file at a time.** Output the full file, confirm, then move to the next. Do not batch.

---

## Output format

### For each fix

```
FILE: src/app/api/admin/create/route.ts
ISSUE: 1 — UUID check replaced with get_my_role() pattern
CHANGE: Removed ADMIN_UUID constant. Replaced UUID comparison with getUser() →
        get_my_role() → role === 'admin' check. Removed write to trainers.rol.
        Added user_roles insert after trainer row creation.
```

### Final report

After all fixes, produce:

**Fixed:**
List every file changed with one-line summary.

**Not fixed / needs human decision:**
Anything you encountered that was outside scope or required a decision you couldn't make autonomously.

**Files read but not changed:**
List for completeness.

---

## Execution order

1. Read every file listed in the issues above — completely, before writing anything
2. Read `src/lib/supabase.ts` to understand the client factory
3. Read `src/app/api/admin/create/route.ts` fully before touching any admin route
4. Fix Issue 1 → confirm
5. Fix Issue 2 → confirm
6. Fix Issue 3 → confirm
7. Fix Issue 4 (three files) → one file at a time, confirm each
8. Fix Issue 5 → confirm
9. Fix Issue 6 → confirm
10. Produce final report

---

## What not to do

- Do not add new features
- Do not rename variables or functions for style reasons
- Do not change Dutch copy to English
- Do not refactor working code that is not listed in the issues
- Do not add Tailwind classes
- Do not introduce new state management patterns
- Do not upgrade or add dependencies
- Do not touch `supabase/migrations/`
- Do not hard-delete any application data rows

---

*WAV-e Section 2 Fix Pass | Serendipity Projects | Mei 2026*
*Authors: Jay Kerkhof + Claude (Anthropic)*
