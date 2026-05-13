# Codex Task — WAV-e Notities · Iteratie 1
# API lid notities: GET + POST

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Supabase
New file: `src/app/api/notities/[lid_id]/route.ts`

No other files are touched in this iteratie.

---

## Schema reference

Table: `notities`
```
id              uuid PK
lid_id          uuid NOT NULL FK → leden(id)
evaluatie_id    uuid nullable FK → evaluaties(id)
auteur_id       uuid NOT NULL
auteur_type     text NOT NULL CHECK IN ('trainer','management','admin')
tekst           text NOT NULL CHECK char_length <= 1000
aangemaakt_op   timestamptz NOT NULL DEFAULT now()
verwijderd      boolean NOT NULL DEFAULT false
verwijderd_op   timestamptz nullable
toon_aan_trainer boolean NOT NULL DEFAULT false
gezien          boolean NOT NULL DEFAULT false
gezien_op       timestamptz nullable
```

Table: `trainers` — columns: `id`, `naam`
Table: `management_gebruikers` — columns: `id`, `voornaam`, `achternaam`

---

## GET `/api/notities/[lid_id]`

### Auth
Use `createServerClient` from `@supabase/ssr` with the service role key.
Read the session cookie to identify the caller.
Call `get_my_role()` via `supabase.rpc('get_my_role')` to verify access.
Allowed roles: `trainer`, `management`, `admin`.
Return 401 if no valid session. Return 403 if role not allowed.

### Query
Fetch all notities where:
- `lid_id = params.lid_id`
- `verwijderd = false`

Optional query param: `?evaluatie_id=[uuid]`
If present, add filter: `evaluatie_id = [value]`

Order: `aangemaakt_op DESC`

### Auteur naam resolution
After fetching notities, resolve auteur naam per record:
- `auteur_type = 'trainer'` → query `trainers` where `id = auteur_id`, return `naam`
- `auteur_type = 'management'` → query `management_gebruikers` where `id = auteur_id`, return `voornaam || ' ' || achternaam`
- `auteur_type = 'admin'` → return string `'Admin'`

Batch these lookups — collect unique auteur_ids per type, fetch in two queries, then map.

### Response
```typescript
{
  notities: Array<{
    id: string
    lid_id: string
    evaluatie_id: string | null
    auteur_id: string
    auteur_type: 'trainer' | 'management' | 'admin'
    auteur_naam: string
    tekst: string
    aangemaakt_op: string
    toon_aan_trainer: boolean
    gezien: boolean
  }>
}
```

Return 200 with empty array if no notities found.

---

## POST `/api/notities/[lid_id]`

### Auth
Same pattern as GET. Allowed roles: `trainer`, `management`, `admin`.
Return 401 / 403 as above.

### Request body
```typescript
{
  tekst: string           // required
  evaluatie_id?: string   // optional
  toon_aan_trainer?: boolean // optional, default false
}
```

### Validation
- `tekst` must be non-empty string after trim
- `tekst` must be <= 1000 characters
- If `evaluatie_id` provided, verify it exists in `evaluaties` table before insert
- If validation fails return 400 with `{ error: string }`

### Auteur resolution
Get `auteur_id` from the session user's UUID (`session.user.id`).
Derive `auteur_type` from `get_my_role()`:
- `'admin'` → `auteur_type = 'admin'`
- `'management'` → `auteur_type = 'management'`
- `'trainer'` → `auteur_type = 'trainer'`

### Insert
```typescript
{
  lid_id: params.lid_id,
  evaluatie_id: body.evaluatie_id ?? null,
  auteur_id: session.user.id,
  auteur_type: derived above,
  tekst: body.tekst.trim(),
  toon_aan_trainer: body.toon_aan_trainer ?? false,
}
```

Chain `.select()` after `.insert()` to catch silent failures.
If insert returns no rows, return 500 with `{ error: 'Insert mislukt' }`.

### Response
Return 201 with the created notitie in the same shape as a GET item.
Resolve auteur_naam before returning.

---

## Error handling

All DB errors return 500 with `{ error: err.message }`.
Never expose raw Supabase internals — catch and wrap.

---

## Verify after build

```bash
npm run build
```

Then test:
```bash
# GET — replace with real lid_id and session cookie
curl https://wav-e.vercel.app/api/notities/[lid_id] \
  -H "Cookie: [session]"

# GET with evaluatie filter
curl "https://wav-e.vercel.app/api/notities/[lid_id]?evaluatie_id=[uuid]" \
  -H "Cookie: [session]"

# POST
curl -X POST https://wav-e.vercel.app/api/notities/[lid_id] \
  -H "Content-Type: application/json" \
  -H "Cookie: [session]" \
  -d '{"tekst":"Test notitie","toon_aan_trainer":false}'

# POST with alert flag
curl -X POST https://wav-e.vercel.app/api/notities/[lid_id] \
  -H "Content-Type: application/json" \
  -H "Cookie: [session]" \
  -d '{"tekst":"Urgente melding","toon_aan_trainer":true}'
```

Verify in Supabase that `toon_aan_trainer` is stored correctly.

---

## Do not touch

- Any existing files
- Any other API routes
- DB schema
- Middleware

---

## Notes

- Use `@supabase/ssr` `createServerClient` — not the browser client
- Service role key is in `process.env.SUPABASE_SERVICE_ROLE_KEY`
- Supabase URL is in `process.env.NEXT_PUBLIC_SUPABASE_URL`
- Windows line endings (CRLF)
- Dutch UI copy only in any user-facing strings
