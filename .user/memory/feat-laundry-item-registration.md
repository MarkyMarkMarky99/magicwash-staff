# Branch `feat/laundry-item-registration`

Cut from `feat/order-intake-page` at `8623ddd8` (same round). Plan: `docs/plans/laundry-item-registration.md`. Page doc: `docs/features/laundry-items/register-garments-page.md`.

## Status
- Register Garments page (`#/customers/:customerId/garments/register`) browser-checked 2026-10-24: tag check, upload at capture, remove/Discard delete Firebase files.
- `POST /api/laundry-items/register` built: registration service batchAppends LaundryItems + REGISTRATION photos, then triggers MagicwashAI with `{ input: {} }` (URL from `VITE_AI_GATEWAY_URL`). Save on the page calls it.
- Live service test 2026-10-24: Marky's order `5aed2e17`, 32 garments registered and kept as real data (`created_by` = "Claude test"); AI typed 31, 1 unsure, in 2 min.

## Pending
- Page Save → endpoint not yet run in a browser (the live test called the service directly).
- Items catalog has duplicate types (e.g. 0062/0091 Long Pants, 0065/0092 Shorts, 0051/0090 Polo, 0061/0094 Undershirt); AI picks the newer ids, staff the older — owner to pick one per pair before order grouping.
- Merge order: this branch lands before the Intake Order save rewire, which calls the registration service.
- Vite `scanic-ml` overlay on camera open under `vercel dev` predates this branch.
