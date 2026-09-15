# `chore/cross-feature-import-check`

## Done

- `scripts/check-cross-feature-imports.mjs` plus `npm run check:cross-feature-imports`. Catches both
  `@/features/...` and relative specifiers, and fails when an allowlist entry stops matching so the
  list cannot rot. Verified by injecting one of each form.
- Rule tightened in `docs/architecture/frontend/feature-structure.md`; command documented in
  `docs/conventions/verification.md`.

## Open decision, blocking the allowlist reaching zero

Six imports are allowlisted. Five are presentational components and one is a util, each used by
exactly two features: `InvoiceCard`, `OrderCard`, `CustomerPackageListCards`, `PriceListItemPicker`
(twice), and `orders/utils/order-invoice-target`.

The user rejected putting them under `src/shared/components/`, which must stay generic and
domain-free. Where domain-shaped shared components live is undecided. Routing across features stays
allowed and is not affected.

## Rejected, do not re-propose

- Moving `features/customers/stores/customer-packages.store.ts` into `src/data/`. It is a feature
  view-model over `src/data/customer-packages/customer-packages-by-customer.store.ts` and holds UI
  state; `feature-structure.md` puts it exactly where it is. An earlier claim that it mirrored
  `src/data/invoices/customer-invoices.store.ts` was wrong.
- Merging `features/customer-packages` into `features/customers`.
