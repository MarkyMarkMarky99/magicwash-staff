# Plan — one open/close rule for every form

Status: **in progress.**

## Why

A form is meant to stack over whatever page opened it and, on close, return to exactly that page.
Today every form does something different:

| route | close / cancel | after save | context in |
|---|---|---|---|
| `appointment-create` `/new-booking` | `router.back()` | `router.back()` | Pinia handoff stores, no URL |
| `appointment-reschedule` | `router.back()` | `router.back()` | param |
| `customer-create` | `replace(customer-list)` | not implemented | — |
| `order-create` | `replace(order-list)` | `replace(order-detail)` | picks customer itself |
| `package-create` / `-edit` | `push('/packages')` | `push('/packages')` | param |
| `price-list-create` / `-edit` | `push('/price-list')` | `push('/price-list')` | param, `category` query |
| `issue-report-create` | `useGoBack()` (push fallback) | `replace(issue-reports)` | — |
| `customer-package-create` | prop-driven; also **embedded** in `CustomerDetailPage` | emits `created`, no nav | query `customerId` or props |
| `invoice-create` | result/host-specific behavior | result screen | `customerId` / `orderId` plus handoff store |

Problems this causes:

- Unconditional `back()` leaves the app on a deep link; `push` on close stacks history so Back
  re-opens the form.
- `/new-booking` opened by URL or after refresh has no customer — the context lives only in
  `selected-customer.store` and `delivery-booking-intent.store`.
- `CustomerDetailPage.vue:23-25,177-183` imports another feature's page, breaking
  `project-structure.md:141-154` / `feature-structure.md:62-70`.
- Customer detail uses `router.replace` for `appointment-create` and `invoice-create`
  (`CustomerDetailPage.vue:123-143`), so closing those forms drops the order sheet the user came
  from. Customer-package buy already opens with a query `push`.

## Decisions already made — do not reopen

1. **A form is a route owned by its feature.** It stays under `src/features/<feature>/`. It is not
   moved to `src/data/` (data layer, keyed by sheet, must not hold UI) and not embedded by another
   feature.
2. **Opening = `router.push` by route name + query ids.** A host knows only a route name and query
   keys — no component, page or store import.
3. **The form page loads its own context from those ids** through `src/data/` stores. No handoff
   stores. Refresh and deep link must work.
4. **Closing = one shared helper for cancel, the X, and deep-link fallback only:**
   `history.state.back` present → `router.back()`; absent → `router.replace(fallback)`. Never `push`
   on close. After-save behavior is an explicit per-form policy owned by the feature, not the close
   helper.
5. **Hosts open with `push`, never `replace`**, so Back restores the host exactly (tab, sheet query,
   and scroll position).
6. **Each feature owns its post-save destination and refresh policy.** A form that returns to its
   host relies on the relevant `src/data/` service cache invalidation; it does not notify the host
   directly. Forms with another post-save destination implement that policy themselves.
7. Query-owned overlays that are *not* forms (order sheet, pickers, lightbox, `transaction`) are out
   of scope here; see "Later".
8. **`order-create` keeps navigating to the new order detail after save.**
9. **`invoice-create` keeps its result screen and is not converted to `FormOverlay` in this plan.**
   Loading its context from `customerId` / `orderId` and changing its host navigation to `push` are
   in scope.
10. **Keep the appointment-create path `/new-booking`.**

`history.state.back` remains the in-app signal; no launch token is added. Vue Router sets `back`
only for in-app navigation, so after a refresh `back()` still returns to the in-app origin, which is
the desired result, while a fresh deep link has `back: null`. Browser tests must prove both the
refresh and Forward cases.

## To-do

### Step 1 — shared close helper, route builders, and rules

- [x] Add `src/shared/navigation/use-close-route.ts` with the history-aware `close()` behavior.
- [x] Add `src/shared/navigation/form-routes.ts` with shared form route-name constants and typed
  location builders for appointment create, order create, customer-package create, and invoice
  create.
- [x] Add `tests/web/unit/shared/navigation/use-close-route.dry-test.ts` covering router Back when
  `history.state.back` is present and fallback Replace when it is absent, and keeping save policy
  out of the helper.
