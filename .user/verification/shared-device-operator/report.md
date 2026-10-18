# Shared device operator implementation report

Implemented the brief and payment/fallback-actor addendum. No subagents, delegation, or commits. Existing API write request schemas are unchanged; auth/staff role and card contracts changed as requested.

Card issuance follows the existing nested-action route style: `POST /api/staff/issue-card/:staffId` (admin only).

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck:api` | PASS, exit 0 |
| `npm run typecheck:web` | PASS, exit 0 |
| Repository dry tests | 267 files run: 256 PASS, 11 FAIL; every remaining failure reproduced on isolated HEAD |
| `npx vite build` | PASS, exit 0; 641 modules transformed |
| `npm run check:cross-feature-imports` | PASS, exit 0 |
| `git diff --check` | PASS, exit 0 |

There is no aggregate dry-test npm script. Used the documented `npx tsx <path>` command for server/shared/frontend files, and `npx tsx --tsconfig jsconfig.json <path>` for web files. All new tests and all existing tests affected by this implementation pass. Updated old fixtures for authenticated callers and session actors.

The Vite build retains its warning about `new URL("ort.wasm.min.mjs", import.meta.url)` being resolved at runtime. It does not fail the build.

Full gate output is saved beside this report in `typecheck-api.log`, `typecheck-web.log`, `vite-build.log`, `cross-feature-imports.log`, and `diff-check.log`. `dry-tests.json` contains every dry-test command, exit code, and full output. `baseline-results.json` records the isolated HEAD comparison; the temporary baseline copy was removed.

## Actor replacements

| Module | Writes changed |
|---|---|
| Job tickets | PATCH: updatedBy; POST start-order and advance: scannedBy. Transition scores inherit the resolved actor. |
| Packaging bags | POST confirm: createdBy; propagated into bags, photos, bag items, and ticket transitions. |
| Laundry photos and after photos | POST: createdBy; PATCH and POST reassign: updatedBy. |
| Order images | POST: createdBy; generated weight/logistics tickets inherit it. |
| Work orders | POST: createdBy, including child order items; PATCH: updatedBy, including provisioning. |
| Order items | POST: createdBy; PATCH and POST reassign-quantities: updatedBy. |
| Bag items | POST: createdBy. |
| Customers | POST registration and PATCH: updatedBy. |
| Payments | POST creation: created_by; PATCH review: updated_by. Handler passes session StaffId as a separate service argument. |
| Invoices | POST header created_by and linked OrderForm updated_by; PATCH status updated_by. Separate service argument; no fallback actor remains in these writes. |
| Packages | POST: createdBy; PATCH: updatedBy, also supplying deletedBy on deactivation through existing mapping. |
| Issue reports | POST: createdBy; PATCH: updatedBy. |
| Appointments | POST: createdBy; PATCH: updatedBy. |
| Customer packages and package transactions | POST purchase and transaction append: createdBy; opening purchase ledger entries inherit it. |

## Writes left unchanged

- WashQueue creation and load/unload/collect/cancel transitions already derive their actors from `req.staff`.
- Job-ticket complete-order already passes the authenticated admin's StaffId separately; preserved its existing admin authorization.
- Staff registration, admin profile updates, and card issuance use authenticated identity/admin authorization. Their schema has no persisted actor column to replace.
- Items create/update and PriceList update have no actor field in their write schemas or stored rows. Their existing gateway authentication remains in force.
- Laundry-tag and invoice print submissions, and the bag-print call within packaging confirmation, have no actor field. They remain print commands rather than actor-bearing row writes.
- Work-order provisioning retains the original tagging actor read from persisted photo rows; that is historical attribution, not a client-sent actor for the current request. Newly supplied work-order actors are replaced with the session StaffId.
- Read-only modules have no writes to change. The unused shared FALLBACK_ACTOR constant remains, but no server module imports or writes it.

No requested implementation was skipped. Live Google Sheets writes, deployment/production ESM checks, and a physical barcode-gun session were not performed; the requested gates and executable scanner/store/gateway tests were run.

## Existing dry-test failures

All of these fail in the final worktree and in the isolated HEAD baseline. They were left outside the brief's scope:

- `tests/server/unit/contracts/order-items/order-item-api.schema.dry-test.ts`
- `tests/server/workflows/invoices/invoice-create.workflow.dry-test.ts`
- `tests/server/workflows/invoices/invoice-sheets-api.workflow.dry-test.ts`
- `tests/web/unit/architecture/frontend-data-boundaries.dry-test.ts`
- `tests/web/unit/data/customer-packages/customer-package.service.dry-test.ts`
- `tests/web/unit/data/customer-scoped-store-reloads.dry-test.ts`
- `tests/web/unit/features/appointments/stores/appointment.store.dry-test.ts`
- `tests/web/unit/features/customers/stores/customer-order-history-race.dry-test.ts`
- `tests/web/unit/features/orders/composables/order-image-weight-query.dry-test.ts`
- `tests/web/unit/features/orders/stores/order.store.dry-test.ts`
- `tests/web/unit/shared/navigation/form-route-integrations.dry-test.ts`

The failures cover a stale order-item export assertion; two invoice workflow fixtures rejected by the current invoice-number contract; pre-existing frontend dependency-boundary violations; a stale raw-fetch assertion; async store timing expectations; and stale weight-prompt/navigation source assertions.

## Review

Completed the frontend-review checklist directly, without agents: conventions/shared placement, token-only styles, contract integration, scanner lifecycle and filtering, localStorage failure handling, expiry, replacement, synchronous actor mirroring, device role/isAdmin behavior, sign-out cleanup, and API headers. No new route/navigation behavior was introduced. No blocking issue remained in the changed frontend code; live visual/device behavior was not exercised.

## Files changed

- `contracts/auth/auth-api.schema.ts`
- `contracts/staff/staff-api.schema.ts`
- `docs/architecture/backend/operations.md`
- `docs/architecture/backend/persistence.md`
- `docs/architecture/frontend/project-structure.md`
- `docs/features/staff/registration.md`
- `docs/features/staff/shared-device.md`
- `server/modules/after-photos/after-photo.module.ts`
- `server/modules/appointments/appointment.module.ts`
- `server/modules/auth/auth.module.ts`
- `server/modules/bag-items/bag-item.module.ts`
- `server/modules/customer-packages/customer-package.module.ts`
- `server/modules/customer-packages/package-transaction.module.ts`
- `server/modules/customers/customer.module.ts`
- `server/modules/invoices/invoice.module.ts`
- `server/modules/invoices/invoice.service.ts`
- `server/modules/issue-reports/issue-report.module.ts`
- `server/modules/job-tickets/job-ticket.module.ts`
- `server/modules/laundry-photos/laundry-photo.module.ts`
- `server/modules/order-images/order-image.module.ts`
- `server/modules/order-items/order-item.module.ts`
- `server/modules/packages/package.module.ts`
- `server/modules/packaging-bags/packaging-bag.module.ts`
- `server/modules/payments/payment.module.ts`
- `server/modules/staff/staff.module.ts`
- `server/modules/staff/staff.service.ts`
- `server/modules/work-orders/work-order.module.ts`
- `server/shared/auth/staff-list.ts`
- `server/shared/http/api-gateway.ts`
- `server/shared/http/crud-routes.ts`
- `server/shared/http/session-actor.ts`
- `src/App.vue`
- `src/data/auth/auth.store.ts`
- `src/data/operator/operator.store.ts`
- `src/features/job-tickets/composables/useScannerGunInput.ts`
- `src/features/job-tickets/pages/DepartmentWorkPage.vue`
- `src/features/staff/utils/staff-presentation.ts`
- `src/shared/api/firebase-auth.ts`
- `src/shared/composables/useScannerGunInput.ts`
- `src/shared/config/actor.ts`
- `src/shared/utils/staff-card.ts`
- `tests/server/unit/api/route-registry-after-photos.dry-test.ts`
- `tests/server/unit/api/route-registry-bag-items.dry-test.ts`
- `tests/server/unit/api/route-registry-laundry-photos.dry-test.ts`
- `tests/server/unit/api/route-registry-order-images.dry-test.ts`
- `tests/server/unit/api/route-registry-order-item-reassign.dry-test.ts`
- `tests/server/unit/api/route-registry-photo-reassign.dry-test.ts`
- `tests/server/unit/api/route-registry-work-orders.dry-test.ts`
- `tests/server/unit/api/shared-device-operator.dry-test.ts`
- `tests/server/unit/modules/after-photos/after-photo-writes.dry-test.ts`
- `tests/server/unit/modules/invoices/invoice-create-preflight.dry-test.ts`
- `tests/server/unit/modules/invoices/invoice-status-update.dry-test.ts`
- `tests/server/unit/modules/invoices/invoice-update.dry-test.ts`
- `tests/server/unit/modules/invoices/invoice.service.dry-test.ts`
- `tests/server/unit/modules/invoices/package-invoice.dry-test.ts`
- `tests/server/unit/modules/issue-reports/issue-report-writes.dry-test.ts`
- `tests/server/unit/modules/job-tickets/job-ticket.module.dry-test.ts`
- `tests/server/unit/modules/laundry-photos/laundry-photo-writes.dry-test.ts`
- `tests/server/unit/modules/order-items/order-item-wiring.dry-test.ts`
- `tests/server/unit/modules/packages/package.module.dry-test.ts`
- `tests/server/unit/modules/payments/payment-review.dry-test.ts`
- `tests/server/unit/modules/payments/payment.service.dry-test.ts`
- `tests/server/unit/shared/auth/staff-cache.dry-test.ts`
- `tests/server/unit/shared/auth/staff-list.dry-test.ts`
- `tests/server/unit/sheets/invoice-sheets-api-errors.dry-test.ts`
- `tests/server/unit/sheets/service-wiring.dry-test.ts`
- `tests/server/workflows/invoices/invoice-api.workflow.dry-test.ts`
- `tests/server/workflows/invoices/invoice-create.workflow.dry-test.ts`
- `tests/server/workflows/invoices/invoice-sheets-api.workflow.dry-test.ts`
- `tests/web/unit/features/job-tickets/composables/use-scanner-gun-input.dry-test.ts`
- `tests/web/unit/shared/config/operator.store.dry-test.ts`
- `tests/web/unit/shared/utils/staff-card.dry-test.ts`

The scanner file is moved from `src/features/job-tickets/composables/useScannerGunInput.ts` to `src/shared/composables/useScannerGunInput.ts`. Generated verification artifacts in this directory are additional report files. The supplied `.user/briefs/` contents were not modified.
