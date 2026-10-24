# Branch `feat/order-intake-page`

New full-screen order intake page (`/orders/new/intake/:customerId`), entry "Intake Order" in the customer order-history create menu. Canonical doc: `docs/features/orders/order-intake-form.md`. Prototype: `.user/intake-form-design/variant-a.html`.

Also holds garment registration (merged from `feat/laundry-item-registration` 2026-10-24): Register Garments page (`#/customers/:customerId/garments/register`, doc `docs/features/laundry-items/register-garments-page.md`) and `POST /api/laundry-items/register` (plan `docs/plans/laundry-item-registration.md`).

## Status
- Intake page built from prototype A; checked in the owner's Chrome (header, details sheet, Items paper, all camera rows).
- Register Garments page browser-checked (tag check, upload at capture, remove/Discard delete Firebase files).
- Register endpoint: batchAppends LaundryItems + REGISTRATION photos, triggers MagicwashAI `{ input: {} }` via `VITE_AI_GATEWAY_URL`. Service live-tested on Marky's order `5aed2e17`: 32 garments kept as real data, AI typed 31.
- MagicwashAI classify now sees active Items only (MagicwashAI `00a6e9d`).

## Pending
- Register Garments Save → endpoint not yet run in a browser (`vercel dev` needs a restart to load `AI_GATEWAY_SECRET`/`VITE_AI_GATEWAY_URL`).
- Intake Save is temporary (creates a `PENDING` order with existing APIs). Next: rewire per `docs/plans/received-ai-classification.md` — call the registration service, `RECEIVED`, AI trigger, review page; Save request shape awaiting owner approval.
- Intake Save never run end to end; garment tag duplicates checked only inside the draft.
- Order `5aed2e17` (created 2026-10-24) uses inactive Items ids — check how staff can still pick inactive types.
- Merging to main ships both pages; Intake Save must be finished (or its menu hidden) first.
- Vite `scanic-ml` overlay on camera open under `vercel dev` predates this branch.
