# Patch: heractiveren does not clear status

**File:** `src/app/api/management/leden/[id]/route.ts`

Do not touch anything else.

---

## Root cause

`reactiveerLid` sends `{ actief: true }` only.
The PATCH handler writes only what it receives — `status` stays `'inactief'`
(or `'gestopt'`) in the DB.

After reload the lid has `actief: true, status: 'inactief'` — the actief
filter requires `status === 'actief' || !status`, so the lid disappears
from every view.

---

## Fix — in the PATCH handler

When `actief === true` is in the payload, always also write:
- `status: 'Actief'`
- `gestopt_op: null`

Pattern:

```ts
const body = await req.json()
const update: Record<string, unknown> = { ...body }

if (body.actief === true) {
  update.status = 'Actief'
  update.gestopt_op = null
}

const { error } = await supabase
  .from('leden')
  .update(update)
  .eq('id', id)
```

Use `'Actief'` (capital A) — that matches the column default in the DB.

---

## Constraints

- One file only
- Do not touch the client page
- Do not add migrations