- [x] Add `tests/web/unit/shared/navigation/form-routes.dry-test.ts` covering every shared form route
  builder's query shape.
- [x] Update `docs/conventions/navigation.md` with the form open/close/host-history rules and replace
  stale `BaseOverlay`/`BaseFullOverlay` names with `BaseOverlayFrame`.
- [x] Update `docs/design/patterns/forms.md` with route-query context loading, `useCloseRoute` for
  cancel/X, and feature-owned post-save policy.
- [x] Update `docs/architecture/frontend/feature-structure.md` with route-only cross-feature form
  access and the distinction between shared workflow state and local form field state.

### Step 2 — appointment create vertical slice

- [x] Update `src/features/appointments/routes.ts` to use the shared appointment-create route-name
  constant while preserving `/new-booking`.
- [x] Update `src/features/appointments/pages/CreateAppointmentPage.vue` to read and validate
  `customerId`/`orderId`, load context through `src/data/`, show error-and-close states, use
  history-aware cancel/X fallback, and return to the origin after save.
- [x] Update `src/features/appointments/components/AppointmentForm.vue` to accept the data-layer
  customer DTO instead of the obsolete handoff-store type.
- [x] Update `src/features/customers/components/CustomerCard.vue` to push
  `appointmentCreateRoute(...)`.
- [x] Update `src/features/customers/components/OrderHistoryCustomerCard.vue` to push
  `appointmentCreateRoute(...)` with customer/order context.
- [x] Update `src/features/customers/pages/CustomerDetailPage.vue` so `bookDelivery` pushes the
  shared appointment-create route location and preserves an open order-sheet origin.
- [x] Update affected appointment-create dry tests, including missing, malformed, unknown, and
  mismatched route context plus return-to-origin behavior.

### Step 3 — close-only forms

- [x] Update `src/features/appointments/pages/RescheduleAppointmentPage.vue` to use
  `useCloseRoute` for cancel/X with the appointments fallback while preserving its save policy.
- [x] Update `src/features/customers/pages/CustomerCreatePage.vue` to use `useCloseRoute` for
  cancel/X with the customer-list fallback while preserving its save policy.
- [x] Update `src/features/packages/pages/PackageFormPage.vue` to use `useCloseRoute` for cancel/X
  with the packages fallback while preserving its create/edit save policy.
- [x] Update `src/features/price-list/pages/PriceListFormPage.vue` to use `useCloseRoute` for
  cancel/X with the price-list fallback while preserving its create/edit save policy.
- [x] Update `src/features/issue-reports/pages/IssueReportFormPage.vue` to use `useCloseRoute` for
  cancel/X with the issue-report-list fallback while preserving its save policy.
- [x] Confirm the remaining non-form callers of `src/shared/composables/use-go-back.ts` keep the
  existing push fallback; do not change unrelated overlay composables.
- [x] Update every affected close-only form dry test for history Back and deep-link fallback without
  changing post-save destinations.

### Step 4 — customer-package create extraction

- [x] Update `src/features/customer-packages/routes.ts` to use the shared customer-package-create
  route-name constant.
- [x] Update `src/features/customer-packages/pages/CustomerPackageCreatePage.vue` to accept purchase
  context from query only, remove embedding props/emits, use history-aware close with the correct
  fallback, and return to its origin after save.
- [x] Update `src/features/customers/components/CustomerPackagesSection.vue` so Buy pushes
  `customerPackageCreateRoute({ customerId })` instead of requesting an embedded form.
- [x] Update `src/features/customers/pages/CustomerDetailPage.vue` to remove the embedded
  customer-package page, `buyPackage` query handling, purchase-store import/watchers, and embedded
  close/created handling.
- [x] Delete `src/features/customers/composables/useCustomerPackageBuyRoute.ts`.
- [x] Verify through existing data-store dry coverage that `src/data/customer-packages/customer-package.service.ts`
  invalidation refreshes a KeepAlive-reactivated customer detail.
- [x] Verify through existing data-store dry coverage that invoice service invalidation refreshes a
  KeepAlive-reactivated customer detail.
