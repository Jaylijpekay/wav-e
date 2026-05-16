# WAV-e — Management Berichten Inbox Build
*Serendipity Projects | Mei 2026*

---

## What you are building

A dedicated `/management/berichten` inbox page for WAV-e. This is where management reads and replies to messages sent by trainers. It aggregates all trainer messages across all trainers in one place, newest unread first. Management can reply inline. Clicking a trainer name links to `/trainer/[id]`.

This is a new page + new API route. Nothing else changes.

---

## Stack

- Next.js 16 App Router, TypeScript strict mode
- Supabase (`@supabase/ssr`) — service role key in API routes, anon key in client via `getSupabase()` from `src/lib/supabase.ts`
- Inline styles only — no Tailwind. Use CSS variables already defined in the codebase (see reference below)
- `'use client'` on all page files
- Deployed on Vercel via GitHub (`Jaylijpekay/wav-e`)
- iPad 7th gen (10.2", Safari, iPadOS) is a primary device — touch targets and font sizes matter

---

## Read first

Before writing any code, read these files completely:

1. `src/app/management/page.tsx` — understand the existing page structure, CSS variable names, component patterns, `inputStyle`, `touchButtonStyle`, `labelStyle`, the existing `NotitieModal` component, and how data is fetched
2. `src/app/api/trainer-notities/[trainer_id]/route.ts` — the existing GET/POST route you will extend
3. `src/lib/supabase.ts` — client factory
4. `src/app/components/Navigation.tsx` — so the new page uses Navigation correctly

Do not write a single line of code before reading all four.

---

## CSS variable reference

Use only these variables — do not invent new ones:

```
--bg-base          background of full page
--bg-surface       card / section background
--bg-raised        table headers, input backgrounds, hover states
--border-subtle    default borders
--border-strong    stronger borders
--text-primary     main text
--text-muted       secondary text / labels
--text-dim         very quiet text
--color-accent     indigo — primary action color
--color-accent-text indigo text variant
--color-white      white
--red-text         destructive / error text
--red-danger       destructive background accent
--amber-text       warning text
--green-signal-text success / active text
--wave-green       trainer color (green)
```

---

## Live DB schema (authoritative)

**`trainer_notities`:**
`id uuid`, `trainer_id uuid`, `auteur_id uuid`, `auteur_type text` (`'trainer'` | `'management'` | `'admin'`), `tekst text`, `aangemaakt_op timestamptz`, `verwijderd boolean`, `verwijderd_op timestamptz`, `gelezen_door_management boolean DEFAULT false`, `gelezen_op timestamptz`, `lid_id uuid nullable`

**`trainers`:**
`id uuid`, `voornaam text`, `achternaam text`, `naam text`, `email text`, `actief boolean`, `pin_hash text`

**`leden`:**
`id uuid`, `lid_id text`, `voornaam text`, `achternaam text`, `actief boolean`, `status text`, `trainer_id uuid`

**`management_gebruikers`:**
`id uuid`, `voornaam text`, `achternaam text`, `email text`, `actief boolean`

---

## Existing API route — extend, do not rewrite

`GET /api/trainer-notities/[trainer_id]` already:
- Fetches all non-deleted messages for a trainer, ASC by `aangemaakt_op`
- Joins auteur naam from `trainers` and `management_gebruikers`
- When called by management/admin, marks all unread trainer messages as read (fire-and-forget)
- Returns `{ notities: TrainerNotitieItem[] }`

You do not need to change this route. The inbox page calls it per trainer.

---

## What to build

### 1. New API route — `src/app/api/trainer-notities/route.ts`

**GET — inbox aggregate**

This is a new route at the base path (no `[trainer_id]` param). It returns all unread trainer messages across all trainers, for the management inbox.

```
GET /api/trainer-notities
```

Auth: `getUser()` → `get_my_role()` → must be `'management'` or `'admin'`. Trainers cannot access this route.

Query:
```sql
SELECT
  tn.id,
  tn.trainer_id,
  tn.auteur_id,
  tn.auteur_type,
  tn.tekst,
  tn.aangemaakt_op,
  tn.gelezen_door_management,
  tn.lid_id,
  t.voornaam,
  t.achternaam,
  t.naam
FROM trainer_notities tn
JOIN trainers t ON t.id = tn.trainer_id
WHERE tn.verwijderd = false
  AND tn.auteur_type = 'trainer'
ORDER BY tn.gelezen_door_management ASC, tn.aangemaakt_op DESC
```

Unread first (`gelezen_door_management = false` sorts before `true`), then newest within each group.

Also join `lid_id` → `leden` to resolve lid name when `lid_id` is not null. Do this in a second query after the first (fetch unique lid_ids, then fetch those leden rows), same pattern as `resolveAuteurNamen` in the existing route.

Response:
```typescript
{
  berichten: BerichtItem[]
}

type BerichtItem = {
  id: string
  trainer_id: string
  trainer_naam: string  // t.naam ?? `${t.voornaam} ${t.achternaam}`
  auteur_id: string
  tekst: string
  aangemaakt_op: string
  gelezen_door_management: boolean
  lid_id: string | null
  lid_naam: string | null  // null when lid_id is null
}
```

Do not mark messages as read on this GET — the inbox shows read/unread status visually. Messages are marked read when the trainer thread is opened (existing route handles that).

---

### 2. New page — `src/app/management/berichten/page.tsx`

**Route:** `/management/berichten`

**Access:** management and admin only. If role is not management or admin, redirect to `/`.

**Page structure:**

```
<Navigation />
<div page wrapper>
  <div header row>
    <div>
      <h1>Berichten</h1>
      <p>Berichten van trainers</p>
    </div>
    <a href="/management">← Terug naar overzicht</a>
  </div>

  <section card>
    {loading state}
    {empty state}
    {bericht list}
  </section>

  {reply modal when replyTarget is set}
</div>
```

**Data fetch on mount:**
```typescript
// 1. Fetch role to guard page
const { data: role } = await supabase.rpc('get_my_role')
if (role !== 'management' && role !== 'admin') router.replace('/')

// 2. Fetch inbox
const res = await fetch('/api/trainer-notities')
const { berichten } = await res.json()
```

**Bericht list item** — one card per message:

```
[unread dot if !gelezen_door_management]  [trainer naam]  [datum]
[tekst — full, not truncated]
[→ lid naam] (only if lid_id is set — clickable, navigates to /leden/[lid_id])
[Beantwoorden knop]
```

Layout per card:
- Left border: `3px solid rgba(99,102,241,0.0)` when read, `3px solid rgba(99,102,241,0.5)` when unread (indigo for trainer messages to management)
- Background: `var(--bg-surface)` read, `var(--bg-raised)` unread
- Unread dot: `8px` circle, `var(--color-accent)` fill, inline before trainer name
- Trainer name: `14px`, `fontWeight: 700`, `color: var(--text-primary)` — links to `/trainer/[trainer_id]`
- Datum: `12px`, `color: var(--text-muted)`, formatted as `dd mmm yyyy` in Dutch (`nl-NL` locale)
- Tekst: `14px`, `color: var(--text-primary)`, `lineHeight: 1.6`
- Lid link: `12px`, `color: var(--color-accent-text)`, `cursor: pointer`, prefixed with `→`
- `Beantwoorden` button: small, ghost style, `minHeight: 44px` for touch

**Sorting:** Unread messages first, then read, each group newest first. This matches the API sort order — render in the order returned.

**Empty state:**
```
Geen berichten van trainers.
```
Centered, `color: var(--text-muted)`, `fontSize: 13`.

**Pagination:** Show first 20. `Toon meer` button if more exist. Load 20 more per click. Client-side slice of the full fetched array — do not paginate the API call.

---

### 3. Reply modal — inline component in `berichten/page.tsx`

When management taps `Beantwoorden` on a message, a modal opens to write a reply to that trainer.

**State:**
```typescript
const [replyTarget, setReplyTarget] = useState<BerichtItem | null>(null)
const [replyTekst, setReplyTekst] = useState('')
const [replySaving, setReplySaving] = useState(false)
const [replyError, setReplyError] = useState<string | null>(null)
```

**Modal structure:**
```
[overlay]
  [modal card]
    [header] Beantwoorden → [trainer naam]
    [textarea] placeholder: "Schrijf een reactie…" rows=4 maxLength=1000
    [char counter — verschijnt bij 800+]
    [error display]
    [footer]
      [Annuleren] [Versturen]
```

**POST on submit:**
```typescript
const res = await fetch(`/api/trainer-notities/${replyTarget.trainer_id}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tekst: replyTekst.trim() }),
})
```

On success: close modal, clear textarea, reload berichten (re-fetch from API).

Validation: `replyTekst.trim()` must not be empty, max 1000 chars.

**Modal styling:** Match `NotitieModal` in `src/app/management/page.tsx` exactly — same overlay, same card radius, same padding, same button styles. Read that component before writing this one.

---

### 4. Add berichten link to management navigation

**File:** `src/app/management/page.tsx`

In the page header row (around line 925–935 where the `+ Lid toevoegen` button lives), add a secondary navigation link:

```tsx
<a
  href="/management/berichten"
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    padding: '8px 16px',
    background: 'none',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  }}
