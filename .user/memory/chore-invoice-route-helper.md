# `chore/invoice-route-helper`

## What is on it

- `getInvoiceTarget` and its `InvoiceTarget` type moved to
  `src/shared/navigation/invoice-detail-route.ts`. `isInvoiceActionAvailable` stayed in
  `src/features/orders/utils/order-invoice-target.ts` for `OrderCard`'s button visibility.
- Both `viewInvoice` call sites dropped a redundant guard: `getInvoiceTarget` already returns null
  for an empty or whitespace-only number.
- One allowlist line deleted from `scripts/check-cross-feature-imports.mjs`; six entries became five.

## Placement rule this settled

UI folders (`src/shared/components`, `layouts`) stay generic and must not know domain fields —
`title`, never `orderName`. Non-UI folders under `src/shared/` may hold cross-feature business rules,
which is why the route builder qualified and the cards do not.

## Rejected during this work, do not re-propose

- Moving `invoice-status-presentation.ts` or `order-status-presentation.ts` to `src/shared/utils/`.
  Each is used only inside its own feature, so shared would be the wrong layer.
- `src/shared/components/<domain>/` for the remaining cards: still UI that knows domain fields.
- A new `src/ui/<domain>/` layer: rejected as too much structure for five files.
