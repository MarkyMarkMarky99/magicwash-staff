# Project memory

Live note for the next session. Branch: `main`.

## Branches in flight

- **`feat/live-order-helper`** — read-only helper branch retained without a worktree. Details: `.user/memory/feat-live-order-helper.md`.

## Pending work

- **Forms and navigation**
  - FormPicker does not close when clicking or tabbing to another field; fix in `FormPicker.vue`, then browser-test. Merged into `main` with the bug open.
  - Remove dead CSS `.invoice-line-select` in `InvoiceLineItemsEditor.vue`.
  - Pre-existing defect: some forms `push` on exit, so Back re-opens the form after save. See `.user/memory/form-exit-history.md`.
  - Agreed rule: a form is a temporary layer — after leaving it by any button, no form entry may remain in history.
  - Browser-verify the form-routes refactor (merged untested in a browser); unticked to-dos in `docs/plans/form-routes.md`.

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
  - Reduce page-load latency, in this order: `work-order.service.ts:195` (reads the whole Customers sheet per order-list load, now on customer detail too), `customers/services/order.service.ts:11` (no `perPage`, 104 KB measured), `invoice.service.ts:631` (date filter drops pagination), `App.vue:8` (prefetches appointments on every mount), then HTTP cache headers on `/api/*`. Measured 2026-09-08: GViz 0.49s · prod warm 0.82s · prod cold 1.65s. Fewer reads beats smaller ones.
  - Fix invoice `dateFrom`/`dateTo` filtering, which compares GViz `Date(...)` values against ISO strings.
  - Decide whether to delete the now-callerless `OrdersView`-backed `/api/orders` module or keep it for a future live `/api/orders/:id`. See `.user/memory/feat-live-order-helper.md`.
  - Normalize GViz `Date(...)` values reaching photo modules according to `docs/conventions/datetime.md`.
  - Consolidate datetime helpers in a dedicated pass; `SheetRepository` is shared by every module.
  - App-wide GViz read normalization is deferred by the user; do not start or re-propose it. See `.user/memory/gviz-read-normalization.md`.

- **Prices, invoices, and sheet data**
  - Defer mixed-service orders to a separate branch after the price-list photo release; see `.user/memory/mixed-service-orders.md`.
  - Fill real prices for the 33 inactive price-list rows with `price: 0`.
  - Add a `BaseSwipeCard` action to add a price to an existing item.
  - Fix the price-list query missing an `active` filter and invoice items always writing `service_type` as `null`.
  - Decide between `CANCELLED` and `VOID` before changing the invoice contract.
  - Decide whether to renumber the four legacy uuid-shaped invoice numbers; they are referenced as `invoiceId` on customer-package rows.
  - App-wide pagination is deferred: repair `okPaged` before adding invoice and customer-package pagers.
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
  - Browser-test on production, all merged untested at the user's direction: row cards (scroll-and-release must not navigate, tap must open, swipe must still work) and invoice creation from both the manual form and a package purchase.
  - Decide where domain components used by two features live; `src/shared/components/` must stay generic, so the 6-entry allowlist in `scripts/check-cross-feature-imports.mjs` cannot shrink yet.
  - Appointment date strip opens at day 1 instead of centering today; a `scrollTo` attempt hid the strip, so diagnose in a real browser first.
  - `ListContainer` collapsible header is a non-focusable `div` without `aria-expanded`; schedule slots now start collapsed when empty.
  - Phone-test ISS-72adcdca: a cache-hit customer-row tap must open only customer detail, while the swipe action still fires.
  - Browser-check ListContainer search, theme consistency, and the order-detail dropdown at the bottom edge.
  - Give `BaseOverlayFrame` a full-bleed size so `LightboxOverlay` can drop its five `!important` padding overrides; then delete `docs/plans/scroll-region.md` and `docs/plans/overlay-frame.md` when unreferenced.
  - Delete sheet test data: `Packages` `ZZTEST01` / `af9f0651`; `OrderForm` `246fde2b`, `cc4d375e`, `f68ae08d`; `LaundryPhotos` `QK0H9DT1`, `a260b2b1`, `1b7649ba`; `AfterPhoto` `0aacd052`.
