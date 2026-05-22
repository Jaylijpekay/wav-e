# Codex Task — WAV-e Notities · Iteratie 7
# UI evaluatie pagina: cyclus-gebonden notities thread

## Prerequisites

Iteraties 1–6 must be complete and verified on production before starting this.

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Supabase
Target file: `src/app/leden/[id]/evaluatie/[cyclus]/page.tsx`

This is an additive change only. Read the full file before writing anything.
All existing evaluatie display logic is preserved.

---

## What to build

Two additive blocks at the bottom of the evaluatie page:

1. **Historische aantekening** — read-only display of `evaluaties.notities` (the old text blob), shown only if non-null and non-empty
2. **Cyclus notities thread** — filtered notities where `evaluatie_id` matches this evaluatie's UUID, with a write input that sets `evaluatie_id` on POST

---

## Step 1 — Read the file

Read `src/app/leden/[id]/evaluatie/[cyclus]/page.tsx` in full. Identify:
1. How the `evaluatie` record is fetched — specifically the `id` (UUID) field and the `notities` text column
2. The `lid_id` (UUID) for the API call
3. The `params` structure — `params.id` is lid UUID, `params.cyclus` is the cyclus number
4. Where the page content ends — new blocks go at the very bottom before the closing container
5. Existing styling patterns — match them exactly

---

## Step 2 — New type

Add above the component (or alongside existing types):

