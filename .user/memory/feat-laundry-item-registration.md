# Branch `feat/laundry-item-registration`

Cut from `feat/order-intake-page` at `8623ddd8` (same round). Plan: `docs/plans/laundry-item-registration.md`. Page doc: `docs/features/laundry-items/register-garments-page.md`.

## Status
- Register Garments page built (frontend only): route `#/customers/:customerId/garments/register`, entry "Register Garments" in the Order History create menu.
- Browser-checked in the owner's Chrome 2026-10-24, all 10 checks passed: tag check via `GET /api/laundry-items/:tag`, upload at capture, remove/Discard delete Firebase files (Storage rules allow delete, 204).
- Save is temporary: it logs the `POST /api/laundry-items/register` payload to the console; no backend call.
- `GarmentRegistrationCamera.vue` and `garment-registration.ts` moved to `src/shared/`.

## Pending
- Next round: backend `POST /api/laundry-items/register` (registration service, batchAppend LaundryItems + LaundryItemPhotos REGISTRATION, MagicwashAI trigger), then wire Save to it.
- `MAGICWASH_AI_URL` not set on Vercel yet.
- Merge order: this branch lands before the Intake Order save rewire, which calls the registration service.
- Vite `scanic-ml` overlay on camera open under `vercel dev` predates this branch.
