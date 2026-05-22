# Codex Task — WAV-e QR Code op Console Token Aanmaken

## Context

Repo: `Jaylijpekay/wav-e`
Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase
Target file: `src/app/admin/page.tsx`

This is a UI-only change. No API routes, no DB changes, no middleware changes.

---

## Objective

When an admin creates a new console token on the admin page, immediately render a QR code below the token value. The QR code encodes the console URL + token so Bart can scan it with a tablet camera instead of typing the URL manually.

---

## Step 1 — Install dependency

```bash
npm install qrcode.react
```

Verify it is listed in `package.json` after install before proceeding.

---

## Step 2 — Read the current file

Open `src/app/admin/page.tsx` and identify:

1. Where the token creation response is handled (look for state that stores the newly created token value)
2. Where the token value is currently displayed after creation (the UI block that shows the token string to the admin)
3. The existing modal or panel structure around token creation

Do not make any changes until you have read and understood the full file.

---

## Step 3 — Implement

### Import

Add at the top of `src/app/admin/page.tsx` alongside other imports:

```typescript
import { QRCodeSVG } from 'qrcode.react'
```

### State

No new state needed. The QR code renders conditionally on the same state variable that already holds the newly created token value. If that state is `null` or empty, the QR code does not render.

### URL to encode

```typescript
const consoleUrl = `https://wav-e.vercel.app/console?token=${newToken}`
```

Where `newToken` is whatever the existing state variable is called that holds the token string after creation. Identify the correct variable name from reading the file — do not guess.

### Render

Place the QR code **directly below** the existing token value display, inside the same conditional block that already shows the token:

```tsx
<QRCodeSVG value={consoleUrl} size={200} />
```

Add a short label above it:

```tsx
<p className="text-sm text-gray-500 mt-4 mb-2">Scan met tablet camera:</p>
<QRCodeSVG value={consoleUrl} size={200} />
```

### Visibility

The QR code is visible as long as the token creation panel or modal is open and the token state is populated. When the panel closes or resets, the token state clears and the QR code disappears automatically. Do not add separate QR visibility state.

---

## Step 4 — Do not touch

- No other files
- No API routes
- No DB migrations
- No middleware
- No other components
- Do not add a "re-display QR for existing token" feature — creation-only for now

---

## Step 5 — Verify before committing

1. `npm run build` passes with no TypeScript errors
2. The import resolves correctly (`qrcode.react` exports `QRCodeSVG`)
3. The QR code renders in the correct location relative to the token value
4. The QR code disappears when the token panel/modal is closed

---

## Acceptance criteria

- Admin creates a token
- QR code renders immediately below the token value
- QR encodes: `https://wav-e.vercel.app/console?token=[token_value]`
- Scanning with tablet camera opens the console with the token pre-filled
- No URL typing required
- QR disappears when the creation panel is closed

---

## Notes

- Size 200px is readable from ~30cm on a tablet camera
- Use `QRCodeSVG` (not `QRCodeCanvas`) — SVG renders crisply at all screen densities
- The admin page uses Dutch UI copy — keep any new labels in Dutch
- This repo uses Windows line endings (CRLF) — do not convert line endings