>
  Berichten
  {totalUnread > 0 && (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      background: 'rgba(99,102,241,0.15)',
      color: 'var(--color-accent-text)',
      fontSize: 10,
      fontWeight: 700,
      padding: '0 5px',
    }}>
      {totalUnread}
    </span>
  )}
</a>
```

`totalUnread` is a new state variable derived from the unread count fetch. Add to the existing `load()` function in `ManagementPage`:

```typescript
const [totalUnread, setTotalUnread] = useState(0)

// Inside load(), after existing Promise.all:
const unreadRes = await fetch('/api/trainer-notities')
if (unreadRes.ok) {
  const { berichten } = await unreadRes.json()
  const unread = (berichten as { gelezen_door_management: boolean }[])
    .filter(b => !b.gelezen_door_management).length
  setTotalUnread(unread)
  // Also derive per-trainer unread counts for the existing unreadCounts state
  const counts: Record<string, number> = {}
  for (const b of berichten) {
    if (!b.gelezen_door_management) {
      counts[b.trainer_id] = (counts[b.trainer_id] ?? 0) + 1
    }
  }
  setUnreadCounts(counts)
}
```

This replaces the separate unread count fetch if one was previously added — use this single fetch to populate both `totalUnread` and `unreadCounts`.

Also add the unread dot to the trainer table row — trainer name cell, inline after the name, using `unreadCounts[t.id]`. Pattern:

```tsx
{(unreadCounts[t.id] ?? 0) > 0 && (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, borderRadius: 9,
    background: 'rgba(99,102,241,0.15)',
    color: 'var(--color-accent-text)',
    fontSize: 10, fontWeight: 700, padding: '0 5px',
  }}>
    {unreadCounts[t.id]}
  </span>
)}
```

---

## Touch and iPad requirements

Every interactive element:
- `minHeight: 44` — no exceptions
- `fontSize: '1rem'` on all `<input>` and `<textarea>` elements (prevents iOS Safari zoom)
- `touchAction: 'manipulation'` on buttons
- Modal overlay must close on outside tap: `onClick={e => { if (e.target === e.currentTarget) closeModal() }}`

---

## Auth pattern — API route

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
}
```

