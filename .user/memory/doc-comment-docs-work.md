# Open work from the doc-comment audit

Two things remain: prose that must be written into `docs/` before its source comment can go, and
claims nobody has verified. Everything the audit resolved is gone — see `git log` for it.

**Every line below is a claim, not an instruction.** Open the code and the cited document before
acting. The audit was wrong twice already. If a comment does not say what a row claims, fix the
row; do not delete the comment.

Related: `.user/memory/stale-comments-and-defects.md` holds the 12 comments that contradict the
code and the 2 real defects.

## Deferred — 58 ALREADY-DOCUMENTED rows

They justified deletion by citing `docs/conventions/data-fetching.md` or `docs/plans/cache-gateway.md`.
Neither is an authority: the first is an unreviewed draft now at `agent-docs/conventions/`, the
second declares itself build history. These rows cannot be decided until a canonical cache
convention is written. Their detail is in `git log` — recover it from there if that convention
ever lands.


## MOVE — prose to write into `docs/`, then delete the source comment

### `docs/conventions/data-fetching.md` — Cache policy

**Blocked:** this document is an unreviewed draft at `agent-docs/conventions/`.
These two entries wait on the same decision as the 58 deferred rows above.

M1, from `src/shared/api/persistent-cache.ts:117-118`:

> Persisted writes are best-effort. If a `localStorage` write fails, the cache clears persisted entries and retries once; if that also fails, reads continue from the in-memory layer and a reload starts cold.

`## Bounded queries` — from `src/features/customers/utils/waiting-pickup.filter.ts:10-14`:

> The appointments list API exposes an exact `appointmentDate` filter but no `deletedAt` or date-range filter. Waiting-pickup filtering therefore remains client-side; soft-deleted rows may appear, so this helper is not a deletion-correctness boundary.

`## Cache policy` — from `src/features/customers/stores/customer.store.ts:14`:

> `useCustomerStore` caches the full customer list and skips subsequent loads unless `force` is true. Set `force: true` or call `invalidate()` when the next load must refetch.

### `docs/conventions/datetime.md`

M2, under the read/normalization guidance:

> Frontend date normalization must preserve date-only civil values while interpreting timestamp values as instants and taking their date in `Asia/Bangkok`. This prevents the host timezone from changing a civil date.

M3, under date-only defaults:

> Frontend date inputs and date-only defaults must use the current civil date in `Asia/Bangkok`, formatted as `yyyy-MM-dd`. They must not derive today’s value from the browser’s host timezone.

M4, under scheduling helpers:

> Frontend scheduling helpers derive the current date, weekday, and minutes since midnight from `Asia/Bangkok`. Scheduling decisions must not use the browser’s host timezone.

M5, under civil-date arithmetic:

> Calendar-day calculations on ISO civil dates must use date fields rather than elapsed local-time hours. The shared helper returns the whole-day difference from the `earlier` argument to the `later` argument.

### `docs/design/patterns/list-pages.md` — Filters

M6, from `src/shared/components/ListContainer.vue:20-22`:

> ListContainer search is opt-in because shared screens may render several list sections at once. The appointment schedule renders four containers, while customer detail swaps among order, package, and invoice sections. Enable `searchable` only for the page’s primary browse list.

Note: `docs/features/orders/overview.md:129-132` still describes search as owned by `ListPageLayout`, conflicting with the current code and `docs/design/patterns/list-pages.md`.

`## Filters` — from `src/features/invoices/composables/useInvoiceFilterRoute.ts:38-42`:

> Durable invoice filters are derived from the route query and written with router.replace. Serializing the default filter omits default-valued entries so the default state has a clean empty query.

`## Filters` — from `src/features/customers/composables/useCustomerFilterRoute.ts:7`:

> Customer list filters are route-owned query state: derive them from `route.query` and update them with `router.replace`. Omit default values when serializing the query.


### `docs/features/orders/data-model.md` — `service_type — canonical values`

M7, from `src/shared/utils/service-type-labels.ts:3-14`:

> The canonical service-type codes are `WSIR`, `IRON`, `DRCL`, and `WASH`. Frontend presentation is centralized in `src/shared/utils/service-type-labels.ts`, which supplies the Thai label and icon used by price-list, invoice, and order UI. Update that map when wording changes instead of adding a feature-local copy.

### `docs/features/orders/overview.md` — `SHARED GAPS`

M8, from `src/shared/stores/selected-customer.store.ts:6-17`:

> `useSelectedCustomerStore` is the cross-feature handoff from customer selection to appointment booking. `select()` accepts contract-derived customer fields plus legacy card fields, keeps a nonblank map location, and falls back to a nonblank postal address only when location is absent. If both are unusable, it leaves `location` null rather than inventing a value; the store is handoff state, not picker UI.

### `docs/conventions/contracts/api.md`

`## Rules` — from `src/features/invoices/services/invoice.service.ts:33-53`:

> `POST /api/invoices` returns the `CreateInvoiceResponse` discriminated union directly, rather than the standard `{ success, data, meta }` envelope. The client reads and validates the body even for non-OK statuses and maps an unrecognized body to an `items_write_failed` outcome with `certainty: 'unknown'`.

`## Boundary` — from `src/features/invoices/services/invoice-detail.service.ts:23`:

> `getInvoiceDetail` returns `null` when the requested invoice is not found. Other lookup failures remain errors.

`## Rules` — from `src/features/customer-packages/stores/customer-package-purchase.store.ts:45-48`:

> CYCLE invoices must carry both `billingPeriodStart` and `billingPeriodEnd`; customer-package purchases derive them from the package’s `startDate` and `expiryDate`. Reject the purchase before invoice creation when either date is absent.

### `docs/architecture/backend/operations.md`

`## Sheets writes and certainty` — from `src/features/invoices/services/invoice.service.ts:74`:

> `ORDER` invoice creation writes the invoice number into the source `OrderForm.invoice_id` after the invoice items and header are recorded. `CYCLE` invoices have no source order and skip this linkage stage.

### `docs/architecture/backend/persistence.md`

`## Reads` — from `src/features/customer-packages/services/customer-package.service.ts:51-56`:

> GViz may return numeric-looking identifier cells as numbers. Normalizing them to strings restores the DTO type but cannot restore a lost leading zero; columns requiring that digit must be stored as Plain Text.

### `docs/features/orders/order-detail-screen.md`

`## Caching` — from `src/features/orders/stores/order.store.ts:49-53`:

> When the list already contains an order, the detail store seeds the header from that row while the detail request is in flight. It preserves an existing detail object for the same order so a refresh does not replace loaded items with an empty seed.

### `docs/features/orders/order-item-form.md`

`## Fields` — from `src/features/orders/services/order-price-list.service.ts:15`:

> The price-list picker requests up to 1,000 catalogue rows. When the result reaches that limit, the picker marks the catalogue as truncated and tells staff that search covers only the loaded rows.

`## Overlay` — from `src/features/orders/composables/use-order-overlay-route.ts:28`:

> The canonical overlay query is `orderAction=item`, but the reader continues to accept `?item=new` for existing deep links. New links should write only the canonical key.

### `docs/features/orders/forms/create-order-image.md`

`## Overlay behaviour` — from `src/features/orders/pages/OrderDetailPage.vue:68-70`:

> On the order detail page, DOCUMENT uses `DocumentScannerOverlay`; WEIGHT and BELONGING use the shared `CameraOverlay`. The page passes `open=false` to the inactive overlay so only one camera stream can run at a time.

`## Scanner state machine` — from `src/features/orders/components/DocumentScannerOverlay.vue:44-47`:

> The document scanner moves from `viewfinder` to `capturing` to `adjusting` to `warping`, then returns to `viewfinder` after success. Capture failures return to `viewfinder`; warp failures return to `adjusting` with the captured still preserved.

`## Document detection` — from `src/features/orders/components/DocumentScannerOverlay.vue:255-256`:

> The live document outline is drawn only when detection produces a usable quadrilateral. A miss clears the outline so the UI does not imply that detection succeeded.

## UNVERIFIED — investigate before any verdict

From `src/shared/`:

1. `src/shared/api/api-client.ts:6-18` — the claim depends on `api/CLAUDE.md` and call-site behaviour not present in the listed documents.
2. `src/shared/config/cache.ts:17-30` — "raise TTL after real-world use" has no documentary evidence; `docs/plans/cache-gateway.md:131-134` is itself inconsistent.
3. `src/shared/config/cache.ts:52-59` — the issue-report reporter's use of `localStorage` is unverified.
4. `src/shared/components/BaseSwipeCard.vue:81-90` — the browser compatibility-click rationale has only static source tests behind it, never a runtime check.
5. `src/shared/config/actor.ts:4-10` — `?by=<name>` works, but the claimed AppSheet provenance is established by neither source nor docs.

From `src/features/`:

6. `src/features/invoices/components/InvoiceDatePanel.vue:14-15` — unverified cross-browser claim that a native date input fires one change per keystroke.
7. `src/features/invoices/types/invoice-create.types.ts:23` — is `key` really never submitted?
8. `src/features/invoices/types/invoice-create.types.ts:27` — submit-time numeric parsing and zero/blank filtering unconfirmed.
9. `src/features/invoices/types/invoice-create.types.ts:78` — do callers invoke the factory only for zero-item orders?
10. `src/features/invoices/utils/invoice-price-list.utils.ts:181-188` — do order-seeded rows ever carry the synthetic marker?
11. `src/features/orders/pages/OrderCreatePage.vue:25-26` — `todaySheetDate()` is verified at `:27`; the business claim that intake is nearly always logged same-day is not.
12. `src/features/orders/components/DocumentScannerOverlay.vue:620-621` — historical `enhance` default and unchanged-output claim unchecked.
13. `src/features/orders/components/DocumentScannerOverlay.vue:755-757` — historical reason involving a removed filter strip unchecked.