```typescript
type CyclusNotitie = {
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

## Step 3 — New state

Add to the component:

```typescript
const [cyclusNotities,        setCyclusNotities]        = useState<CyclusNotitie[]>([])
const [cyclusNotitiesLoading, setCyclusNotitiesLoading] = useState(true)
const [cyclusNotitieTekst,    setCyclusNotitieTekst]    = useState('')
const [cyclusNotitiePosting,  setCyclusNotitiePosting]  = useState(false)
const [cyclusNotitieError,    setCyclusNotitieError]    = useState<string | null>(null)
```

---

## Step 4 — Data fetch

Add a `useEffect` that fires when the `evaluatie` record is loaded and has a UUID.

The evaluatie's `id` (UUID) is needed for the `evaluatie_id` filter. Identify the state variable that holds the loaded evaluatie record — it will have an `id` field.

```typescript
useEffect(() => {
  if (!evaluatie?.id || !params.id) return
  const fetchCyclusNotities = async () => {
    setCyclusNotitiesLoading(true)
    try {
      const res = await fetch(
        `/api/notities/${params.id}?evaluatie_id=${evaluatie.id}`
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCyclusNotities(data.notities ?? [])
    } catch {
      // silent
    } finally {
      setCyclusNotitiesLoading(false)
    }
  }
  fetchCyclusNotities()
}, [evaluatie?.id, params.id])
```

Replace `evaluatie` with whatever the actual state variable name is in the file.

---

## Step 5 — Post handler

```typescript
const postCyclusNotitie = async () => {
  if (!cyclusNotitieTekst.trim() || !evaluatie?.id) return
  setCyclusNotitiePosting(true)
  setCyclusNotitieError(null)
  try {
    const res = await fetch(`/api/notities/${params.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tekst: cyclusNotitieTekst.trim(),
        evaluatie_id: evaluatie.id,
        // toon_aan_trainer is always false when written from evaluatie page
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      setCyclusNotitieError(err.error ?? 'Opslaan mislukt')
      return
    }
    const data = await res.json()
    setCyclusNotities(prev => [data.notitie, ...prev])
    setCyclusNotitieTekst('')
  } catch {
    setCyclusNotitieError('Verbindingsfout')
  } finally {
    setCyclusNotitiePosting(false)
  }
}
```

---

## Step 6 — Delete handler

```typescript
const deleteCyclusNotitie = async (notitieId: string) => {
  setCyclusNotities(prev => prev.filter(n => n.id !== notitieId))
  await fetch(`/api/notities/${params.id}/${notitieId}`, { method: 'DELETE' })
}
```

---

## Step 7 — JSX

Add at the bottom of the page content, before the closing container div.

**Block A — Historische aantekening (read-only):**
Only render if `evaluatie.notities` is non-null and non-empty after trim.

```tsx
{evaluatie?.notities?.trim() && (
  <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
    <div style={{
      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
    }}>
      Historische aantekening
    </div>
    <div style={{
      padding: '12px 16px', borderRadius: 3,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '3px solid rgba(255,255,255,0.1)',
      fontSize: '0.8rem', color: 'var(--text-faint)',
      lineHeight: 1.6, fontStyle: 'italic',
    }}>
      {evaluatie.notities}
    </div>
    <div style={{ fontSize: '0.58rem', color: 'var(--text-faint)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      Opgeslagen tijdens gesprek · niet bewerkbaar
    </div>
  </div>
)}
```

**Block B — Cyclus notities thread:**

```tsx
<div style={{ marginTop: '2rem' }}>
  <div style={{
    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12,
    display: 'flex', alignItems: 'center', gap: 8,
  }}>
    <span>Aantekeningen bij deze cyclus</span>
    {cyclusNotities.length > 0 && (
      <span style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 2, fontWeight: 600 }}>
        {cyclusNotities.length}
      </span>
    )}
  </div>

  {cyclusNotitiesLoading ? (
    <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', padding: '0.5rem 0' }}>Laden…</div>
  ) : (
    <>
      {cyclusNotities.map(n => {
        const isMgmt = n.auteur_type === 'management' || n.auteur_type === 'admin'
        const borderColor = isMgmt ? 'rgba(99,102,241,0.5)' : 'rgba(168,200,0,0.25)'
        const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
        const date = new Date(n.aangemaakt_op)
        const dateLabel = `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
        return (
          <div
            key={n.id}
            style={{
              padding: '10px 14px', marginBottom: 6, borderRadius: 3,
              background: isMgmt ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderLeft: `3px solid ${borderColor}`,
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{n.tekst}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {n.auteur_naam} · {dateLabel}
              </span>
              <button
                onClick={() => deleteCyclusNotitie(n.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', color: 'var(--text-faint)', fontFamily: 'inherit', padding: '2px 0' }}
              >
                ×
              </button>
            </div>
          </div>
        )
      })}
      {cyclusNotities.length === 0 && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)', padding: '0.5rem 0' }}>
          Nog geen aantekeningen bij deze cyclus.
        </div>
      )}
    </>
  )}

  {/* Write input */}
  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <textarea
      value={cyclusNotitieTekst}
      onChange={e => setCyclusNotitieTekst(e.target.value)}
      placeholder="Aantekening toevoegen aan deze cyclus…"
      maxLength={1000}
      rows={3}
      style={{
        width: '100%', boxSizing: 'border-box', resize: 'vertical',
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3, padding: '10px 12px',
        color: 'var(--text-warm)', fontSize: '1rem', fontFamily: 'inherit', minHeight: 44,
      }}
    />
    {cyclusNotitieError && (
      <div style={{ fontSize: '0.8rem', color: 'var(--red-text)' }}>{cyclusNotitieError}</div>
    )}
    <button
      onClick={postCyclusNotitie}
      disabled={cyclusNotitiePosting || !cyclusNotitieTekst.trim()}
      style={{
        alignSelf: 'flex-end', padding: '10px 18px', minHeight: 44,
        background: 'rgba(168,200,0,0.9)', color: '#111',
        border: 'none', borderRadius: 3,
        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', fontFamily: 'inherit',
        cursor: cyclusNotitiePosting || !cyclusNotitieTekst.trim() ? 'default' : 'pointer',
        opacity: cyclusNotitiePosting || !cyclusNotitieTekst.trim() ? 0.5 : 1,
        touchAction: 'manipulation',
      }}
    >
      {cyclusNotitiePosting ? 'Opslaan…' : 'Toevoegen'}
    </button>
  </div>
</div>
```

---

## Verify after build

1. `npm run build` passes with zero TypeScript errors
2. Open a lid's evaluatie page as trainer
3. If old `evaluaties.notities` blob exists → "Historische aantekening" block renders read-only
4. If blob is null/empty → block is hidden entirely
5. Cyclus notities thread loads (empty on fresh evaluatie)
6. Write a aantekening → `evaluatie_id` is set in DB, notitie appears in thread
7. Same notitie also appears on the lid page (unified thread, no evaluatie filter)
8. Delete → disappears from cyclus thread and lid thread
9. Open a different cyclus for the same lid → that cyclus shows only its own notities

---

## Do not touch

- Any existing evaluatie display logic
- Any API routes
- Any other page
- DB schema
- Middleware

---

## Notes

- The key dependency is `evaluatie.id` (UUID) — confirm the exact state variable name by reading the file first
- `evaluatie.notities` is the old text blob column — it's a different field from the new `notities` table
- `toon_aan_trainer` is always `false` when posting from the evaluatie page — only management sets it via the NotitieModal
- These notities also surface on the unified lid page thread (no `evaluatie_id` filter there)
- Windows line endings (CRLF)
