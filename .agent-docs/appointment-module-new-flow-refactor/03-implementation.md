# Implementation

**Status:** Phase 3 Draft — not started (pending Phase 2 human approval)

> Gate: Verification passes and the Phase 3 commit is pushed. Implementation must match the approved Phase 2 plan.

## Test Plan

Planned TDD order, one approved edge-case group at a time:

1. Transformer request (already implemented + covered; re-verify only).
2. Transformer response (already implemented + covered; re-verify only).
3. Module migration — list: `okPaged` envelope, scoped search fields.
4. Module migration — detail (`getById`): 404, flattened snapshot, detail-only fields, legacy `Address` fallback.
5. Module migration — update (PATCH): 409, flattened snapshot, detail-only fields, legacy `Address` fallback.
6. Schema-cleanup + legacy-engine removal: re-run typecheck and dry tests with no remaining legacy imports.

## Implementation Notes

- Transformer and dry tests are already implemented and pushed (`d655ca4 Prepare appointment transformer`); Phase 3 keeps them unless review finds a bug.
- Module migration, route switch (`okPaginated` -> `okPaged`), duplicate-schema removal, and legacy-engine removal are not yet started.

## Deviations From Approved Plan

- None yet (Phase 3 not started).

## Verification

Pending. Planned commands:

- `npx tsx server/modules/appointments/appointment.transformer.dry-test.ts`
- `npm run typecheck:api`
- repository dry tests if shared repository code changes.
