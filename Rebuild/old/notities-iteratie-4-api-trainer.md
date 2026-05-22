# Codex Task — WAV-e Notities · Iteratie 4
# API trainer notities: GET + POST + DELETE

## Prerequisites

Iteraties 1–3 must be complete and verified on production before starting this.

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Supabase
New files:
- `src/app/api/trainer-notities/[trainer_id]/route.ts`
- `src/app/api/trainer-notities/[trainer_id]/[notitie_id]/route.ts`

No other files are touched in this iteratie.

---

## Schema reference

Table: `trainer_notities`
```
id              uuid PK DEFAULT gen_random_uuid()
trainer_id      uuid NOT NULL FK → trainers(id)
auteur_id       uuid NOT NULL
auteur_type     text NOT NULL CHECK IN ('trainer','management','admin')
tekst           text NOT NULL CHECK char_length <= 1000
aangemaakt_op   timestamptz NOT NULL DEFAULT now()
verwijderd      boolean NOT NULL DEFAULT false
verwijderd_op   timestamptz nullable
```

Table: `trainers` — columns: `id`, `naam`
Table: `management_gebruikers` — columns: `id`, `voornaam`, `achternaam`

---

## File 1: `src/app/api/trainer-notities/[trainer_id]/route.ts`

### GET `/api/trainer-notities/[trainer_id]`

**Auth**
Use `createServerClient` from `@supabase/ssr` with service role key.
Call `get_my_role()` and `get_my_trainer_id()` via RPC.
Allowed:
- Role `admin` → always allowed
- Role `management` → always allowed
- Role `trainer` → only if `get_my_trainer_id() = params.trainer_id`

Return 401 if no session. Return 403 if not allowed.

**Query**
Fetch all `trainer_notities` where:
- `trainer_id = params.trainer_id`
- `verwijderd = false`

Order: `aangemaakt_op ASC` — chronological, conversation feel.

**Auteur naam resolution**
Same batched pattern as iteratie 1:
- `auteur_type = 'trainer'` → join `trainers` on `auteur_id`, return `naam`
- `auteur_type = 'management'` → join `management_gebruikers` on `auteur_id`, return `voornaam || ' ' || achternaam`
- `auteur_type = 'admin'` → return `'Admin'`

**Response**
```typescript
{
  notities: Array<{
    id: string
    trainer_id: string
    auteur_id: string
    auteur_type: 'trainer' | 'management' | 'admin'
    auteur_naam: string
    tekst: string
    aangemaakt_op: string
  }>
}
```

Return 200 with empty array if none found.

---

### POST `/api/trainer-notities/[trainer_id]`

**Auth**
Same pattern. Allowed:
- Role `admin` → always
- Role `management` → always
- Role `trainer` → only if own thread (`get_my_trainer_id() = params.trainer_id`)

**Request body**
```typescript
{ tekst: string }
```

**Validation**
- `tekst` non-empty after trim
- `tekst` <= 1000 characters
- Return 400 with `{ error: string }` if invalid

**Insert**
```typescript
{
  trainer_id: params.trainer_id,
  auteur_id: session.user.id,
  auteur_type: derived from get_my_role(),
  tekst: body.tekst.trim(),
}
```

Chain `.select()` after insert. Return 500 if no rows returned.

**Response**
Return 201 with the created record including resolved `auteur_naam`.

---

## File 2: `src/app/api/trainer-notities/[trainer_id]/[notitie_id]/route.ts`

### DELETE `/api/trainer-notities/[trainer_id]/[notitie_id]`

**Auth**
Allowed roles: `trainer` (own thread only), `management`, `admin`.
Trainer: only if `get_my_trainer_id() = params.trainer_id`.

**Soft delete**
```typescript
{
  verwijderd: true,
  verwijderd_op: new Date().toISOString(),
}
```

Filter: `id = params.notitie_id AND trainer_id = params.trainer_id`
Chain `.select()`. Return 404 if no rows updated.

**Response**
Return 200 with `{ success: true }`.

---

## Verify after build

```bash
npm run build
```

Then test:
```bash
# GET
curl https://wav-e.vercel.app/api/trainer-notities/[trainer_id] \
  -H "Cookie: [session]"

# POST (as management)
curl -X POST https://wav-e.vercel.app/api/trainer-notities/[trainer_id] \
  -H "Content-Type: application/json" \
  -H "Cookie: [session]" \
  -d '{"tekst":"Bericht van management aan trainer"}'

# POST (as trainer — own thread)
curl -X POST https://wav-e.vercel.app/api/trainer-notities/[trainer_id] \
  -H "Content-Type: application/json" \
  -H "Cookie: [session]" \
  -d '{"tekst":"Reactie van trainer aan management"}'

# DELETE
curl -X DELETE https://wav-e.vercel.app/api/trainer-notities/[trainer_id]/[notitie_id] \
  -H "Cookie: [session]"
```

Verify in Supabase:
```sql
SELECT id, auteur_type, tekst, verwijderd FROM trainer_notities ORDER BY aangemaakt_op DESC LIMIT 10;
```

---

## Do not touch

- Any notities routes (iteraties 1 en 2)
- Any page files
- DB schema
- Middleware

---

## Notes

- `get_my_trainer_id()` is a Supabase security definer RPC function — call via `supabase.rpc('get_my_trainer_id')`
- Trainer can only access their own thread — enforce this on both GET and POST
- Windows line endings (CRLF)
- Use service role key for all DB operations
