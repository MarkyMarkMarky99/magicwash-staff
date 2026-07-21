# Activity Log

================================================================================

- [CLAUDE] [2026-06-24]
Phase 1 problem/scope drafted. Confirmed appointments is the last legacy `sheet-crud` consumer. Handoff to human: confirm problem, goal, scope, requirements.

================================================================================

- [USER] [2026-06-24]
Confirmed Phase 1 scope: use shared `APPSCRIPT_URL`; remove legacy engine in this migration; route must use `okPaged`; frontend impact is a real API envelope change; write null semantics must be explicit.

================================================================================

- [USER] [2026-06-26]
Re-scoped list query to Base-supported filters only. Decided not to expand the Base read pipeline in this migration.

================================================================================

- [USER/CODEX] [2026-06-27]
Implemented appointment transformer before module migration. Commit pushed: `d655ca4 Prepare appointment transformer`.

================================================================================

- [USER] [2026-06-27]
Requested plan cleanup before continuing. Old detailed activity log removed from the working plan; git history remains the durable record.

================================================================================

- [CODEX] [2026-06-27 13:29]
Drafted Phase 2 migration plan after cleanup: no Base read-pipeline expansion, transformer already implemented, module migration next, route switch to `okPaged`, legacy-engine removal only after appointments no longer imports it. Handoff to reviewer: review the plan before implementation.

================================================================================

- [CLAUDE] [2026-06-27 13:48]
Reviewed Phase 2 plan against the engine source + the migrated `customers` reference. Verdict: approve with changes (2 blockers + 3 clarifications). Detailed findings: `reviews/phase-2-claude-review-2026-06-27.md`. Handoff to @codex.

================================================================================

- [CODEX] [2026-06-27 14:06]
Folded accepted review feedback into `02-plan-design-review.md`: removed `Address`/`address` from `searchFields` and deferred customer-name keyword search; added orphan cleanup scope for `appointment-db.schema.ts` and legacy `appointmentApiSchemas`; added `api/appointments/[id].ts` detail/update edge cases; documented mapper pass-through as load-bearing; added physical sheet column-order verification (A-O, P/Q). Next gate: human approval before Phase 3.

================================================================================

- [CODEX] [2026-06-28 03:04]
Migrated this task from the single-file plan to the collaborative-workflow folder structure (`01-problem-discovery.md`, `02-plan-design-review.md`, `03-implementation.md`, `activity-log.md`, `reviews/`). No plan content changed; the long Phase 2 review moved into `reviews/phase-2-claude-review-2026-06-27.md`.

================================================================================

- [USER] [2026-06-28 04:29]
Approved Phase 2 final plan. Gate passed for Phase 3 implementation after the Phase 2 docs commit is pushed.

================================================================================

- [CODEX] [2026-06-28 05:10]
Phase 3 implemented by group: (1) rewired `appointment.module.ts` to `GSheetRepository + BaseCrudService` with the transformer + `searchFields ['appointmentId','customerId','notes']`, switched `api/appointments/index.ts` to `okPaged`; (2) removed `appointment-db.schema.ts` + legacy `appointmentApiSchemas`; (3) removed legacy engine `sheet-crud`/`google-sheets`/`base-sheet.repository`. Verification green: `typecheck:api` passes, transformer 26, repository 16, BaseCrudService 31. Open: manual physical-sheet column-order check (A–O, P/Q); frontend `okPaged` meta change is out of scope. Pending: commit + push Phase 2 docs and Phase 3 changes.

================================================================================

- [CODEX] [2026-06-28 05:18]
Phase 3 commit pushed: `369137c` on `feature/appointments-module-migration` (16 files, +96/−1325). Phase 3 gate met: implementation matches the approved plan, verification green, commit pushed. Only open item is the manual physical-sheet column-order check.

================================================================================

- [USER/CODEX] [2026-06-29 02:15]
Human added the missing Appointments sheet columns. Codex verified live GViz headers A-Q now match the contract order (`ServiceTier` at O, `DeletedAt` at P, `DeletedBy` at Q) and `appointmentService.getById('APPT-91e5be46')` returns `serviceTier: null`. The remaining Phase 3 manual sheet-column check is resolved.
