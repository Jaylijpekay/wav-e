# WAV-e Rebuild — Pass 6: Tablet & Auth Fixes

**Branch:** `main`
**Session type:** Medium risk. Auth flow and tablet UX. No business logic changes.

---

## Context

WAV-e is a coaching intelligence layer for an EMS studio built on Next.js 14 (App Router, TypeScript, Tailwind CSS) with Supabase as the backend. The primary tablet target is iPad 7th gen (10.2", Safari, iPadOS), portrait and landscape.

This is Pass 6 of an 8-pass rebuild. Three fixes:

1. iPad Safari login flow — session cookie must be set correctly
2. Console token login on tablet — PIN-based trainer picker must work on touch
3. Input `font-size: 1rem` everywhere — prevents iOS zoom on input focus

---

## Fix 1 — iPad Safari login flow

**Problem:** Login may fail on iPad Safari due to session cookie scoping or Supabase auth redirect URL misconfiguration.

**Fix:**

### Step 1 — Read before writing

Read `src/app/login/page.tsx` and the Supabase client setup in `src/lib/supabase/` (or equivalent). Understand how the session cookie is being set after login.

### Step 2 — Verify `@supabase/ssr` usage

Confirm the login flow uses `@supabase/ssr` with `createBrowserClient` on the client side. If it is using the legacy `@supabase/auth-helpers-nextjs`, flag it but do not migrate in this pass — note it in the summary.

### Step 3 — Cookie options

In the Supabase client setup, confirm cookie options include:

```typescript
cookies: {
  get(name) { ... },
  set(name, value, options) { ... },
  remove(name, options) { ... }
}
```

If `sameSite` is set to `'strict'`, change it to `'lax'` — Safari on iOS requires this for session cookies to persist across navigation.

### Step 4 — Auth redirect URL

In `src/app/login/page.tsx`, confirm the `redirectTo` option on `signInWithPassword` (or equivalent) is not set to a hardcoded URL. It should either be absent or set to `window.location.origin`. A hardcoded production URL will break local dev and any non-production domain.

---

## Fix 2 — Console token login on tablet

**Problem:** The console token / PIN-based trainer picker may have touch interaction issues on iPad Safari.

**Fix:**

### Step 1 — Read before writing

Read `src/app/console/page.tsx`. Understand the full PIN entry and trainer selection flow.

### Step 2 — Touch targets

Every interactive element in the console flow must meet `min-height: 44px` and `min-width: 44px`. Apply where missing.

### Step 3 — Touch event handling

Confirm dropdown or trainer picker dismissal listens for both `touchstart` and `mousedown`. If only `mousedown` is present, add `touchstart`.

### Step 4 — Keyboard behaviour

On iOS, the software keyboard appears on any input focus. If the PIN input is near the bottom of the viewport, the keyboard may cover it. Add `scroll-into-view` behaviour on focus if not already present:

```typescript
inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
```

---

## Fix 3 — Input font-size: 1rem everywhere

**Problem:** iOS Safari zooms the viewport on any input with `font-size` below `16px`. This is a known iOS behaviour that cannot be overridden with meta viewport tags alone.

**Fix:**

Scan every `<input>`, `<textarea>`, and `<select>` element across all page files. Ensure each has `font-size: 1rem` or `text-base` (Tailwind). Apply `text-base` via Tailwind className where missing.

Files to check:
- `src/app/login/page.tsx`
- `src/app/console/page.tsx`
- `src/app/gesprek/new/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/management/page.tsx`
- `src/app/trainer/[trainerId]/page.tsx`
- `src/app/trainer/[trainerId]/leden/page.tsx`
- Any other file with form inputs

Do not change any other styling on these elements.

---

## Constraints

- Do not change business logic, API routes, or DB writes
- Do not change stoplight logic
- Do not migrate auth library versions in this pass — flag only
- Use CSS tokens from `globals.css` for any new color values
- Dutch UI copy only

---

## Output

After all changes are made, produce a summary:

1. Login flow — what was found and what was changed (cookie options, redirect URL)
2. Console token — what touch fixes were applied
3. Input font-size — list of files where `text-base` was added and how many inputs were fixed
4. Anything flagged but not changed

Then stop. Do not proceed to Pass 7.

---

## Gate

After this pass:
1. `npm run build` zero errors
2. Test login on actual iPad or Safari mobile emulation (responsive mode, iPad dimensions)
3. Verify session persists after login — navigation to `/trainer/[id]` works without redirect back to login
4. Verify console token PIN entry works on touch — trainer picker appears and is selectable
5. Verify no iOS zoom on input focus across login and gesprek forms

---

*WAV-e Rebuild Plan | Serendipity Projects | Mei 2026*
