# Codex Task — WAV-e Notities · Iteratie 3
# UI lid pagina: notities thread

## Prerequisites

Iteraties 1 and 2 must be complete and verified on production before starting this.

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
Target file: `src/app/leden/[id]/page.tsx`

This is an additive change only. Read the full file before writing anything.
All existing functionality is preserved — member header, evaluaties list, acties, navigation.

---

## What to build

A notities section on the lid page, placed **below the member header and above the evaluaties list**.

The section has two parts:
1. A chronological thread of existing notities (newest first)
2. A write input for adding a new notitie

---

## Step 1 — Read the file

Read `src/app/leden/[id]/page.tsx` in full. Identify:
1. Where the member header ends
2. Where the evaluaties list begins
3. How existing client-side data fetches are structured (pattern to follow)
4. Existing CSS class names and styling patterns (inline styles vs classes)
5. The `lid_id` param — it is the UUID, not the `lid_id` string

---

## Step 2 — State to add

Add to the component's state:

```typescript
const [notities,        setNotities]        = useState<Notitie[]>([])
const [notitiesLoading, setNotitiesLoading] = useState(true)
const [notitiesTekst,   setNotitiesTekst]   = useState('')
const [notitiesPosting, setNotitiesPosting] = useState(false)
const [notitiesError,   setNotitiesError]   = useState<string | null>(null)
const [toonAlle,        setToonAlle]        = useState(false)
```

Add this type above the component:

```typescript
type Notitie = {
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
}
```

---

## Step 3 — Data fetch

Add a separate `useEffect` to fetch notities client-side. Do not combine with the existing member data fetch.

```typescript
useEffect(() => {
  const fetchNotities = async () => {
    setNotitiesLoading(true)
    try {
      const res = await fetch(`/api/notities/${params.id}`)
      if (!res.ok) throw new Error('Ophalen mislukt')
      const data = await res.json()
      setNotities(data.notities ?? [])
    } catch {
      // silent — thread shows empty
    } finally {
      setNotitiesLoading(false)
    }
  }
  if (params.id) fetchNotities()
}, [params.id])
```

---

## Step 4 — Post handler

