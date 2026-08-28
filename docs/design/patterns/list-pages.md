---
last_audited: 2026-08-28
audit_sources:
  - src/features/customers/pages/CustomerListPage.vue
  - src/features/invoices/pages/InvoiceListPage.vue
  - src/features/issue-reports/pages/IssueReportListPage.vue
  - src/features/price-list/pages/PriceListPage.vue
  - src/shared/components/ListContainer.vue
  - src/shared/components/AppHeader.vue
---

# List Page Pattern

Use this pattern for root pages that browse a collection.

## Structure

- `AppLayout` owns header/navigation; filters are a non-scrolling `flex-none` sibling.
- Use one scroll region:

  ```vue
  <main class="min-h-0 flex-1 overflow-y-auto no-scrollbar w-full min-w-0 bg-surface pb-20">
    <ListContainer ... />
  </main>
  ```

- `ListContainer` owns heading, loading, error, empty, and skeleton states.
  Feature components own rows/cards and domain actions.
- Do not change or add a shared page shell for one feature.

## Filters

- Store durable filters in the route query; derive with `computed`, update with
  `router.replace`, and reset the page when a filter changes.
- Header search uses `useHeaderSearch`: register the route in `AppHeader`, open it
  for an active URL search, and close it on unmount.
- Debounce keyword updates. Inputs need labels; filters expose selected state.
- Use staff-facing status labels and feature-owned semantic badge styles, never raw
  API enum values.

## Pagination

Never leave records inaccessible behind a page boundary. A paged API must either:

1. Fetch its bounded collection once and document the cap; or
2. Provide UI pagination, route-owned page state, and `total`, `page`, `perPage`,
   and `totalPages` metadata.

Do not present a current-page length as the collection total.

## Interaction and Verification

- Detail rows are semantic buttons or links with visible keyboard focus. Create
  actions use the `ListContainer` `actions` slot and have an accessible name.
- Test route parsing/serialization, active deep-link filters, pagination
  reachability, loading/error/empty states, and keyboard activation.
- Review at narrow mobile width and with keyboard-only navigation.

This pattern is required for new or materially reworked list pages.

## References

- `CLAUDE.md` for feature boundaries, shared-component restrictions, and route
  history rules.
- `docs/frontend-layout-nav-refactor.md` for the page/navigation taxonomy.
- `docs/conventions/components.md` for component ownership.
