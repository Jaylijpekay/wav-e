# Codex Task — WAV-e Notities · Iteratie 6
# UI management pagina: NotitieModal

## Prerequisites

Iteraties 1–5 must be complete and verified on production before starting this.

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Supabase
Target file: `src/app/management/page.tsx`

This is an additive change only. Read the full file before writing anything.
All existing functionality — trainer table, leden table, ActieModal, AddLidModal, AddTrainerModal, ConsolePanel — is preserved exactly.

---

## What to build

A `NotitieModal` component and a `+ Notitie` button on each trainer row in the trainer table.

The modal has two modes selected by a toggle:
1. **Notitie bij lid** — tied to a specific lid of that trainer; optional `toon_aan_trainer` flag
2. **Notitie voor trainer** — goes into `trainer_notities`, directed at the trainer

The mode toggle is shown first. The rest of the form adapts based on the selection.

---

## Step 1 — Read the file

Read `src/app/management/page.tsx` in full. Identify:
1. The `ActieModal` component — the `NotitieModal` follows the same pattern exactly
2. The trainer table row where `+ Actie` button lives — `+ Notitie` goes next to it
3. State variables `actieTrainer` and `actieL id` — same pattern for notitie state
4. `inputStyle`, `touchButtonStyle`, `labelStyle`, `Field` component — reuse all of these
5. The `load` function — no changes needed

---

## Step 2 — New state

Add to `ManagementPage` component state:

```typescript
const [notitieTrainer, setNotitieTrainer] = useState<Trainer | null>(null)
```

The modal opens when `notitieTrainer` is not null. Close by setting it to null.

---

## Step 3 — Open handler

```typescript
const openNotitieModal = (t: Trainer) => {
  setNotitieTrainer(t)
}
```

---

## Step 4 — NotitieModal component

Add this component in the file, after `ActieModal` and before `AddTrainerModal`:

```typescript
function NotitieModal({
  trainer,
  leden,
  onClose,
  onSaved,
}: {
  trainer: Trainer
  leden: Lid[]
  onClose: () => void
  onSaved: () => void
}) {
  const [modus,           setModus]           = useState<'lid' | 'trainer'>('lid')
  const [lidId,           setLidId]           = useState('')
  const [tekst,           setTekst]           = useState('')
  const [toonAanTrainer,  setToonAanTrainer]  = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const trainerLeden = leden.filter(l => l.trainer_id === trainer.id && l.actief)

  // Reset form when mode switches
  const switchModus = (m: 'lid' | 'trainer') => {
    setModus(m)
    setLidId('')
    setTekst('')
    setToonAanTrainer(false)
    setError(null)
  }

  const save = async () => {
    setError(null)

    if (modus === 'lid') {
      if (!lidId)         { setError('Selecteer een lid'); return }
      if (!tekst.trim())  { setError('Tekst is verplicht'); return }
      if (tekst.length > 1000) { setError('Maximaal 1000 tekens'); return }

      setSaving(true)
      try {
        const res = await fetch(`/api/notities/${lidId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tekst: tekst.trim(),
            toon_aan_trainer: toonAanTrainer,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          setError(err.error ?? 'Opslaan mislukt')
          return
        }
      } catch {
        setError('Verbindingsfout')
        return
      } finally {
        setSaving(false)
      }
    }

    if (modus === 'trainer') {
      if (!tekst.trim())  { setError('Tekst is verplicht'); return }
      if (tekst.length > 1000) { setError('Maximaal 1000 tekens'); return }

      setSaving(true)
      try {
        const res = await fetch(`/api/trainer-notities/${trainer.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tekst: tekst.trim() }),
        })
        if (!res.ok) {
          const err = await res.json()
          setError(err.error ?? 'Opslaan mislukt')
          return
        }
      } catch {
        setError('Verbindingsfout')
        return
      } finally {
        setSaving(false)
      }
    }

    onSaved()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '28px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Notitie toevoegen</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>→ {trainer.voornaam} {trainer.achternaam}</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => switchModus('lid')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              borderColor: modus === 'lid' ? 'var(--color-accent)' : 'var(--border-subtle)',
              background: modus === 'lid' ? 'rgba(99,102,241,0.08)' : 'transparent',
              color: modus === 'lid' ? 'var(--color-accent-text)' : 'var(--text-muted)',
              ...touchButtonStyle,
            }}
          >
            Notitie bij lid
          </button>
          <button
            onClick={() => switchModus('trainer')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: '1px solid',
              borderColor: modus === 'trainer' ? 'var(--color-accent)' : 'var(--border-subtle)',
              background: modus === 'trainer' ? 'rgba(99,102,241,0.08)' : 'transparent',
              color: modus === 'trainer' ? 'var(--color-accent-text)' : 'var(--text-muted)',
              ...touchButtonStyle,
            }}
          >
            Notitie voor trainer
          </button>
        </div>

        {/* Lid selector — only in lid mode */}
        {modus === 'lid' && (
          <Field label="Lid">
            <select
              value={lidId}
              onChange={e => setLidId(e.target.value)}
              style={{ ...inputStyle, color: lidId ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              <option value="">Selecteer lid…</option>
              {trainerLeden.map(l => (
                <option key={l.id} value={l.id}>{l.voornaam} {l.achternaam}</option>
              ))}
            </select>
          </Field>
        )}

        {/* Tekst */}
        <Field label="Notitie">
          <textarea
            value={tekst}
            onChange={e => setTekst(e.target.value)}
            placeholder={modus === 'lid' ? 'Aantekening bij dit lid…' : 'Bericht aan trainer…'}
            rows={4}
            maxLength={1000}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          {tekst.length >= 800 && (
            <div style={{ fontSize: 11, color: tekst.length >= 1000 ? 'var(--red-text)' : 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
              {tekst.length}/1000
            </div>
          )}
        </Field>

        {/* Toon aan trainer checkbox — only in lid mode */}
        {modus === 'lid' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', ...touchButtonStyle }}>
            <input
              type="checkbox"
              checked={toonAanTrainer}
              onChange={e => setToonAanTrainer(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: 'var(--amber-text)' }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Urgent voor trainer
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Verschijnt als melding op het trainer dashboard totdat de trainer het bevestigt. De notitie is altijd zichtbaar op de ledenpagina.
              </div>
            </div>
          </label>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize: 13, color: 'var(--red-text)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ ...touchButtonStyle, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Annuleren
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{ ...touchButtonStyle, background: 'var(--color-accent)', color: 'var(--color-white)', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Step 5 — Render modal

In the `ManagementPage` JSX, add alongside the other modals (near `ActieModal`):

```tsx
{notitieTrainer && (
  <NotitieModal
    trainer={notitieTrainer}
    leden={leden}
    onClose={() => setNotitieTrainer(null)}
    onSaved={() => {/* no refresh needed — modal closes */}}
  />
)}
```

---

## Step 6 — Add button to trainer row

In the trainer table row, find the `<td>` that contains `+ Actie`. Add `+ Notitie` button directly after it as a new `<td>`:

```tsx
<td style={{ padding: '14px 20px', textAlign: 'right' }}>
  <button
    onClick={() => openNotitieModal(t)}
    style={{ ...touchButtonStyle, background: 'none', border: 'none', padding: '5px 0', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color 0.15s, color 0.15s' }}
    onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)' }}
    onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
  >
    + Notitie
  </button>
</td>
```

Also add `'Notitie'` to the table header columns array so the column header aligns.

---

## Verify after build

1. `npm run build` passes with zero TypeScript errors
2. Management page loads — trainer table has `+ Notitie` column
3. Click `+ Notitie` on a trainer → modal opens, mode toggle visible
4. **Modus "Notitie bij lid":**
   - Lid selector shows trainer's active leden
   - Write tekst, leave "Urgent voor trainer" unchecked → POST to `/api/notities/[lid_id]` with `toon_aan_trainer: false`
   - Verify in Supabase: notitie exists, `toon_aan_trainer = false`
   - Verify on lid page: notitie visible in thread
5. **Modus "Notitie bij lid" + urgent:**
   - Check "Urgent voor trainer" → POST with `toon_aan_trainer: true`
   - Verify in Supabase: `toon_aan_trainer = true`, `gezien = false`
   - Verify on trainer dashboard: melding appears
   - Trainer clicks "✓ Gezien" → melding disappears from dashboard
6. **Modus "Notitie voor trainer":**
   - No lid selector visible
   - Write tekst → POST to `/api/trainer-notities/[trainer_id]`
   - Verify on trainer dashboard: bericht appears in thread with indigo border

---

## Do not touch

- `ActieModal` — zero changes
- `AddLidModal` — zero changes
- `AddTrainerModal` — zero changes
- `ConsolePanel` — zero changes
- Any API routes
- DB schema
- Middleware

---

## Notes

- `lidId` in the lid selector is the UUID from `leden.id` — this is used directly in the API route path
- `toon_aan_trainer` checkbox uses amber accent to visually signal urgency — consistent with the trainer dashboard alert styling
- Windows line endings (CRLF)
- `var(--color-accent)` is the indigo used elsewhere in the management page — reuse it for the mode toggle active state
