# feat/customer-update

- Admin-only customer edit: `PATCH /api/customers/:id`, `/customers/:customerId/edit`, one `CustomerFormPage` for create and edit.
- Editable: create-form fields plus `customerType` (edit mode only); see `docs/features/customers/registration.md`.
- Verified 2026-10-21 in the owner's Chrome on `localhost:3000` with live sheet: edit, clear field, duplicate phone 409, close paths, customerType, sheet audit columns.
- Not verified: staff-role redirect in a browser (no staff account used; server 403 covered by dry tests), double-click Save.
- Next: merge to main, deploy, curl prod `PATCH` as non-admin → 403.
- Pre-existing, not this branch: `customer-order-history-race.dry-test.ts` fails on HEAD; Vite dev overlay from `/scanic-ml/ort-wasm-simd-threaded.mjs`.
