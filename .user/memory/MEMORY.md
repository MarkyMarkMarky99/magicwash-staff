# Project memory

Live note for the next session. Branch: `refactor/order-detail-ui`.

## Branches in flight

- **`refactor/order-detail-ui`** — order-detail UI pass: item rows stripped to description + quantity, card chrome and section spacing unified, page copy translated to English. Not browser-verified.
- **`feat/live-order-helper`** — read-only helper branch retained without a worktree; 228 behind `main`, keep only the two source files if it is ever revived. Details: `.user/memory/feat-live-order-helper.md`.

## Pending work

- **Forms and navigation**
  - Remove dead CSS `.invoice-line-select` in `InvoiceLineItemsEditor.vue`.
  - Pre-existing defect: some forms `push` on exit, so Back re-opens the form after save. See `.user/memory/form-exit-history.md`.
  - Agreed rule: a form is a temporary layer — after leaving it by any button, no form entry may remain in history.
  - Browser-verify the form-routes refactor (merged untested in a browser); unticked to-dos in `docs/plans/form-routes.md`.

- **Order detail UI**
  - `unit` is a Price List join computed per read; both item tables hardcode `pcs` instead of using `item.unit`.
  - Order items show quantity `0` on every row; not investigated.
  - `OrderDetailSheet.vue` re-implements the item row and the store's load/sequence logic instead of reusing `OrderItemRow` and `useWorkOrderStore`.
  - Order-detail header is taller than the sheet's; the menu button footprint was reduced but the result is unverified in a browser.
  - `orderImageTypeLabels` and `serviceTypeLabel` still return Thai on the now-English order-detail page; decide whether shared labels follow.
  - `docs/features/orders/flows.md` and `order-item-form.md` still describe detail and add-item as unimplemented.
  - `OrderDetailPage.vue` holds its whole template on one physical line, so diffs there carry no signal.

- **Images and gallery**
  - Backfill `Cache-Control` on existing photos after Firebase bucket credentials are available. See `docs/plans/image-pipeline.md`.
  - Review real document scans and decide whether the scanner output is acceptable before changing order-image compression.
  - Fix gallery `created_by`: it is read only from `?by=`, and the frontend fallback can fail silently.
  - Remove unnecessary gallery revisit work: `OrderGalleryPage.vue` clears `requestedKey` on deactivation and clears photos before a fetch resolves.
  - Move `usePhotoUpload.js` into the gallery feature and decide where legacy photo capture belongs.
  - Do not re-propose lazy-loading the gallery route: staff open it on nearly every order.
  - Audit and update gallery-read documentation in `docs/architecture/frontend/feature-structure.md`, `docs/features/orders/overview.md`, and `docs/features/orders/forms/create-order-image.md`.

- **Cache, API, and performance**
  - Price-list store keeps written rows over reads until a read matches every field; watch for rows sticking if GViz formats differ.
  - On hold: durable e2e suite in `tests/e2e/` with page objects; test IDs live in tests, derived from docs.
  - Wire `onFresh` at remaining call sites; first correct the stale cache-plan claim that no caller uses it.
  - Reduce page-load latency, in this order: `App.vue:8` (prefetches appointments on every mount), then HTTP cache headers on `/api/*`. Measured 2026-09-08: GViz 0.49s · prod warm 0.82s · prod cold 1.65s. Fewer reads beats smaller ones.
  - Customers are fetched in full on purpose (real customers are under a thousand); `listCustomers` caps at 2000 and sets `truncated`. Do not add a customers pager.
  - `GVizQueryBuilder` supports only equality-AND; no `IN`/`OR`. Any feature needing a multi-id read must adapt in its own layer, not widen the shared builder.
  - `/api/orders`, `OrdersView`, `InvoicesView` and the invoice view sync stay in the backend for the external portal; the frontend must not use them.
  - Normalize GViz `Date(...)` values reaching photo modules according to `docs/conventions/datetime.md`.
  - Consolidate datetime helpers in a dedicated pass; `SheetRepository` is shared by every module.
  - App-wide GViz read normalization is deferred by the user; do not start or re-propose it. See `.user/memory/gviz-read-normalization.md`.

