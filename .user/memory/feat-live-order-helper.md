# Branch — `feat/live-order-helper`

## Status

- Local and `origin` branch at `5f12905`; based on merge-base `9688feb` and 165 commits behind current `main`.
- Contains three commits not in `main`: `62edfc4`, `c10ae4d`, and `5f12905`.

## What the branch adds

- `62edfc4` adds `server/modules/orders/order-live.helper.ts` and `tests/server/integration/orders-view-parity.ts`.
- `getLiveOrderById(orderId)` reads `OrderForm`, returns `null` when absent, reads matching `OrderItemForms`, discards rows without an ID, and assembles `LiveOrderView`.
- The parity script reads up to 500 `OrdersView` candidates, selects 50 representative rows, and compares them with concurrency 5; it is read-only.

## Constraints and unknowns

- No route or production caller invokes `getLiveOrderById`; only the parity script calls it.
- The helper maps `createdAt` from `OrderForm.received_date`, while parity expects `OrdersView.created_at`; live equivalence is unverified because the script has not run.
- The exported helper expects an already-validated `orderId`; it performs no runtime input validation itself.
- The branch's documentation points at `.claude/.rules/memory.md`; current `main` uses `.claude/rules/memory.md`.

## Before integrating

- Rebase or recreate the focused helper on current `main`; do not merge its stale documentation/configuration changes wholesale.
- Run the parity script against live data before adding a route or replacing the existing work-order detail path.
