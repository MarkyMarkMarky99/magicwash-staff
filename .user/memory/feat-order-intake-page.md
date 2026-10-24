# Branch `feat/order-intake-page`

New full-screen order intake page (`/orders/new/intake/:customerId`), entry "Intake Order" in the customer order-history create menu. Canonical doc: `docs/features/orders/order-intake-form.md`. Prototype: `.user/intake-form-design/variant-a.html`.

Also holds garment registration (merged from `feat/laundry-item-registration` 2026-10-24): Register Garments page (`#/customers/:customerId/garments/register`, doc `docs/features/laundry-items/register-garments-page.md`) and `POST /api/laundry-items/register` (plan `docs/plans/laundry-item-registration.md`).

## Status
- Intake page reworked to scan-only (plan `docs/plans/order-intake-flow.md`): preloads the customer's garments, groups rows by type, Uncategorized row, row sheet, centred scan card; owner tested with the scanner gun on Marky's printed QR sheet.
- Register Garments page browser-checked (tag check, upload at capture, remove/Discard delete Firebase files).
- Register endpoint: batchAppends LaundryItems + REGISTRATION photos, triggers MagicwashAI `{ input: {} }` via `VITE_AI_GATEWAY_URL`. Service live-tested on Marky's order `5aed2e17`: 32 garments kept as real data, AI typed 31.
- MagicwashAI classify now sees active Items only (MagicwashAI `00a6e9d`).
- Garment detail page `#/garments/:tagId` built (doc `docs/features/laundry-items/laundry-item-detail-page.md`, prototype `.user/item-detail-design/zone-5.html`); Intake row sheet opens it as a full-screen overlay.

## Pending
- Register Garments Save → endpoint not yet run in a browser (`vercel dev` needs a restart to load `AI_GATEWAY_SECRET`/`VITE_AI_GATEWAY_URL`).
- Intake Save is not connected (logs the request body only); backend `POST /api/order-intakes` not built.
- Owner deferred: unregistered tag at intake (blocked for now), LaundryPhotos vs OrderGarments for tickets, status after Save.
- Defect photos stay local in the draft; upload at capture comes with the backend.
- Order `5aed2e17` (created 2026-10-24) uses inactive Items ids — check how staff can still pick inactive types.
- Intake only chooses a type for untyped garments (owner 2026-10-24); a registered type is changed on the garment detail page.
- Garment detail not yet tried on real data in a browser after Sonnet's header/size fix; its type change writes LaundryItems live.
- Shared UI consolidation (plan `docs/plans/shared-ui-consolidation.md`) merged in; owner has not yet viewed the Round 7 visual changes; leftover design work in `.user/memory/shared-ui-later.md`.
- 13 dry-test files already failing before the refactor (list in `.user/memory/shared-ui-later.md`).
- Merging to main ships both pages; Intake Save must be finished (or its menu hidden) first.
- Vite `scanic-ml` overlay on camera open under `vercel dev` predates this branch.
