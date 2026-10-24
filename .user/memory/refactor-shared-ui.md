# Branch `refactor/shared-ui`

Shared UI consolidation, plan `docs/plans/shared-ui-consolidation.md`. Cut from `feat/order-intake-page` at `bbd010a6`, so it must merge after (or together with) that branch.

## Status
- Round 1 done: `FormPageHeader` + `CustomerTabCard`, measured identical before/after on Intake, Corporate, Register.
- Pre-existing dry-test failures (not this branch): `order-image-weight-query` subtest 3, `order.store` (`resolve` of undefined).

## Pending
- Round 2 next (section header). Rounds 3–6 extract, Round 7 unify (Claude picks the look, shows the owner side-by-side shots).
- Screenshots come from the owner's Chrome at `localhost:3000/#/…` (`vercel dev` must be running and signed in).