- [x] Update `tests/web/unit/features/customer-packages/pages/customer-package-create-page.dry-test.ts`
  for query-only context, close fallback, and feature-owned return-after-save.
- [x] Update `tests/web/unit/features/customer-packages/pages/customer-package-pages.dry-test.ts`
  for the extracted route-owned page.
- [x] Update any other dry tests referencing the removed buy route or changed customer-package
  files.

### Step 5 — order create from a customer

- [x] Update `src/features/orders/routes.ts` to use the shared order-create route-name constant.
- [x] Update `src/features/orders/pages/OrderCreatePage.vue` to read optional `customerId`, preselect
  and lock the customer picker, use history-aware close, and retain navigation to the new order
  detail after save.
- [x] Update `src/features/customers/pages/CustomerDetailPage.vue` with an entry that pushes
  `orderCreateRoute({ customerId })`.
- [x] Update `src/features/customers/components/OrderHistoryCustomerCard.vue` with the customer
  detail entry point for order create.
- [x] Update `docs/features/orders/order-create-screen.md` for route customer context,
  history-aware close, and the unchanged order-detail save destination.
- [x] Update affected order-create/customer-detail dry tests for optional customer context, locked
  selection, fallback close, and unchanged post-save order-detail navigation.

### Step 6 — invoice create route context and host push

- [x] Update `src/features/invoices/routes.ts` to use the shared invoice-create route-name constant.
- [x] Update `src/features/invoices/pages/InvoiceCreatePage.vue` to load and validate
  `customerId`/`orderId` route context through `src/data/`, remove handoff-store reads/writes, add
  the specified missing/malformed/unknown/mismatch behavior and close fallback, and preserve the
  result screen.
- [x] Update `src/features/invoices/services/invoice-create-context.service.ts` to reject customer
  identity and order/customer mismatches from data-layer results.
- [x] Update `src/features/customers/pages/CustomerDetailPage.vue` to push
  `invoiceCreateRoute({ customerId, orderId })` instead of replacing or writing handoff stores.
- [x] Update affected invoice-create/customer-detail dry tests for route context validation, host
  push, fallback behavior, and the unchanged result screen.

### Step 7 — obsolete handoff stores

- [x] Confirm repository-wide that `selected-customer.store.ts` has no remaining readers or writers.
- [x] Delete `src/shared/stores/selected-customer.store.ts`.
- [x] Confirm repository-wide that `delivery-booking-intent.store.ts` has no remaining readers or
  writers.
- [x] Delete `src/shared/stores/delivery-booking-intent.store.ts`.
- [x] Update or delete dry tests that referenced either obsolete handoff store.
- [x] Update `docs/features/orders/overview.md` to remove the obsolete selected-customer handoff
  store option.

### Documentation completion

- [x] Reconcile `docs/conventions/navigation.md` with the fully implemented route-owned form
  behavior.
- [x] Reconcile `docs/design/patterns/forms.md` with the fully implemented context, close, and save
  policies.
- [x] Reconcile `docs/architecture/frontend/feature-structure.md` with the implemented dependency
  direction and form-state ownership.

### Verification

- [x] Run `npm run typecheck:web` until it passes.
- [x] Run every changed or added dry test with `npx tsx --tsconfig jsconfig.json <path>` and confirm
  it passes.
- [x] Find and run every dry test under `tests/web/unit` that references a changed file and confirm
  it passes.
- [x] Update `tests/e2e/customer-detail-tabs.spec.ts` to replace the `?buyPackage=1` case with the
  route-owned customer-package flow without running Playwright.
- [x] Run `npm run check:overlay-frame-imports` and confirm it passes.
- [x] Run `npm run check:scroll-regions` and confirm it passes.
- [ ] Browser: for every migrated form, verify in-app cancel/X returns to the exact URL and scroll
  position, including an open `?order=` sheet.
- [ ] Browser: verify refresh then close returns to the in-app origin via `history.state.back`.
- [ ] Browser: verify fresh deep-link close replaces with the fallback and browser Back does not
  reopen the form.
