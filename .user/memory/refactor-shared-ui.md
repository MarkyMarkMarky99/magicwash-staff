# Branch `refactor/shared-ui`

Shared UI consolidation, plan `docs/plans/shared-ui-consolidation.md`. Cut from `feat/order-intake-page` at `bbd010a6`, so it must merge after (or together with) that branch.

## Status
- Round 1 done: `FormPageHeader` + `CustomerTabCard`, measured identical before/after on Intake, Corporate, Register.
- Round 2 done: `SectionHeader` (Intake, Corporate, Register, garment detail, WashQueue detail); Packaging `.bag-sec`, Intake `.row-sec`, wash options `.sec` left for Round 7.
- Pre-existing dry-test failures (fail at HEAD without refactor changes): `order-image-weight-query` subtest 3, `order.store` (`resolve` of undefined), job-tickets `complete-order`, `job-ticket-store`, `scan-workflow` (ZodError), appointments `pending-appointments-page`, `appointment.store`.

## Pending
- Round 3 done: `PaperCard` (Intake Items, Register, Corporate count sheet); garment detail Orders paper and `AgentCardFrame` differ, Round 7.
- Round 4 done: `InlineNotice` (3 save notices, 4 error alerts); remaining notice variants listed in `.user/memory/refactor-shared-ui-round7.md`.
- Round 5 done: removed `ImageContentCard`, `StickerFab` `done` prop, `ThumbStatusBubble` (WashQueueRow).
- Round 6 done: `AppHeader` typed `backAction`, both props documented.
- Round 7, Round 7 unify (Claude picks the look, shows the owner side-by-side shots).
- Screenshots come from the owner's Chrome at `localhost:3000/#/…` (`vercel dev` must be running and signed in).
