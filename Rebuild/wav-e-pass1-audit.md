# WAV-e Rebuild — Pass 1: Audit & Inventory

**Branch:** `rebuild/v0.2`
**Session type:** Read only. No changes to any file.

---

## Context

WAV-e is a coaching intelligence layer for an EMS studio built on Next.js 14 (App Router, TypeScript, Tailwind CSS) with Supabase as the backend. The app has three auth paths: admin, management, and trainer (console token / PIN). All UI copy and DB column names are in Dutch.

This is Pass 1 of an 8-pass rebuild. Your only job in this session is to read the codebase and produce an inventory. Do not fix anything. Do not refactor anything. Do not suggest changes inline — save all suggestions for the inventory output.

---

## What to read

Start with:
- `src/app/` — all page files and API routes
- `src/lib/` — shared utilities
- `src/components/` — UI components
- `src/middleware.ts`
- `src/styles/globals.css` (or wherever global styles live)
- Any file that imports from or references stoplight logic, contact status, or member scoring

---

## What to inventory

Return findings under these exact headings. For each item: file path + line number(s). No prose, no suggestions.

---

### 1. Stoplight logic — all locations

Find every file that contains logic for computing green / amber / red status per member. This includes:
- Functions named `getStoplight`, `computeStatus`, or similar
- Inline conditionals that check `lastContactDays`, `>14`, `>28`, or equivalent thresholds
- Any reference to "rood", "groen", "oranje" that involves a computed value

Flag duplicates explicitly.

---

### 2. Contact status logic — all locations

Find every place that computes "last contact date" or "days since last contact". This includes:
- Any reference to `contact_momenten`, `evaluaties.datum`, or `lastContact`
- Any `daysSince()` call or equivalent date arithmetic
- Any logic that determines whether to show "Nog geen contact"

Note whether each instance reads from only `contact_momenten`, only `evaluaties`, or both combined.

---

### 3. Hardcoded hex values in page files

Find all hex color values (`#xxxxxx` or `#xxx`) hardcoded directly in page files or component files outside of `globals.css`. Exclude `globals.css` itself — that's the right place for them.

---

### 4. Business logic in UI components

Find any validation, computation, or data transformation that lives inside a React component or page file rather than an API route. This includes:
- Status thresholds computed in the component
- Date arithmetic done in the render function
- Filtering or sorting logic that should live server-side

---

### 5. Derived values written to the database

Find any API route or server action that writes a computed or derived value to the database. Examples:
- Writing a stoplight status string to a `status` column
- Writing a computed score or delta to a row
- Any `.update()` or `.insert()` that includes a value derived from other DB fields

---

### 6. console.log statements

All files containing `console.log`. File path and line number only.

---

### 7. Dead code and commented-out blocks

Files with:
- Commented-out code blocks (not documentation comments)
- Unused imports
- Functions or variables defined but never called/referenced

---

## Output format

Return the inventory as structured Markdown using the headings above. Under each heading: a numbered list of `filepath:line — brief description`. If a heading has no findings, write `None found.`

Do not add a summary section. Do not suggest fixes. Do not rewrite any code. Stop after the inventory.

---

*WAV-e Rebuild Plan | Serendipity Projects | Mei 2026*
