# WAV-e v0.1.1 — Notities Feature Completion Patch
*Serendipity Projects | Mei 2026*

---

## What is already done

| Layer | Status |
|---|---|
| DB — `notities` table | ✓ Live |
| DB — `trainer_notities` table | ✓ Live |
| DB — `gelezen_door_management`, `gelezen_op`, `lid_id` columns on `trainer_notities` | ✓ Live (migration applied this session) |
| API — `GET /api/trainer-notities/[trainer_id]` | ✓ Updated — marks unread trainer messages as read when management opens, returns `gelezen_door_management`, `gelezen_op`, `lid_id` |
| API — `POST /api/trainer-notities/[trainer_id]` | ✓ Updated — accepts optional `lid_id` in body |
| RLS — all notities tables | ✓ Active |

---

## What still needs to be built

### 1. Unread count fetch — management page state

**File:** `src/app/management/page.tsx`

Add a new state variable and fetch to the existing `ManagementPage` component:

```typescript
// Add to state declarations (around line 748–762)
const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
```

Add to the `load()` function (after the existing `Promise.all` block, around line 813), fetching unread trainer messages per trainer:

```typescript
const { data: unreadData } = await supabase
  .from('trainer_notities')
  .select('trainer_id')
  .eq('auteur_type', 'trainer')
  .eq('gelezen_door_management', false)
  .eq('verwijderd', false)

const counts: Record<string, number> = {}
for (const row of unreadData ?? []) {
  counts[row.trainer_id] = (counts[row.trainer_id] ?? 0) + 1
}
setUnreadCounts(counts)
```

---

### 2. Unread dot in trainer table row

**File:** `src/app/management/page.tsx`
**Location:** Trainer table row, `Trainer` name cell — around line 983–993

Replace the trainer name `<span>` with a wrapper that includes an unread indicator dot. The dot sits inline to the right of the name, only renders when `unreadCounts[t.id] > 0`.

```tsx
<td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
    <span
      onClick={() => router.push(`/trainer/${t.id}`)}
      style={{
        fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
        cursor: 'pointer', textDecoration: 'underline',
        textDecorationColor: 'transparent', textUnderlineOffset: 3,
        transition: 'text-decoration-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--text-muted)')}
      onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
    >
      {t.voornaam} {t.achternaam}
    </span>
    {(unreadCounts[t.id] ?? 0) > 0 && (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 18, height: 18, borderRadius: 9,
        background: 'rgba(99,102,241,0.15)',
        color: 'var(--color-accent-text)',
        fontSize: 10, fontWeight: 700, padding: '0 5px',
        lineHeight: 1,
      }}>
        {unreadCounts[t.id]}
      </span>
    )}
  </span>
  {!t.actief && (
    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
      inactief
    </span>
  )}
</td>
```

---

### 3. Trainer dashboard — notities thread (Iteratie 6)

**File:** `src/app/trainer/[trainerId]/page.tsx`

The spec notes a `td-notities` slot commented out in the momentum rebuild section. Activate it. Full behaviour:

**State to add:**
```typescript
const [trainerNotities, setTrainerNotities] = useState<TrainerNotitie[]>([])
const [notitiesTekst,   setNotitiesTekst]   = useState('')
const [notitiesLadend,  setNotitiesLadend]  = useState(false)
const [notitiesMax,     setNotitiesMax]      = useState(5)
```

**Type:**
```typescript
type TrainerNotitie = {
  id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  auteur_naam: string
  tekst: string
  aangemaakt_op: string
  gelezen_door_management: boolean
  lid_id: string | null
}
```

**Fetch** — add to existing `useEffect` load:
```typescript
const notitiesRes = await fetch(`/api/trainer-notities/${trainerId}`)
if (notitiesRes.ok) {
  const { notities } = await notitiesRes.json()
  setTrainerNotities(notities)
}
```

