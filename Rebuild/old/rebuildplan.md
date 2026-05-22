# Wav-e Rebuild Plan
 *Serendipity Projects | Mei 2026*

 ---

 ## Definition of Done

 ### The goal in one sentence
 A trainer can run a complete coaching cycle, a manager can see what's happening studio-wide, and Bart can extend the codebase without breaking it.

 ---

 ### 1. Functional completeness

 **Coaching cycle**
 - [ ] Trainer can create a new member
 - [ ] Trainer can log an evaluation (gesprek)
 - [ ] Trainer can log a contact moment
 - [ ] Trainer can create, complete, and view acties
 - [ ] Trainer sees correct stoplight per member (red/amber/green)

 **Contact status — fixed**
 - [ ] "Nog geen contact" only shows when there is no evaluatie AND no contact_moment
 - [ ] Laatste contact reads from whichever is more recent: contact_moment or evaluatie datum
 - [ ] Stoplight amber threshold (>14 days) uses the same combined logic

 **Acties deadlines — fixed**
 - [ ] Deadline is visible on every actie in the trainer dashboard
 - [ ] Acties are sorted: members with most recent/urgent acties at top
 - [ ] Overdue acties (deadline passed, status still open) are visually distinct

 **Management**
 - [ ] Management sees studio-wide stoplight summary
 - [ ] Management sees per-trainer execution stats
 - [ ] Management can assign an actie to a trainer
 - [ ] Spacing between "actie" and "deactiveren" buttons is correct — no accidental taps

 **Tablet**
 - [ ] Login works on iPad Safari (iPadOS)
 - [ ] All interactive elements minimum 44px touch target
 - [ ] No iOS zoom on input focus

 —











 ### 2. Code quality

 - [ ] No business logic in UI components — all validation lives in API routes
 - [ ] No derived values stored in the database — stoplights computed at render time only
 - [ ] Stoplight logic exists in exactly one place, not duplicated across three page files
 - [ ] Every API route validates identity by reading session cookie directly (not middleware headers)
 - [ ] No hardcoded hex values in page files — all colors via CSS variables in globals.css
 - [ ] `@import` at top of globals.css
 - [ ] `.env.local` documented (which keys are required and where to find them)

 ---

 ### 3. Legibility for Bart

 - [ ] Each page file has a comment block at the top explaining what it does and what data it reads
 - [ ] The stoplight logic has an inline comment explaining the thresholds and why
 - [ ] `README.md` exists with: what the app is, how to run it locally, what each folder does, how to add a member/trainer
 - [ ] No dead code, commented-out blocks, or console.log statements left in production files

 ---

 ### 4. Stability

 - [ ] `npm run build` completes with zero errors
 - [ ] App deploys to Vercel without manual intervention
 - [ ] All three auth paths work: admin, management, trainer login
 - [ ] Console token login works on tablet

 ---

 ### Not done until Bart can

 - Open a member, see their correct contact status
 - Log a gesprek and see the stoplight update
 - Read a page file and explain in his own words what it does

 ---

 ## Codex Iteration Plan

 ### Before Codex touches anything

 **You do this manually, once:**

 1. Create a new branch: `git checkout -b rebuild/v0.2`
 2. Verify the DoD is printed and next to you
 3. Have the AI Core Doc (wav-e v2.0) open — Codex needs it as spec in every pass

 ---

 ### Pass 1 — Audit & inventory
 **One Codex session. Read only, no changes.**

 Prompt goal: get a complete picture of what's broken, duplicated, or misplaced before touching anything.

 ```
 Read the codebase and produce an inventory:
 1. All files containing stoplight logic — flag duplicates
 2. All hardcoded hex values in page files
 3. All console.log statements
 4. All business logic living in UI components instead of API routes
 5. Any derived values being written to the database
 6. Dead code and commented-out blocks

 Return: file paths and line numbers only. No fixes.
 ```

 **Gate:** Review and sign off on the inventory before Pass 2.

 ---

 ### Pass 2 — CSS & globals cleanup
 **One Codex session. Low risk, no logic.**

 - Move all hardcoded hex values to globals.css tokens
 - Remove dead CSS
 - Verify `@import` position
 - Remove all `console.log` statements

 **Gate:** `npm run build` passes. Deploy and verify in browser.

 ---

 ### Pass 3 — Stoplight logic consolidation
 **One Codex session. Highest risk pass.**

 Extract `getStoplight()` into a single shared utility: `src/lib/stoplight.ts`
 - Remove the three duplicate implementations in page files
 - Import from the single source everywhere

 Fix the contact status bug in the same pass:
 - `lastContactDays` computed from MAX of `contact_momenten.datum` and `evaluaties.datum`
 - Amber threshold uses the same combined value in all views

 ```
 The fix for lastContactDays:

 const lastContactDays = daysSince(
   [contacten[0]?.datum, latestEval?.datum]
 	.filter(Boolean)
 	.sort()
 	.reverse()[0] ?? null
 )
 ```

 **Gate:** Deploy. Open Bart (WE-002) and Glenn (WE-001) member records. Confirm "nog geen contact" is replaced by correct date. Confirm stoplight reflects evaluatie datum.

 ---

 ### Pass 4 — Acties deadline display
 **One Codex session. UI only.**

 - Surface `deadline` field on every actie card in trainer dashboard
 - Sort members by most recent/urgent actie
 - Add overdue visual state: deadline passed + status still open = distinct color/label

 **Gate:** Log in as trainer, verify actie cards show deadline, verify sort order.

 ---

 ### Pass 5 — Management screen fixes
 **One Codex session. UI only.**

 - Fix spacing between "actie" and "deactiveren" buttons in member rows
 - Verify all interactive elements are minimum 44px touch target on management screen

 **Gate:** Open management screen on tablet or browser dev tools mobile view. Verify button spacing.

 ---

 ### Pass 6 — Tablet & auth fixes
 **One Codex session.**

 - iPad Safari login flow — verify session cookie is set correctly
 - Console token login on tablet
 - Input `font-size: 1rem` everywhere to prevent iOS zoom on focus

 **Gate:** Test login on actual iPad or Safari mobile emulation. Verify console token path works.

 ---

 ### Pass 7 — Code legibility for Bart
 **One Codex session. No logic changes.**

 - Add comment block to top of every page file:
   - What this page does
   - What data it reads and from which tables
   - What roles can access it
 - Add inline comments to stoplight logic explaining each threshold and why
 - Remove all remaining dead code and commented-out blocks

 **Gate:** Read one page file yourself. If you can follow it without the AI Core Doc, it's done.

 ---

 ### Pass 8 — README
 **One Codex session.**

 Prompt Codex to write `README.md` based on the AI Core Doc and actual file tree.

 Required sections:
 - What Wav-e is (one paragraph)
 - How to run locally (env vars, `npm install`, `npm run dev`)
 - Required environment variables and where to find them in Supabase
 - Folder structure explained
 - How to add a new member
 - How to add a new trainer
 - How the stoplight works (in plain Dutch)

 **Gate:** Bart reads it. He can set up a local dev environment without asking you.

 ---

 ## Final gate — before merge to main

 - [ ] `npm run build` zero errors
 - [ ] Deploy to Vercel, verify all three auth paths work
 - [ ] Open Bart's member record (WE-002), confirm contact status is correct
 - [ ] Bart reads one page file and explains it back in his own words
 - [ ] Bart sets up local dev from README without help

 ---

 ## What you are doing between passes

 You are not watching Codex work. You are:

 - Reviewing the output of each pass before deploying
 - Verifying in the browser after each deploy
 - Deciding if the pass is done or needs a correction prompt
 - Not starting the next pass until the current one is verified

 **Eight passes. Eight verification gates. You own the gates.**

 ---

 *Wav-e Rebuild Plan | Serendipity Projects | Mei 2026*
 *Authors: Jay Kerkhof + Claude (Anthropic)*
  

