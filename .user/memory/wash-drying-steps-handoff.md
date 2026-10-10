# Handoff — wash program drying steps (tumble dry / line dry)

Written 2026-10-11 before a `/clear`. Start a new branch from `main` (e.g. `feat/wash-drying-steps`).
Reply to the owner in Thai. Owner avoids editing sheets: do NOT add sheet columns unless they agree.

## Where things stand (all on `main`, deployed to prod 2026-10-11)
- Merge `23b117c` + memory commit `4c81732`; prod alias `https://magicwash-staff.vercel.app` (`/api/wash-programs` → 401 = deployed).
- WashQueue sheet now has columns V `tag_code`, W `wash_options` (added via Sheets API after deploy; live read verified, 19 rows).
- WashProducts and WashPrograms tabs exist (MagicwashJobTracking file, `JOB_TICKETS_SPREADSHEET_ID`), headers only, 0 rows — owner fills them.
- WashPrograms columns G `temperature`, H `duration` and WashQueue V:W are formatted Plain text (GViz mixed-type columns would null minority values).
- Canonical behaviour doc: `docs/features/wash-queue/wash-queue.md`.

## Current model (read the code before changing)
- `contracts/wash-queue/wash-queue-api.schema.ts`: `washStepSchema` (discriminated union on `type`) + `washOptionsSchema = { program, steps[1..20] }`.
  - Step types today: `stain_removal` (products), `quick_wash`/`normal_wash` (products + temperature cold|40|60), `rinse` (products), `soak` (products + duration 1–720 | 'overnight').
- `server/modules/wash-queue/wash-queue.module.ts` POST: washer needs non-null `washOptions`, dryer needs null; every product ACTIVE (any type); program `CUSTOM` or an ACTIVE program; stores `JSON.stringify` in `wash_options`; `toDto` parses leniently (invalid → null).
  - `transitions` table drives load / unload / collect / cancel; unload takes `weightAfterKg` + `unloadPhotoUrl`.
- `server/modules/wash-programs/wash-programs.module.ts`: `listWashPrograms()` groups WashPrograms rows by `program_id`, orders by `step_no`, skips invalid rows silently (owner chose to keep this).
- Frontend: `src/features/wash-queue/wash-options.ts` (helpers + labels/chips), `components/WashQueueWashOptionsForm.vue` (program stickers, long-press drag, step cards), `WashStepEditor.vue`, `WashProductSelect.vue`, `wash-program.css` (all selectors under `.wq-options`), `WashQueueBookDialog.vue`, `pages/WashQueuePage.vue`.
- Dev preview without login: `http://localhost:3102/#/dev/wash-queue-book` (`src/app/dev/WashQueueBookPreviewPage.vue`, sample programs/products).
- Approved visual design (HTML prototype): `design-4` — lost with the scratchpad; the Vue components are now the reference.

## Owner decisions for drying (2026-10-11)
- Program = whole process: washing steps, then drying steps at the END (no washing step after a drying step).
- New step types, NO new sheet columns:
  - `tumble_dry`: heat in the existing `temperature` column = `low` | `medium` | `high` (default levels; owner never confirmed the dryer's real levels), minutes in `duration` (1–720).
  - `line_dry`: no settings; reminder only ("Hang to dry"), NOT tracked in the system.
- On washer **unload**: if the plan has a `tumble_dry` step, the server automatically creates a dryer booking (Pending) with the same `tag_code`, `weight_before_kg` = the washed (wet) weight, the same unload photo, and `wash_options` containing only the drying steps. No re-weigh, no new photo, no button.
  - Close the washer booking as Collected at the same time (prevents double sends). Confirm this with the owner if unsure.
  - No link column back to the washer booking (owner: not needed).
- `line_dry` only: Ready card shows "Hang to dry"; Pick up as today.
- Dryer bookings currently MUST have `washOptions: null` — change so a dryer booking may carry drying-only steps (direct dryer bookings for garments not washed here: pick a dry-only program or custom dry steps).

## Registry already updated (G Drive, read-only for agents)
- `G:\My Drive\Magicwash\Database\GoogleSheets\WashPrograms.json`: step_type enum includes `tumble_dry`, `line_dry`; temperature enum includes low/medium/high; descriptions explain the drying rules.
- `WashQueue.json` `wash_options` description documents drying steps and the auto dryer booking on unload.

## OPEN — must ask the owner before building
- **Which dryer machine** does the auto-created booking go to? Owner chose "store it in the program", but WashPrograms has NO column for a machine and the owner avoids sheet edits. Options to present:
  1. Add `machine_id` column M to WashPrograms (needs a sheet edit; prod reads WashPrograms, so deploy the contract FIRST, then add the column).
  2. Reuse the `products` cell on the `tumble_dry` row to hold a Machines.id (no sheet edit, but confusing).
  3. Leave the machine empty ("Any dryer") and pick it at Load time.
- Dryer heat levels: confirm `low/medium/high` match the real dryers.

## Known debt (accepted, not urgent)
- `wash-program.css` is a namespaced global file, not `<style scoped>` (children share it).
- `WashQueueBookDialog.vue` restyles the shared overlay frame into a bottom sheet via `:global([data-overlay-*]:has(.wq-book-content))`; the proper fix is an option on the shared overlay (discuss first).
- Not yet phone-tested: dryer mode, In machine timer frame, tap-outside swipe close, the whole booking dialog.

## Process rules that bit this session
- Owner wants prototypes FIRST via `fast-design` / Sonnet HTML (`scratchpad/designs/*.html` served by `python -m http.server`), shown in Claude's browser, before touching Vue code.
- Implementation goes to Codex via the `implement` skill (brief file + exact command); then Claude reads EVERY diff line, including tests, CSS and docs, before reporting.
- New sheet column on a sheet prod reads: deploy the contract first, then add the column, then verify (Sheets API script with `.env.local`, `getGoogleAccessToken` from `server/shared/repositories/google-auth.ts`; Chrome control may be blocked by the permission classifier).
- Don't commit or push unless asked; update `MEMORY.md` at every commit.