```typescript
const postNotitie = async () => {
  if (!notitiesTekst.trim()) return
  setNotitiesPosting(true)
  setNotitiesError(null)
  try {
    const res = await fetch(`/api/notities/${params.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tekst: notitiesTekst.trim() }),
      // toon_aan_trainer is always false when written from lid page
      // management sets it via the management modal (separate flow)
    })
    if (!res.ok) {
      const err = await res.json()
      setNotitiesError(err.error ?? 'Opslaan mislukt')
      return
    }
    const { notitie } = await res.json()
    // Wait — the POST returns the created notitie in the shape returned by iteratie 1
    // Check the actual response key from /api/notities/[lid_id] POST
    // If it returns { notitie: ... } use that. If { notities: [...] } adjust accordingly.
    setNotities(prev => [notitie, ...prev])
    setNotitiesTekst('')
  } catch {
    setNotitiesError('Verbindingsfout')
  } finally {
    setNotitiesPosting(false)
  }
}
```

---

## Step 5 — Delete handler

```typescript
const deleteNotitie = async (notitieId: string) => {
  // Optimistic: remove immediately
  setNotities(prev => prev.filter(n => n.id !== notitieId))
  try {
    await fetch(`/api/notities/${params.id}/${notitieId}`, { method: 'DELETE' })
  } catch {
    // If it fails, refetch
    const res = await fetch(`/api/notities/${params.id}`)
    const data = await res.json()
    setNotities(data.notities ?? [])
  }
}
```

---

## Step 6 — JSX

Place this block between the member header and the evaluaties list:

```tsx
{/* Notities sectie */}
<div style={{ marginBottom: '2rem' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
    <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
      Notities
    </span>
    {notities.length > 0 && (
      <span style={{ fontSize: '0.65rem', color: 'var(--border-muted-dark)', background: 'var(--surface-pressed)', padding: '2px 7px', borderRadius: 2, fontWeight: 600 }}>
        {notities.length}
      </span>
    )}
  </div>

  {/* Thread */}
  {notitiesLoading ? (
    <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', padding: '1rem 0' }}>Laden…</div>
  ) : (
    <>
      {(toonAlle ? notities : notities.slice(0, 10)).map(n => (
        <NotitieCard
          key={n.id}
          notitie={n}
          onDelete={() => deleteNotitie(n.id)}
        />
      ))}
      {!toonAlle && notities.length > 10 && (
        <button
          onClick={() => setToonAlle(true)}
          style={{ fontSize: '0.72rem', color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          Toon alle {notities.length} notities
        </button>
      )}
      {notities.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', padding: '1rem 0' }}>
          Nog geen notities.
        </div>
      )}
    </>
  )}

  {/* Write input */}
  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <textarea
      value={notitiesTekst}
      onChange={e => setNotitiesTekst(e.target.value)}
      placeholder="Schrijf een notitie…"
      maxLength={1000}
      rows={3}
      style={{
        width: '100%', boxSizing: 'border-box', resize: 'vertical',
        background: 'var(--surface-pressed)', border: '1px solid var(--border-muted-dark)',
        borderRadius: 3, padding: '10px 12px', color: 'var(--text-warm)',
        fontSize: '1rem', fontFamily: 'inherit', minHeight: 44,
      }}
    />
    {notitiesTekst.length >= 800 && (
      <div style={{ fontSize: '0.62rem', color: notitiesTekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-faint)', textAlign: 'right', letterSpacing: '0.06em' }}>
        {notitiesTekst.length}/1000
      </div>
    )}
    {notitiesError && (
      <div style={{ fontSize: '0.8rem', color: 'var(--red-text)' }}>{notitiesError}</div>
    )}
    <button
      onClick={postNotitie}
      disabled={notitiesPosting || !notitiesTekst.trim()}
      style={{
        alignSelf: 'flex-end', padding: '10px 18px', minHeight: 44,
        background: 'var(--wave-green)', color: '#111', border: 'none',
        borderRadius: 3, fontSize: '0.72rem', fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        cursor: notitiesPosting || !notitiesTekst.trim() ? 'default' : 'pointer',
        opacity: notitiesPosting || !notitiesTekst.trim() ? 0.5 : 1,
        fontFamily: 'inherit', touchAction: 'manipulation',
      }}
    >
      {notitiesPosting ? 'Opslaan…' : 'Toevoegen'}
    </button>
  </div>
</div>
```

---

## Step 7 — NotitieCard component

Add this component in the file, above the main page component:

```typescript
function NotitieCard({ notitie, onDelete }: { notitie: Notitie; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)

  const isMgmt = notitie.auteur_type === 'management' || notitie.auteur_type === 'admin'
  const borderColor = isMgmt ? 'rgba(99,102,241,0.5)' : 'rgba(168,200,0,0.25)'

  const date = new Date(notitie.aangemaakt_op)
  const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
  const dateLabel = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 16px', marginBottom: 6, borderRadius: 3,
        background: isMgmt ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderLeft: `3px solid ${borderColor}`,
        position: 'relative',
      }}
    >
      {notitie.toon_aan_trainer && (
        <span style={{
          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--amber-text)',
          background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)',
          borderRadius: 2, padding: '2px 6px', marginBottom: 6, display: 'inline-block',
        }}>
          Urgent voor trainer
        </span>
      )}
      <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        {notitie.tekst}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {notitie.auteur_naam} · {dateLabel}
        </div>
        {hovered && (
          <button
            onClick={onDelete}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.62rem', color: 'var(--red-text)', letterSpacing: '0.06em',
              textTransform: 'uppercase', fontWeight: 600, padding: '2px 0',
              fontFamily: 'inherit',
            }}
          >
            Verwijder
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## Verify after build

1. `npm run build` passes with zero TypeScript errors
2. Push to Vercel, verify on production
3. Open a lid page as trainer → notities sectie zichtbaar
4. Schrijf een notitie → verschijnt direct bovenaan de thread
5. Verwijder een notitie → verdwijnt direct, `verwijderd = true` in DB
6. Refresh → notitie is weg (verwijderd), andere notities persisteren
7. Notitie van management → indigo linkerborder
8. Notitie van trainer → groene linkerborder
9. `toon_aan_trainer = true` notitie → amber badge "Urgent voor trainer" zichtbaar

---

## Do not touch

- API routes (iteraties 1 en 2)
- Any other page
- DB schema
- Middleware

---

## Notes

- `params.id` is the lid UUID — use this in all API calls
- `toon_aan_trainer` is always `false` when posting from this page — management sets it via their own modal
- Hover-based delete button is fine for desktop; on touch devices it shows on mount (no hover state) — acceptable for v0.1.1
- Windows line endings (CRLF)
