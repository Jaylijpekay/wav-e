# Codex Task — WAV-e Notities · Iteratie 5
# UI trainer dashboard: berichten thread + urgente alerts

## Prerequisites

Iteraties 1–4 must be complete and verified on production before starting this.

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
Target file: `src/app/trainer/[trainerId]/page.tsx`

This is an additive change only. Read the full file before writing anything.
All existing functionality — momentum strip, stoplicht bar, portal grid, AddLidModal — is preserved exactly.

---

## What to build

Two new sections in the trainer dashboard body, placed **between the portal grid and the end of `td-body`**:

1. **Urgente meldingen** — notities on leden where `toon_aan_trainer = true` and `gezien = false`, shown as alert cards with a "Gezien" button
2. **Berichten** — the two-way `trainer_notities` thread between this trainer and management

---

## Step 1 — Read the file

Read `src/app/trainer/[trainerId]/page.tsx` in full. Identify:
1. All existing state variables
2. The existing commented-out `td-notities` slot — this is replaced by the two new sections below
3. The `td-body` closing div — new sections go before it
4. Existing CSS in the `<style>` block — extend, never replace

---

## Step 2 — New types

Add above the component:

```typescript
type UrgenteMelding = {
  id: string
  lid_id: string
  lid_naam: string
  tekst: string
  auteur_naam: string
  aangemaakt_op: string
}

type TrainerNotitie = {
  id: string
  trainer_id: string
  auteur_id: string
  auteur_type: 'trainer' | 'management' | 'admin'
  auteur_naam: string
  tekst: string
  aangemaakt_op: string
}
```

---

## Step 3 — New state

Add to the component state:

```typescript
const [meldingen,         setMeldingen]         = useState<UrgenteMelding[]>([])
const [meldingenLoading,  setMeldingenLoading]  = useState(true)
const [berichten,         setBerichten]         = useState<TrainerNotitie[]>([])
const [berichtenLoading,  setBerichtenLoading]  = useState(true)
const [berichtTekst,      setBerichtTekst]      = useState('')
const [berichtPosting,    setBerichtPosting]    = useState(false)
```

---

## Step 4 — Data fetches

Add two separate `useEffect` hooks after the existing load effect.

**Urgente meldingen:**
Fetch all notities for this trainer's leden where `toon_aan_trainer = true` and `gezien = false`.
These come from the Supabase client directly — not the API — because the existing `useEffect` already has `lidIds` and the Supabase client.

Add inside the existing main `useEffect`, after `setActies(...)` and before `setLoading(false)`:

```typescript
// Urgente meldingen: notities flagged toon_aan_trainer=true and not yet gezien
if (lidIds.length > 0) {
  const { data: meldingenData } = await supabase
    .from('notities')
    .select('id, lid_id, tekst, auteur_id, auteur_type, aangemaakt_op')
    .in('lid_id', lidIds)
    .eq('toon_aan_trainer', true)
    .eq('gezien', false)
    .eq('verwijderd', false)
    .order('aangemaakt_op', { ascending: false })

  // Resolve auteur naam and lid naam inline
  const enriched: UrgenteMelding[] = (meldingenData ?? []).map(m => {
    const lid = ledenData.find(l => l.id === m.lid_id)
    return {
      id: m.id,
      lid_id: m.lid_id,
      lid_naam: lid ? `${lid.voornaam} ${lid.achternaam}` : '—',
      tekst: m.tekst,
      auteur_naam: 'Management', // management is always the author of toon_aan_trainer notities
      aangemaakt_op: m.aangemaakt_op,
    }
  })
  setMeldingen(enriched)
  setMeldingenLoading(false)
}
```

**Berichten (trainer_notities):**
Add a separate `useEffect`:

