# Branch `refactor/shared-ui`

Shared UI consolidation, plan `docs/plans/shared-ui-consolidation.md`. Cut from `feat/order-intake-page` at `bbd010a6`, so it must merge after (or together with) that branch.

## Status
- Rounds 1–7 (A–F) done and committed; owner has not yet looked at the intended visual changes (StickerFab 48→46 on WashQueue Photo / price-list Ask AI, garment detail Orders tab, AgentCardFrame tab, list-card status badges).
- Not browser-checked: AgentCardFrame (needs a live agent proposal), OrderBagRow bubble, the two new InlineNotice sites.

## Pending
- Left for later design work: other notice variants, sheet headers/close buttons, photo tiles, metadata grids, timelines, tag stickers, loading/empty states, three section-header copies — inventory in `.user/memory/refactor-shared-ui-round7.md`.
- 13 dry-test files already fail on `bbd010a6` (not caused here): architecture frontend-data-boundaries, customer-package.service, agent-chat.store, pending-appointments-page, appointment.store, customer-order-history-race, job-tickets complete-order/job-ticket-store/scan-workflow, order-image-weight-query, order.store, list-page-layout, form-route-integrations.
