# WAV-e README Update — Claude Code Prompt
*Serendipity Projects | Mei 2026*

---

## Your task

Rewrite `README.md` in the project root. The existing README is outdated — it references files that were renamed, features that were added, and architecture details that have changed since it was written. Your job is to produce a single, accurate, complete replacement that reflects the current state of the codebase.

This is a handover document. Bart (the client) and any future developer must be able to read it and understand what the app does, how to run it, and how to work with it. Write in Dutch. Match the tone and language of the existing README.

---

## Read first — do not write until you have read all of these

1. The existing `README.md` — understand the current structure and tone
2. `package.json` — get the exact versions of Next.js, React, and all key dependencies
3. `src/proxy.ts` — the renamed middleware file (was `middleware.ts`)
4. Every file under `src/app/api/` — to document all API routes accurately
5. Every page file under `src/app/` — to document all routes accurately
6. `src/lib/supabase.ts` and `src/lib/supabase-server.ts` — client factories
7. `src/lib/stoplight.ts` — stoplight logic
8. `src/app/components/` — shared components

Read everything before writing a single line of the README.

---

## What has changed since the existing README was written

Apply every correction below. Do not preserve outdated information.

### File renames and structural changes

- `middleware.ts` was renamed to `src/proxy.ts` as part of the Next.js 16 migration. The mappenstructuur section must reflect this.
- A new route `/management/berichten` was added — management inbox for trainer messages.
- A new API route `GET /api/trainer-notities` (base path, no trainer_id) was added for the inbox aggregate.
- A new API route `POST /api/gesprek` was added — cyclus is now computed server-side here, not in the client.
- `src/app/api/admin/delete/route.ts` now soft-deletes (sets `actief = false`) instead of hard-deleting application rows.

### Architecture corrections

- The app uses **inline styles only** — no Tailwind CSS classes in component or page files. Remove any mention of Tailwind as an active styling approach. It may still be in `package.json` as a dependency but is not used in the application UI.
- Auth in API routes uses `SUPABASE_SERVICE_ROLE_KEY` + `createServerClient` from `@supabase/ssr`. Client pages use the anon key via `getSupabase()` from `src/lib/supabase.ts`.
- Role is derived exclusively from `get_my_role()` RPC — not from UUID comparisons in application code (the UUID exists only in the DB function and `src/proxy.ts`).

### New tables in Supabase

The live DB has these tables (add to the technische stack or a new DB-sectie):
`acties`, `console_tokens`, `contact_momenten`, `evaluaties`, `leden`, `management_gebruikers`, `notities`, `trainer_notities`, `trainers`, `user_roles`

### New features to document

- `/management/berichten` — management inbox showing all trainer messages, unread first, with reply capability
- Trainer messages (`trainer_notities`) are a two-way thread between trainer and management, with unread tracking (`gelezen_door_management`)
- Lid notities (`notities` table) are separate from trainer messages — they are notes tied to a specific member
- Urgent notities from management appear as alerts on the trainer dashboard
- `cyclus` for evaluaties is computed server-side via `POST /api/gesprek`, not client-side
- User deactivation (admin delete) is now a soft deactivate — sets `actief = false`, invalidates the auth session via `auth.admin.deleteUser`, but preserves all application data

### Known issues section — update with current state

Replace the existing bekende aandachtspunten with these:

1. iPad Safari login via session cookie heeft geen device-test gehad na de laatste auth-rebuild. Bart moet als eerste handover-stap inloggen op het echte apparaat.
2. De admin-superuser UUID staat nog in `src/proxy.ts` als bootstrap-check naast de `get_my_role()` RPC. Dit is gedocumenteerde technische schuld — niet kritisch, maar staat gepland voor v0.1.2.
3. Claude Code versies v2.1.100 en hoger hebben een bekende token-inflatie bug (~40% extra verbruik). Downgrade naar v2.1.34 of installeer opnieuw via npm als workaround totdat Anthropic een fix uitbrengt.
4. Integraties met Onlineafspraken.nl, Google Calendar en WhatsApp Business API zijn gepland voor v0.2 en nog niet geïmplementeerd.
5. De `trainers.rol` kolom bestaat in de database maar wordt niet meer beschreven door de applicatie — de rollogica loopt via de `user_roles` tabel en de `get_my_role()` RPC.

---

## Sections the README must contain

Keep the same numbered section structure as the existing README. Update every section to reflect the current state. Minimum sections:

1. Wat zit er in de app? (rollen, toegang, functies)
2. Lokaal opstarten
3. Benodigde omgevingsvariabelen
4. Mappenstructuur (updated — reflect `src/proxy.ts`, `/management/berichten`, new API routes)
5. Belangrijke routes (add `/management/berichten`)
6. Een nieuw lid toevoegen
7. Een nieuwe trainer of managementgebruiker toevoegen
8. Studio-console instellen
9. Werken met acties
10. Notities en berichten (update — document both `notities` and `trainer_notities`, the berichten inbox, and the two-way thread)
11. Evaluaties en voortgang
12. Hoe werkt het stoplicht?
13. Technische stack (correct the versions from package.json, remove Tailwind as active UI approach, add DB tables)
14. Bekende aandachtspunten (replace entirely with the updated list above)

---

## Tone and language rules

- Written in Dutch throughout
- Instructional sections (how-to's) use numbered steps, same as the existing README
- Technical sections use code blocks for commands, paths, and env vars
- No marketing language — factual and direct
- No section headers longer than 5 words
- Do not mention Serendipity Projects, Jay Kerkhof, or Claude/Anthropic in the README

---

## Output

Write the complete `README.md` file. Overwrite the existing file at the project root.

Do not produce a diff or a partial update. The output is the full file, ready to commit.

After writing, confirm:
```
FILE: README.md
STATUS: done
CHANGES: [brief summary of what changed from the previous version]
```

---

## What not to do

- Do not invent features that are not in the codebase
- Do not document planned v0.2 features as if they exist
- Do not reference `middleware.ts` — it is `src/proxy.ts`
- Do not describe Tailwind as the active styling system
- Do not mention hardcoded UUIDs in a way that exposes security details — the bekende aandachtspunten note is sufficient
- Do not change any code files — README only

---

*WAV-e README Update Prompt | Serendipity Projects | Mei 2026*
