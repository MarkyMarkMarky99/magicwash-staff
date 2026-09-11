# Project memory

Live note for the next session. Branch: `main`. Resume context: `.user/memory/HANDOFF-2026-09-12.md`.

## Unmerged branch work

- **`feat/live-order-helper`** — at `5f12905`, 165 commits behind `main` and 3 ahead. A read-only live-order helper and parity script with no production caller. Rebase the helper, do not merge the branch. See `.user/memory/feat-live-order-helper.md`.

## Pending work

- **Images and gallery**
  - Backfill `Cache-Control` on existing photos after Firebase bucket credentials are available. See `docs/plans/image-pipeline.md`.
  - Review real document scans and decide whether the scanner output is acceptable before changing order-image compression.
  - Fix gallery `created_by`: it is read only from `?by=`, and the frontend fallback can fail silently.
  - Remove unnecessary gallery revisit work: `OrderGalleryPage.vue` clears `requestedKey` on deactivation and clears photos before a fetch resolves.
  - Move `usePhotoUpload.js` into the gallery feature and decide where legacy photo capture belongs.
  - Do not re-propose lazy-loading the gallery route: staff open it on nearly every order.
  - Audit and update gallery-read documentation in `docs/architecture/frontend/feature-structure.md`, `docs/features/orders/overview.md`, and `docs/features/orders/forms/create-order-image.md`.

- **Cache, API, and performance**
  - Wire `onFresh` at remaining call sites; first correct the stale cache-plan claim that no caller uses it.
  - Reduce page-load latency, in this order: `work-order.service.ts:195` (reads the whole Customers sheet per order-list load), `customers/services/order.service.ts:11` (no `perPage`, 104 KB measured), `invoice.service.ts:631` (date filter drops pagination), `App.vue:8` (prefetches appointments on every mount), then HTTP cache headers on `/api/*`. Measured 2026-09-08: GViz 0.49s · prod warm 0.82s · prod cold 1.65s. Fewer reads beats smaller ones.
  - Fix invoice `dateFrom`/`dateTo` filtering, which compares GViz `Date(...)` values against ISO strings.
  - Normalize GViz `Date(...)` values reaching photo modules according to `docs/conventions/datetime.md`.
  - Consolidate datetime helpers in a dedicated pass; `SheetRepository` is shared by every module.
  - App-wide GViz read normalization is deferred by the user; do not start or re-propose it. See `.user/memory/gviz-read-normalization.md`.

- **Prices, invoices, and sheet data**
  - Fill real prices for the 33 inactive price-list rows with `price: 0`.
  - Add a `BaseSwipeCard` action to add a price to an existing item.
  - Fix the price-list query missing an `active` filter and invoice items always writing `service_type` as `null`.
  - Decide between `CANCELLED` and `VOID` before changing the invoice contract.
  - App-wide pagination is deferred: repair `okPaged` before adding invoice and customer-package pagers.
  - Clean sheet data: the blank customer row, dirty Orders rows, LaundryPhotos ordering, and page-walks using non-unique sort keys.

- **Auth, UX, and documentation**
  - Decide API authentication and actor identity before launch, while retaining `?by=` as an override.
  - Fix screenshot-upload accessibility states, failed-upload handling, and staff-safe Firebase errors.
  - Align the customer-packages form with `docs/design/patterns/forms.md`.
  - Fix `docs/conventions/naming.md`: composables are kebab-case, not `usePascalCase.ts`.
  - Remove schema-file `z.infer` exports in a dedicated all-contract pass.
  - Migrate remaining local-state overlays: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`, `NavSidebar.vue`.
  - Unnest the remove `<button>` at `OrderGalleryPage.vue:402` from the lightbox `<button>` at `:375` — verified as the only nested pair; the other two files have none.
  - Update list-page documentation that still describes deleted header search (`SEARCHABLE_ROUTES` / `meta.searchable`).
  - Fix 2 real defects in `persistent-cache.ts` and 12 source comments that contradict the code. See `.user/memory/stale-comments-and-defects.md`.
  - Resume held comment-cleanup decisions after a canonical cache convention exists; verify each finding before acting. See `.user/memory/doc-comment-docs-work.md`.
  - `agent-docs/` drafts are non-canonical; do not use them as authority for source comments or rules.

- **Verification and cleanup**
  - Phone-test ISS-72adcdca: a cache-hit customer-row tap must open only customer detail, while the swipe action still fires.
  - Browser-check ListContainer search, theme consistency, and the order-detail dropdown at the bottom edge.
  - Re-run and triage the pre-existing web dry-test failures: `package-pages`, `invoice-price-list-service`, `order-price-list.store`, `customer-package-create-page`, `price-list.store`, and `price-list-service`.
  - Give `BaseOverlayFrame` a full-bleed size so `LightboxOverlay` can drop its five `!important` padding overrides; then delete `docs/plans/scroll-region.md` and `docs/plans/overlay-frame.md` when unreferenced.
  - Delete the untracked `2026-09-12-014025-grok-explorer-2026-09-11-003747-httploca.txt` transcript in the repository root.
  - Remove the old `C:\MagicwashGemini\webapp-vue-frontend` worktree after restart.
  - Delete sheet test data: `Packages` `ZZTEST01` / `af9f0651`; `OrderForm` `246fde2b`, `cc4d375e`, `f68ae08d`; `LaundryPhotos` `QK0H9DT1`, `a260b2b1`, `1b7649ba`; `AfterPhoto` `0aacd052`.