- [ ] Browser: verify Android Back and browser Back/Forward, including closing again after Forward.
- [ ] Browser: verify return-to-host saves reactivate KeepAlive hosts with fresh invalidated data.
- [ ] Browser: verify malformed, unknown, mismatched, and cross-customer ids show error-and-close
  behavior.

## Navigation decision table

| route | ids read (params/query) | fallback on deep-link close | missing/invalid context behavior | after-save behavior | cache invalidation relied on |
|---|---|---|---|---|---|
| `appointment-create` (`/new-booking`) | query: required `customerId`, optional `orderId` | customer detail when `customerId` is present; otherwise appointments | missing/unknown customer or order/customer mismatch → error state with close | return to origin, owned by appointments | verify in step 2 |
| `appointment-reschedule` | param: appointment id | appointments schedule | verify in step 3 | return to origin, owned by appointments | verify in step 3 |
| `customer-create` | none | customer list | not applicable | not implemented; verify in step 3 | verify in step 3 |
| `order-create` | query: optional `customerId` | order list | verify in step 5 | navigate to new order detail | verify in step 5 |
| `package-create` / `package-edit` | edit param: package id | packages list | verify in step 3 | navigate to packages list | verify in step 3 |
| `price-list-create` / `price-list-edit` | edit param: price-list id; query: `category` | price list | verify in step 3 | navigate to price list | verify in step 3 |
| `issue-report-create` | none | issue reports | not applicable | navigate to issue reports | verify in step 3 |
| `customer-package-create` | query: optional `customerId` | customer detail packages tab when `customerId` is present; otherwise customer-package list | verify in step 4 | return to origin via feature-owned policy | `customer-package.service` and `invoice.service`; verify both reach customer detail in step 4 |
| `invoice-create` | query: `customerId`, `orderId` | verify in step 6 | verify missing, malformed, unknown, and order/customer mismatch in step 6 | keep result screen | verify in step 6 |

## Shared pieces (step 1)

- `src/shared/navigation/use-close-route.ts` — `useCloseRoute(fallback: RouteLocationRaw)` returns
  `close()` for cancel and X. It implements only decision 4's history-aware close and deep-link
  fallback; successful saves do not call it. It must not call History APIs outside the router except
  reading `window.history.state.back` (Vue Router's own field; works with the app's hash history).
- `src/shared/navigation/form-routes.ts` — route-name constants and typed location builders for forms
  that other features open, e.g. `appointmentCreateRoute({ customerId, orderId? })`,
  `orderCreateRoute({ customerId? })`, `customerPackageCreateRoute({ customerId? })`,
  `invoiceCreateRoute({ customerId, orderId })`. Feature `routes.ts` files use the same constants.
  Strings only — shared still imports nothing from features or data.
- `useGoBack()` (`src/shared/composables/use-go-back.ts`) currently falls back with `push`; migrate
  its one form caller (issue report) and decide whether non-form pages keep it.

Unit tests: both branches of `close()` (back present / absent), confirmation that save policies do
not live in the helper, and each builder's query shape.

## Steps

All steps are implemented together on branch refactor/form-routes; browser verification runs after the full change.

1. **Shared close helper + route builders + docs rule.** Add the history-aware cancel/X helper,
   typed form route builders, and the canonical navigation/form rules. No form behavior change yet.
2. **Appointment create full vertical slice.**
   - Keep `/new-booking`. Route reads `customerId` (required) and `orderId` (optional →
     `DELIVERY`).
   - Page loads the customer and validates that the order belongs to it through `src/data/`, then
     passes the snapshot to `AppointmentForm` as today. Missing/unknown `customerId` or a malformed,
     unknown, or mismatched `orderId` → error state with close.
   - Customer list card, `OrderHistoryCustomerCard`, and `CustomerDetailPage.bookDelivery` push
     `appointmentCreateRoute(...)`.
   - Cover opening from customer detail while an `?order=` sheet is open and returning to that exact
     sheet after cancel/X and the feature-owned return-after-save policy.
   - Fallback: customer detail when `customerId` is present, otherwise appointments.
3. **Close-only forms.** Swap cancel/X handling to `useCloseRoute` in
   `appointment-reschedule`, `customer-create`, `package-create/edit`, `price-list-create/edit`, and
   `issue-report-create`. Keep each feature's explicit existing after-save destination. Fallback is
   the feature list page (reschedule: appointments schedule).