Then:
```typescript
const supabase = await getSupabaseServer()
const { data: { user }, error: userError } = await supabase.auth.getUser()
if (userError || !user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

const { data: role } = await supabase.rpc('get_my_role')
if (role !== 'management' && role !== 'admin') {
  return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
}
```

---

## Silent failure rules

- Every `.insert()` must chain `.select('id')` and check `data?.length`
- Every `.update()` must chain `.select('id')` and check `data?.length`
- Never use `.delete()` on application data

---

## Execution order

1. Read all four files listed in "Read first"
2. Build `src/app/api/trainer-notities/route.ts` (new base route) → confirm
3. Build `src/app/management/berichten/page.tsx` → confirm
4. Update `src/app/management/page.tsx` (berichten link + unread counts) → confirm
5. Run `npm run build` — must pass
6. Run `npx tsc --noEmit` — must pass
7. Run `npm run lint` — must pass

One file per output. Confirm before next.

---

## Output format

After each file:
```
FILE: src/app/...
STATUS: done
NOTES: [anything unexpected found in the read pass, variable names used, decisions made]
```

After all files:
```
BUILD: PASS | FAIL
TSC:   PASS | FAIL
LINT:  PASS | FAIL
```

---

## What not to do

- Do not change the existing `GET /api/trainer-notities/[trainer_id]/route.ts`
- Do not change `/trainer/[trainerId]/page.tsx`
- Do not change any auth logic
- Do not add Tailwind classes
- Do not change Dutch copy
- Do not hard-delete any data
- Do not add features beyond what is specified here
- Do not create a drawer — the decision was made to build a dedicated page instead

---

*WAV-e Berichten Inbox Build | Serendipity Projects | Mei 2026*
*Authors: Jay Kerkhof + Claude (Anthropic)*
