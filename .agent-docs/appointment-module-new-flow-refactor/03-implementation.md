# Implementation

**Status:** Phase 3 implemented — verification green; pending commit/push and one manual sheet-column check

> Gate: Verification passes and the Phase 3 commit is pushed. Implementation must match the approved Phase 2 plan.

## Test Approach

This migration is a wiring swap plus deletions, and the project enforces wiring
correctness at compile time (`<m>Contract satisfies ModuleContract`, the field-map
`satisfies`, and the `GSheetRepository`/`BaseCrudService` generics). So the failing
check that defines "red" here is `npm run typecheck:api`, which was failing on the
legacy module before this phase and is the gate that turns green after it.

- Appointment-specific behavior lives in the transformer, which was already built
  test-first and is covered by 26 dry tests (including the load-bearing mapper
  pass-through case). No change here, re-verified green.
- Generic service behavior (404, 409, projection, query defaults, pagination) is
  covered by `base-crud.service.dry-test.ts` (31 tests). Adding appointment copies
  of these would duplicate generic coverage; the migrated `customers` module set the
  precedent of no module-wiring runtime test, relying on typecheck + the shared
  engine tests instead.

No new redundant tests were added. If broader belt-and-suspenders module coverage is
wanted, an `appointment` service dry test (real `appointmentContract.api` + fake
repository) can be added later.

## Implementation Notes

**Group 1 — module migration + route**

- Rewrote `server/modules/appointments/appointment.module.ts` to the new stack:
  `GSheetRepository({ contract: appointmentContract, ..., transformer: createAppointmentTransformer() })`
  + `BaseCrudService({ repository, api: appointmentContract.api, searchFields: ['appointmentId', 'customerId', 'notes'] })`,
  using shared `APPSCRIPT_URL`. Mirrors `customer.module.ts`.
- Switched `api/appointments/index.ts` from `okPaginated` to `okPaged`.
- `api/appointments/[id].ts` needs no change — `getById`/`update` exist on
  `BaseCrudService`; it typechecks against the new service unchanged.

**Group 2 — duplicate schema cleanup**

- Deleted `server/modules/appointments/appointment-db.schema.ts` (the divergent
  second row schema).
- Removed the legacy flat `appointmentApiSchemas` bundle from
  `contracts/appointments/appointment-api.schema.ts`.

**Group 3 — legacy engine removal**

- Deleted `server/shared/sheet-crud/`, `server/shared/google-sheets/`, and
  `server/shared/repositories/base-sheet.repository.ts`.
- Pre-removal grep confirmed every importer of these was inside the deleted set
  itself (or docs); the new engine and dry tests do not import them.

## Deviations From Approved Plan

- None in code.
- **Open manual check (plan step 5):** physical Appointments sheet column order must
  match the contract's 17-key order used by `deriveGVizColumns` (A–O aligned;
  `DeletedAt`/`DeletedBy` appended at P/Q). This is a live-sheet check that cannot be
  verified from code — needs a human/live read before trusting reads in production.

## Downstream Impact (out of scope, flagged)

- `okPaginated -> okPaged` changes the list envelope's `meta.pagination` from
  `{ total, page, perPage, totalPages }` to `{ page, perPage }`. The frontend
  appointments list that consumes this endpoint will see the reduced meta. Frontend
  migration is out of scope for this task but should be tracked.

## Verification

All green (2026-06-28):

- `npm run typecheck:api` — passes (was failing on the legacy module before Phase 3).
- `npx tsx server/modules/appointments/appointment.transformer.dry-test.ts` — `26 appointment transformer dry tests passed`.
- `npx tsx server/shared/repositories/repository.dry-test.ts` — `16 repository dry tests passed`.
- `npx tsx server/shared/services/base-crud.service.dry-test.ts` — `31 BaseCrudService dry tests passed`.