```typescript
useEffect(() => {
  const fetchBerichten = async () => {
    setBerichtenLoading(true)
    try {
      const res = await fetch(`/api/trainer-notities/${trainerId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setBerichten(data.notities ?? [])
    } catch {
      // silent
    } finally {
      setBerichtenLoading(false)
    }
  }
  if (trainerId) fetchBerichten()
}, [trainerId])
```

---

## Step 5 — Handlers

**Mark gezien:**
```typescript
const markGezien = async (notitieId: string, lidId: string) => {
  // Optimistic: remove from meldingen immediately
  setMeldingen(prev => prev.filter(m => m.id !== notitieId))
  try {
    await fetch(`/api/notities/${lidId}/${notitieId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gezien: true }),
    })
  } catch {
    // If fails, refetch — for now silent fail is acceptable
  }
}
```

**Post bericht:**
```typescript
const postBericht = async () => {
  if (!berichtTekst.trim()) return
  setBerichtPosting(true)
  try {
    const res = await fetch(`/api/trainer-notities/${trainerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tekst: berichtTekst.trim() }),
    })
    if (!res.ok) return
    const data = await res.json()
    // Append to end (ASC order — newest at bottom)
    setBerichten(prev => [...prev, data.notitie])
    setBerichtTekst('')
  } finally {
    setBerichtPosting(false)
  }
}
```

**Delete bericht:**
```typescript
const deleteBericht = async (notitieId: string) => {
  setBerichten(prev => prev.filter(b => b.id !== notitieId))
  await fetch(`/api/trainer-notities/${trainerId}/${notitieId}`, { method: 'DELETE' })
}
```

---

## Step 6 — JSX

Replace the existing commented-out `td-notities` slot with these two sections.

**Section 1 — Urgente meldingen:**

```tsx
{/* Urgente meldingen */}
{!meldingenLoading && meldingen.length > 0 && (
  <div style={{ marginBottom: '2rem', animation: 'fadeUp 0.5s ease-out 0.22s both' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
      <span className="td-section-title">Urgente meldingen</span>
      <span className="td-section-count">{meldingen.length}</span>
    </div>
    {meldingen.map(m => (
      <div key={m.id} className="td-melding-card">
        <div className="td-melding-lid">{m.lid_naam}</div>
        <div className="td-melding-tekst">{m.tekst}</div>
        <div className="td-melding-footer">
          <span className="td-melding-meta">{m.auteur_naam} · {new Date(m.aangemaakt_op).toLocaleDateString('nl-NL')}</span>
          <button
            className="td-melding-gezien"
            onClick={() => markGezien(m.id, m.lid_id)}
          >
            ✓ Gezien
          </button>
        </div>
      </div>
    ))}
  </div>
)}
```

**Section 2 — Berichten thread:**

```tsx
{/* Berichten — twee-weg thread met management */}
<div style={{ marginBottom: '2rem', animation: 'fadeUp 0.5s ease-out 0.26s both' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
    <span className="td-section-title">Berichten</span>
    {berichten.length > 0 && <span className="td-section-count">{berichten.length}</span>}
  </div>

  {berichtenLoading ? (
    <div className="td-empty" style={{ padding: '1.5rem 0' }}>Laden…</div>
  ) : berichten.length === 0 ? (
    <div className="td-empty" style={{ padding: '1.5rem 0' }}>Geen berichten.</div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: '1rem' }}>
      {berichten.slice(-5).map(b => {
        const isSelf = b.auteur_type === 'trainer'
        const borderColor = isSelf ? 'rgba(168,200,0,0.35)' : 'rgba(99,102,241,0.5)'
        const bg = isSelf ? 'rgba(168,200,0,0.04)' : 'rgba(99,102,241,0.05)'
        const date = new Date(b.aangemaakt_op)
        const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
        const dateLabel = `${date.getDate()} ${MONTHS[date.getMonth()]}`
        return (
          <div
            key={b.id}
            style={{
              padding: '12px 16px', borderRadius: 3, background: bg,
              border: '1px solid rgba(255,255,255,0.04)',
              borderLeft: `3px solid ${borderColor}`,
              position: 'relative',
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>{b.tekst}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {b.auteur_naam} · {dateLabel}
              </span>
              <button
                onClick={() => deleteBericht(b.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit', padding: '2px 0' }}
              >
                ×
              </button>
            </div>
          </div>
        )
      })}
      {berichten.length > 5 && (
        <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 0' }}>
          + {berichten.length - 5} oudere berichten
        </div>
      )}
    </div>
  )}

  {/* Write input */}
  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
    <textarea
      value={berichtTekst}
      onChange={e => setBerichtTekst(e.target.value)}
      placeholder="Schrijf een bericht aan management…"
      maxLength={1000}
      rows={2}
      style={{
        flex: 1, resize: 'none', background: 'var(--surface-pressed)',
        border: '1px solid var(--border-muted-dark)', borderRadius: 3,
        padding: '10px 12px', color: 'var(--text-warm)', fontSize: '1rem',
        fontFamily: 'inherit', minHeight: 44,
      }}
    />
    <button
      onClick={postBericht}
      disabled={berichtPosting || !berichtTekst.trim()}
      className="td-btn-secondary"
      style={{ opacity: berichtPosting || !berichtTekst.trim() ? 0.4 : 1, flexShrink: 0 }}
    >
      {berichtPosting ? '…' : 'Versturen'}
    </button>
  </div>
</div>
```

---

## Step 7 — CSS to add to `<style>` block

```css
/* ── Urgente meldingen ── */
.td-melding-card {
  padding: 14px 18px; margin-bottom: 8px; border-radius: 3px;
  background: rgba(217,119,6,0.06);
  border: 1px solid rgba(217,119,6,0.2);
  border-left: 3px solid rgba(217,119,6,0.6);
  animation: fadeUp 0.3s ease-out both;
}
.td-melding-lid {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--amber-text); margin-bottom: 4px;
}
.td-melding-tekst {
  font-size: 0.88rem; color: var(--text-warm); line-height: 1.5;
}
.td-melding-footer {
  display: flex; align-items: center; justify-content: space-between; margin-top: 8px;
}
.td-melding-meta {
  font-size: 0.62rem; color: var(--text-faint);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.td-melding-gezien {
  font-family: 'Raleway', sans-serif;
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--wave-green);
  background: rgba(168,200,0,0.08); border: 1px solid rgba(168,200,0,0.25);
  border-radius: 2px; padding: 4px 10px; cursor: pointer; min-height: 32px;
  touch-action: manipulation; transition: background 0.15s;
}
.td-melding-gezien:hover { background: rgba(168,200,0,0.14); }
.td-melding-gezien:active { background: rgba(168,200,0,0.20); }

/* ── Section header (re-add since dashboard cleanup removed it) ── */
.td-section-title {
  font-size: 0.65rem; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--text-faint);
}
.td-section-count {
  font-size: 0.65rem; color: var(--border-muted-dark);
  background: var(--surface-pressed); padding: 2px 7px;
  border-radius: 2px; font-weight: 600;
}
```

Add to tablet breakpoint:
```css
.td-melding-card { padding: 16px 20px; }
.td-melding-tekst { font-size: 0.92rem; }
```

---

## Step 8 — Remove commented-out notities slot

Delete the existing multi-line comment block that contains `{/* {managementNotities.length > 0 && ...} */}`.
It is replaced by the two sections above.

---

## Verify after build

1. `npm run build` passes with zero TypeScript errors
2. As trainer: no meldingen → section hidden entirely
3. As management (via admin): create a notitie on a lid with `toon_aan_trainer = true` → melding appears on trainer dashboard
4. Trainer clicks "✓ Gezien" → card disappears immediately, `gezien = true` in DB
5. Berichten thread shows existing trainer_notities in chronological order
6. Trainer writes a bericht → appears at bottom of thread with green left border
7. Management bericht shows indigo left border
8. Delete button removes bericht immediately

---

## Do not touch

- Any API routes
- Any other page files
- `AddLidModal`, `MomentumStrip` — zero changes
- DB schema
- Middleware

---

## Notes

- `td-section-title` and `td-section-count` were removed from this file during the portal rebuild — re-add them to the style block as specified above
- `toon_aan_trainer` notities are always written by management — safe to hardcode `auteur_naam = 'Management'` in the enrichment
- Windows line endings (CRLF)
