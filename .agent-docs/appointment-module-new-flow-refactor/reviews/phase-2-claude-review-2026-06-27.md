# Phase 2 Review - Claude - 2026-06-27

**Verdict:** Approve with changes

Reviewed the Phase 2 migration plan against the engine source and the migrated `customers` reference. Wiring, `okPaged`, and transformer mechanics are correct; two blockers and three clarifications must land in the plan before Phase 3.

## Blockers

1. **Drop `address` from `searchFields`** -> `['appointmentId', 'customerId', 'notes']`. `Address` is now a JSON snapshot; `BaseRepository.mapQueryToDb` renames `address` -> `Address` and `GVizQueryBuilder.search` emits `Address contains '<kw>'` over the serialized string, so any keyword that is a constant JSON-key fragment (`Phone`, `Line`, `Email`, `Address`, `Location`, `Customer`) matches EVERY row. Customer-name keyword search needs real columns (out of scope) — defer it, do not search the snapshot.
2. **Cleanup scope is incomplete.** Migrating the module orphans `server/modules/appointments/appointment-db.schema.ts` (a SECOND, divergent `appointmentRowSchema` — 15 cols vs the contract's 17) and the legacy `appointmentApiSchemas` flat bundle in `contracts/appointments/appointment-api.schema.ts` (lines 150-159). Add both to the removal list — leaving the duplicate row schema keeps two sources of truth and defeats the migration goal. Grep-confirmed: after the module switch nothing else imports either.

## Clarifications (should-fix)

3. `api/appointments/[id].ts` is unnamed in scope. It needs NO change (`BaseCrudService` exposes `getById`/`update`) but IS exercised — add detail/update edge cases: getById + PATCH responses must surface the flattened customer snapshot + `serviceTier`/`pickupOrderId`/`deliveryOrderId`, and a legacy/plain-string `Address` yields null customer fields.
4. The response transformer's `customerName`/`customerCode`/`phone`/`location` reach the API ONLY because they are absent from `fieldMap` and `Mapper.toApi` passes unmapped keys through (`map[key] ?? key`). Document this load-bearing assumption and keep the mapper-integration dry test, or a future mapper change silently drops the customer fields.
5. GViz column letters are positional (`deriveGVizColumns` by key order). Confirm the physical Appointments sheet matches the new 17-key order — esp. appended `DeletedAt`/`DeletedBy` at P/Q. Reads tolerate missing trailing cols, but A-O must align.

## Confirmed Safe

- Module wiring matches the `customers` reference (transformer passed into `GSheetRepository`).
- `okPaged(items, pagination)` is correct and already used by `api/customers/index.ts`.
- Legacy-engine removal timing is safe — `appointment.module.ts` is the only production consumer of `sheet-crud`/`google-sheets`/`base-sheet.repository` (no test imports found).

## Handoff

Fix the two blockers and fold the three clarifications into `02-plan-design-review.md`, re-check affected edge cases, then request review/approval again. No scope change beyond the documented cleanup additions.