4. **Customer package create extraction.**
   - Remove the embed, `buyPackage` query, `useCustomerPackageBuyRoute`, and the purchase-store
     import/watchers from `CustomerDetailPage`.
   - Packages tab "buy" pushes `customerPackageCreateRoute({ customerId })`; the page's existing
     `customerId` → purchase mode logic stays, now from query only. Drop the `customerId`/`customer`
     props and `close`/`created` emits.
   - After save, use the feature-owned return-to-origin policy. Before removing the customer-detail
     watchers, verify that `customer-package.service` / `invoice.service` invalidation reaches the
     KeepAlive-deactivated customer detail and refreshes its packages/invoices when reactivated.
   - Fallback: customer detail packages tab when `customerId` is present, otherwise
     customer-package list.
5. **Order create from a customer.** Read optional `customerId`; when present preselect and lock the
   picker. Add an entry on customer detail (new — it has none today). Keep the feature-owned
   post-save navigation to the new order detail.
6. **Invoice create context + host push.** Customer detail pushes `invoiceCreateRoute` instead of
   replacing. Invoice create loads and validates its context from `customerId` / `orderId`, removes
   its handoff-store reads/writes, and keeps its existing result screen. It is not converted to
   `FormOverlay` in this plan.
7. **Delete obsolete handoff stores.** Only after a repository-wide check shows no readers or
   writers remain, delete `selected-customer.store.ts` and `delivery-booking-intent.store.ts`.

## Later — not in this plan

- Replace the seven duplicated query-overlay implementations: five composables
  (`useOrderSheetRoute`, `useOrderPackageUsageRoute`, `useCustomerPackageTransactionRoute`,
  `useInvoiceItemPickerRoute`, `use-order-overlay-route`) plus inline copies in `PriceListPage` and
  `OrderGalleryPage`, with one shared query-overlay helper. `useCustomerPackageBuyRoute` is removed
  by step 4 and is not part of this debt.
- Remaining non-form cross-feature imports: `CustomerInvoicesSection` → invoices component,
  `CustomerPackagesSection` → customer-packages component, `OrderList` → orders utilities,
  `PriceListItemPicker` in orders/invoices (move to `shared/components/` if it only takes rows as
  props, then update `docs/design/price-list-picker.md`).

## Docs to update in the same changes

- `docs/conventions/navigation.md` — form-route rule (decisions 2, 4, 5); fix stale
  `BaseOverlay`/`BaseFullOverlay` names (now `BaseOverlayFrame`).
- `docs/design/patterns/forms.md` — page opens context from query ids; cancel/X close via
  `useCloseRoute`; after-save behavior is owned explicitly by the feature.
- `docs/architecture/frontend/feature-structure.md` — cross-feature form access is by route only;
  clarify ambiguous wording: stores own shared workflow state, while reusable form components own
  local field state.

## Verification per step

- `npm run typecheck:web` and dry tests.
- Update `tests/web/unit/features/customer-packages/pages/customer-package-create-page.dry-test.ts`
  and `customer-package-pages.dry-test.ts` (step 4).
- Browser coverage via the `frontend-test` skill for each migrated form:
  - Open in-app, then cancel/X: return to the exact host URL and scroll position, including
    restoration of an open `?order=` sheet.
  - Refresh an in-app-opened form, then close: return to its in-app origin using the preserved
    `history.state.back` signal.
  - Open a fresh deep link, then close: replace with the fallback; browser Back must not reopen the
    form.
  - Exercise Android Back and browser Back, then browser Forward, including closing the form again
    after Forward.
  - Save a form whose feature policy returns to its host: the KeepAlive-deactivated host shows fresh
    data when reactivated through cache invalidation.
  - Reject malformed, unknown, and mismatched ids, including an `orderId` that does not belong to
    `customerId`, with the specified error-and-close behavior.
- Rewrite the `?buyPackage=1` case in `tests/e2e/customer-detail-tabs.spec.ts:86-111`.
- Keep production-writing E2E tests disabled.
