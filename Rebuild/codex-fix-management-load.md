# Codex Patch: Fix management page load hang

## Context

`src/app/management/page.tsx` is not loading on Vercel. The page renders "Laden…" indefinitely.

## Root cause

In the `load()` function inside `ManagementPage`, two sequential `fetch` calls run after the main `Promise.all`:

```ts
const unreadRes = await fetch('/api/trainer-notities')   // line ~1000
const pinsRes   = await fetch('/api/admin/pins')          // line ~1013
```

`/api/trainer-notities` is guarded with `if (unreadRes.ok)` — it fails safely.

`/api/admin/pins` is **not guarded**. If the route throws, returns a non-2xx, or does not exist in the deployment, execution never reaches `setLoading(false)`. The page hangs on the loading state permanently.

## What to fix

**File:** `src/app/management/page.tsx`  
**Do not touch any other file.**

### 1. Wrap the entire `load()` body in try/finally

Move `setLoading(false)` into a `finally` block so it is guaranteed to fire regardless of any fetch failure.

Replace the current structure:

```ts
const load = useCallback(async () => {
  // ... fetches ...
  setLoading(false)
}, [refreshKey])
```

With:

```ts
const load = useCallback(async () => {
  try {
    // ... all existing fetch logic unchanged ...
  } catch (err) {
    console.error('Management load error:', err)
  } finally {
    setLoading(false)
  }
}, [refreshKey])
```

### 2. Guard the `/api/admin/pins` fetch explicitly

Inside the try block, wrap the pins fetch the same way `unreadRes` is already wrapped:

```ts
try {
  const pinsRes = await fetch('/api/admin/pins')
  if (pinsRes.ok) {
    const pinsData = await pinsRes.json()
    setConsolePins(pinsData.trainers ?? [])
  }
} catch {
  // route niet beschikbaar, leeg laten
}
```

This is a secondary guard in addition to the try/finally — it prevents a single failing endpoint from aborting the rest of the load logic.

### 3. Remove `setLoading(false)` from inside the try block

After wrapping in try/finally, there must be exactly **one** `setLoading(false)` call, in the `finally` block. Remove any other occurrences inside the try body.

## Constraints

- Do not change any other logic, state, or UI in this file
- Do not modify any other file
- Do not add new dependencies
- Do not restructure the Promise.all or any other fetch
- Keep all existing eslint-disable comments in place