- **Prices, invoices, and sheet data**
  - Defer mixed-service orders to a separate branch after the price-list photo release; see `.user/memory/mixed-service-orders.md`.
  - Fill real prices for the 33 inactive price-list rows with `price: 0`.
  - Add a `BaseSwipeCard` action to add a price to an existing item.
  - Decide between `CANCELLED` and `VOID` before changing the invoice contract.
  - Decide whether to renumber the four legacy uuid-shaped invoice numbers; they are referenced as `invoiceId` on customer-package rows.
  - Invoice reads now assemble from `Invoices`/`InvoiceItems`/`Payments` in memory; revisit at ~2-3k invoices.
  - Confirm payment-status rules: only `VERIFIED` payments count, and `OVERDUE` outranks `PARTIALLY_PAID`.
  - Confirm whether the LIFF portal still reads `InvoicesView`; if not, the Apps Script sync can go.
  - Customer-package pager is still deferred; `okPaged` carries no total, invoices use `paginatedBody`.
  - Clean sheet data: the blank customer row, dirty Orders rows, LaundryPhotos ordering, and page-walks using non-unique sort keys.

- **Auth, UX, and documentation**
  - Decide API authentication and actor identity before launch, while retaining `?by=` as an override.
  - Fix screenshot-upload accessibility states, failed-upload handling, and staff-safe Firebase errors.
  - Align the customer-packages form with `docs/design/patterns/forms.md`.
  - Fix `docs/conventions/naming.md`: composables are kebab-case, not `usePascalCase.ts`.
  - Consolidate frontend helpers into `src/shared/utils/`; strays include `src/shared/appointment-pending-count.ts` and `src/utils/imageCompression.js`. User deferred this to its own pass.
  - Remove schema-file `z.infer` exports in a dedicated all-contract pass.
  - Migrate remaining local-state overlays: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`, `NavSidebar.vue`.
  - Unnest the remove `<button>` at `OrderGalleryPage.vue:402` from the lightbox `<button>` at `:375` — verified as the only nested pair; the other two files have none.
  - Update list-page documentation that still describes deleted header search (`SEARCHABLE_ROUTES` / `meta.searchable`).
  - Fix 2 real defects in `persistent-cache.ts` and 12 source comments that contradict the code. See `.user/memory/stale-comments-and-defects.md`.
  - Resume held comment-cleanup decisions after a canonical cache convention exists; verify each finding before acting. See `.user/memory/doc-comment-docs-work.md`.
  - `agent-docs/` drafts are non-canonical; do not use them as authority for source comments or rules.

- **Verification and cleanup**
  - Five allowlisted cross-feature imports remain, all UI that knows domain fields, with no legal home under the current rule. Accepted for now; reopen only when a third feature needs one of them.
  - Placement rule settled 2026-09-16: UI folders (`src/shared/components`, `layouts`) stay generic and must not know domain fields; non-UI folders under `src/shared/` may hold cross-feature business rules. Rejected and not to be re-proposed: `src/shared/components/<domain>/`, a new `src/ui/<domain>/` layer, and moving the per-feature status-presentation modules to `src/shared/utils/`.
  - Appointment date strip opens at day 1 instead of centering today; a `scrollTo` attempt hid the strip, so diagnose in a real browser first.
  - `ListContainer` collapsible header is a non-focusable `div` without `aria-expanded`; schedule slots now start collapsed when empty.
  - Phone-test ISS-72adcdca: a cache-hit customer-row tap must open only customer detail, while the swipe action still fires.
  - Browser-check ListContainer search, theme consistency, and the order-detail dropdown at the bottom edge.
  - Give `BaseOverlayFrame` a full-bleed size so `LightboxOverlay` can drop its five `!important` padding overrides; then delete `docs/plans/scroll-region.md` and `docs/plans/overlay-frame.md` when unreferenced.
  - Delete sheet test data: `Packages` `ZZTEST01` / `af9f0651`; `OrderForm` `246fde2b`, `cc4d375e`, `f68ae08d`; `LaundryPhotos` `QK0H9DT1`, `a260b2b1`, `1b7649ba`; `AfterPhoto` `0aacd052`.