**Post handler:**
```typescript
const verstuurNotitie = async () => {
  if (!notitiesTekst.trim() || notitiesTekst.length > 1000) return
  const res = await fetch(`/api/trainer-notities/${trainerId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tekst: notitiesTekst.trim() }),
  })
  if (!res.ok) return
  const nieuw = await res.json()
  setTrainerNotities(prev => [...prev, nieuw])
  setNotitiesTekst('')
}
```

**Thread UI** (render in the `td-notities` slot):
```tsx
<section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
  <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Berichten</div>
  </div>

  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
    {trainerNotities.slice(0, notitiesMax).map((n, i) => (
      <div key={n.id} style={{
        padding: '14px 24px',
        borderBottom: i < Math.min(trainerNotities.length, notitiesMax) - 1
          ? '1px solid var(--border-subtle)' : 'none',
        borderLeft: `3px solid ${n.auteur_type === 'management' || n.auteur_type === 'admin'
          ? 'rgba(99,102,241,0.4)'
          : 'rgba(var(--wave-green-rgb, 34,197,94), 0.35)'}`,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{n.tekst}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {n.auteur_naam} · {new Date(n.aangemaakt_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
    ))}

    {trainerNotities.length === 0 && (
      <div style={{ padding: '24px', fontSize: 13, color: 'var(--text-muted)' }}>Nog geen berichten.</div>
    )}
  </div>

  {trainerNotities.length > notitiesMax && (
    <button
      onClick={() => setNotitiesMax(n => n + 10)}
      style={{ width: '100%', padding: '12px', fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
    >
      Toon meer
    </button>
  )}

  {/* Write input */}
  <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <textarea
      value={notitiesTekst}
      onChange={e => setNotitiesTekst(e.target.value)}
      placeholder="Schrijf een bericht aan management…"
      rows={3}
      maxLength={1000}
      style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)',
        fontSize: '1rem', resize: 'vertical', width: '100%',
        boxSizing: 'border-box', fontFamily: 'inherit',
      }}
    />
    {notitiesTekst.length >= 800 && (
      <div style={{ fontSize: 11, color: notitiesTekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-muted)', textAlign: 'right' }}>
        {notitiesTekst.length}/1000
      </div>
    )}
    <button
      onClick={verstuurNotitie}
      disabled={!notitiesTekst.trim()}
      style={{
        alignSelf: 'flex-end', minHeight: 44, padding: '9px 20px',
        background: 'var(--color-accent)', color: 'var(--color-white)',
        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: notitiesTekst.trim() ? 'pointer' : 'default',
        opacity: notitiesTekst.trim() ? 1 : 0.5,
      }}
    >
      Versturen
    </button>
  </div>
</section>
```

---

### 4. Lid page — notities thread (Iteratie 3)

**File:** `src/app/leden/[id]/page.tsx`

Add a notities thread section below the member header, above the evaluaties list.

**State:**
```typescript
const [notities,       setNotities]       = useState<LidNotitie[]>([])
const [notitiesTekst,  setNotitiesTekst]  = useState('')
const [notitiesMax,    setNotitiesMax]    = useState(10)
```

**Type:**
```typescript
type LidNotitie = {
  id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  auteur_naam: string
  tekst: string
  aangemaakt_op: string
}
```

**Fetch** on load:
```typescript
const notitiesRes = await fetch(`/api/notities/${lidId}`)
if (notitiesRes.ok) {
  const { notities } = await notitiesRes.json()
  setNotities(notities)
}
```

**Delete handler:**
```typescript
const verwijderNotitie = async (notitieId: string) => {
  // Optimistic
  setNotities(prev => prev.filter(n => n.id !== notitieId))
  await fetch(`/api/notities/${lidId}/${notitieId}`, { method: 'DELETE' })
}
```

**Post handler:**
```typescript
const voegNotitieToE = async () => {
  if (!notitiesTekst.trim() || notitiesTekst.length > 1000) return
  const res = await fetch(`/api/notities/${lidId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tekst: notitiesTekst.trim() }),
  })
  if (!res.ok) return
  const nieuw = await res.json()
  setNotities(prev => [nieuw, ...prev])
  setNotitiesTekst('')
}
```

**Thread UI:** Same card pattern as trainer thread. Border color: indigo for management/admin, green for trainer. Newest first. Show delete button on hover (`opacity: 0` → `1` on `onMouseEnter`). Char counter at 800+. `Toon meer` after 10.

---

### 5. API routes still to be created

The following API route files do not exist yet and must be created:

| File | Method | Purpose |
|---|---|---|
| `src/app/api/notities/[lid_id]/route.ts` | GET, POST | Lid notities fetch + create |
| `src/app/api/notities/[lid_id]/[notitie_id]/route.ts` | DELETE | Soft delete lid notitie |
| `src/app/api/trainer-notities/[trainer_id]/[notitie_id]/route.ts` | DELETE | Soft delete trainer notitie |

**Pattern for all three — copy from the existing trainer-notities route:**
- Auth via `createServerClient` + `SUPABASE_SERVICE_ROLE_KEY`
- `get_my_role()` + `get_my_trainer_id()` via `.rpc()`
- Soft delete: `UPDATE SET verwijderd = true, verwijderd_op = now()` — chain `.select('id')` to catch silent failures
- Response: `{ success: true }` on DELETE, `{ notities: [...] }` on GET, the created record on POST

**GET /api/notities/[lid_id]** specifics:
- Optional query param `?evaluatie_id=[uuid]` — add `.eq('evaluatie_id', evaluatieId)` when present
- Join auteur naam: same `resolveAuteurNamen` pattern as trainer-notities route
- Auth: trainer (own members only — check `trainers.id` matches session trainer and `leden.trainer_id` matches) | management | admin

---

## Verification checklist per item

| # | Test |
|---|---|
| Unread count | Write a trainer_notitie as trainer → management page shows count dot on that trainer row |
| Mark as read | Management clicks through to `/trainer/[id]` → count dot disappears on next management page load |
| Trainer thread | Trainer writes bericht → appears with green border. Management writes → indigo border |
| Lid thread | Trainer writes notitie on lid page → appears, persists on refresh |
| Delete | Optimistic remove, `verwijderd = true` in DB confirmed via Supabase execute_sql |
| lid_id link | Trainer notitie with lid_id set → lid name shows in thread on management side |
| evaluatie_id filter | Notitie written on evaluatie page → only shows on that cyclus, also visible in unfiltered lid thread |

---

## Out of scope (v0.1.1)

- Management UI to write into `trainer_notities` from the management page directly (→ v0.1.2)
- Push notifications or badge counters in nav (→ v0.2)
- Bulk delete or edit of notities
- Notities export

---

*WAV-e v0.1.1 Notities Patch | Serendipity Projects | Mei 2026*
*Authors: Jay Kerkhof + Claude (Anthropic)*
