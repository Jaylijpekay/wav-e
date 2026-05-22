# Codex Task — WAV-e Notities · Iteratie 2
# API lid notities: DELETE + PATCH gezien

## Prerequisites

Iteratie 1 must be complete and verified on production before starting this.

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Supabase
New file: `src/app/api/notities/[lid_id]/[notitie_id]/route.ts`

No other files are touched in this iteratie.

---

## Schema reference

Table: `notities`
Relevant columns for this iteratie:
```
id              uuid PK
verwijderd      boolean NOT NULL DEFAULT false
verwijderd_op   timestamptz nullable
gezien          boolean NOT NULL DEFAULT false
gezien_op       timestamptz nullable
```

---

## DELETE `/api/notities/[lid_id]/[notitie_id]`

### Auth
Use `createServerClient` from `@supabase/ssr` with service role key.
Call `get_my_role()` to verify access.
Allowed roles: `trainer`, `management`, `admin`.
Return 401 if no session. Return 403 if role not allowed.

### Soft delete
Do NOT hard delete. Update the record:
```typescript
{
  verwijderd: true,
  verwijderd_op: new Date().toISOString(),
}
```

Filter: `id = params.notitie_id AND lid_id = params.lid_id`
Chain `.select()` after `.update()` to detect silent failures.
If update returns no rows: return 404 with `{ error: 'Notitie niet gevonden' }`.

### Response
Return 200 with `{ success: true }`.

---

## PATCH `/api/notities/[lid_id]/[notitie_id]`

This endpoint handles one operation only: trainer marks a notitie as gezien.

### Auth
Same pattern. Allowed roles: `trainer`, `admin`.
Management cannot mark gezien — return 403 if role is `management`.

### Request body
```typescript
{ gezien: true }
```

Only `gezien: true` is accepted. Ignore all other fields.
Return 400 if body does not contain `gezien: true`.

### Update
```typescript
{
  gezien: true,
  gezien_op: new Date().toISOString(),
}
```

Filter: `id = params.notitie_id AND lid_id = params.lid_id`
Chain `.select()` after `.update()`.
If update returns no rows: return 404.

### Response
Return 200 with `{ success: true }`.

---

## Verify after build

```bash
npm run build
```

Then test:
```bash
# DELETE
curl -X DELETE https://wav-e.vercel.app/api/notities/[lid_id]/[notitie_id] \
  -H "Cookie: [session]"

# PATCH gezien
curl -X PATCH https://wav-e.vercel.app/api/notities/[lid_id]/[notitie_id] \
  -H "Content-Type: application/json" \
  -H "Cookie: [session]" \
  -d '{"gezien":true}'
```

Verify directly in Supabase after DELETE:
```sql
SELECT id, verwijderd, verwijderd_op FROM notities WHERE verwijderd = true LIMIT 5;
```

Verify after PATCH gezien:
```sql
SELECT id, gezien, gezien_op FROM notities WHERE gezien = true LIMIT 5;
```

---

## Do not touch

- `src/app/api/notities/[lid_id]/route.ts` (iteratie 1)
- Any other files
- DB schema
- Middleware

---

## Notes

- Soft delete only — never hard delete
- `gezien_op` is stored for v0.2 management reporting — no UI for it yet
- Windows line endings (CRLF)
- Use service role key for all DB operations in API routes
