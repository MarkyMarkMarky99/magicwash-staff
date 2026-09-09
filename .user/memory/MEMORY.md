# Project memory
Live note — what is in flight, next, stuck.

## Queue — 2026-09-09, in order

1. **Backfill `Cache-Control` on existing photos.** Script writable now, **not runnable** until the
   user supplies Firebase bucket credentials.
2. **Decide the document scanner's 2400px / q0.88 output.** 3× the camera path's file size. Needs
   the user's eyes on real scans; not a number to lower blindly.
3. **Finish the gallery migration** — `OrderGalleryPage.vue:84` → `apiGetList`, rename `image_url` →
   `imageUrl`, delete `src/api/photos.js`. ~1h, needs a browser check.

## Where we are — 2026-09-09

- **Branch:** `fix/app-column-width` — app width unified into `.app-column` (`src/style.css`),
  applied by `App.vue` + `BaseOverlay` + `BaseFullOverlay` panels. Committed, unpushed.
  **`tests/e2e/app-column-width.spec.ts` has never been run** — needs `vercel dev` on :3102.
  Run it before merging; it is the only guard against the 390px cap coming back.
  Also on it: `overflow-x: hidden` pinned on both overlay scrollers (iOS Safari form panned
  sideways, dragging FormPicker's absolute dropdown off-screen). Pushed for a Vercel preview.
  Date row overflow traced to the iOS native date control's shadow-DOM minimum (~199pt each vs
  390pt of panel); fixed with `appearance: none` + `::-webkit-date-and-time-value` in
  `FormInput.vue`. Received-date now defaults to `todaySheetDate()`. **Awaiting the user's
  check on the preview** — this was inferred from a screenshot, not measured in Safari.
- **Branch:** `feat/live-order-helper` — pushed, unmerged, not finished. Older than `main`.
- **On `main`, merged but unverified on a phone:** `BaseSwipeCard` ghost-click fix (ISS-72adcdca).
  Source-based dry test only; no device has confirmed it. Issue row is still `OPEN`.
- **Open cache gap:** `onFresh` is unwired. `docs/plans/cache-gateway.md`.
- Pre-existing web dry-test failures on an unmodified tree, unrelated to recent work:
  `customer-package-create-page`, `package-pages`.
- Gallery: move `src/composables/usePhotoUpload.js` to `src/features/gallery/composables/`; decide
  legacy photo-capture placement (`overview.md:176`).
- Known gap, not on a live UI path yet: photo modules and OrderImages pass GViz `Date(...)` through
  unnormalized, against `docs/conventions/datetime.md`.
- **Old-photo cache backfill blocked:** bucket credentials required for
  `magicwashlaundry-a50ca.firebasestorage.app`. `docs/plans/image-pipeline.md`.

## Browser checks still pending on `main`

0. **ISS-72adcdca:** cache-hit customer list, finger tap a row — only customer detail may open, no
   order sheet. Then swipe a card and tap a panel button: it must still fire. Mouse and keyboard
   unchanged. Close the issue row once it passes.
1. Search on `#/price-list` (client filter) and `#/invoices` (store fetch); `✕` clears.
2. Deep link `#/invoices?keyword=INV` — box must open by itself with the word in it.
3. `#/price-list`: search → ⚙ → `ซักแห้ง` → type nonsense. **Service buttons must remain.**
4. `#/appointments` and customer detail — must show **no** magnifier at all.
5. Theme sweep: green ink, Noto Sans Thai everywhere.
6. Order detail → dropdown near the bottom edge must flip **above**, all rows visible.
7. Order create → customer picker: scroll options, no scrollbar should appear; merged overlay
   sheet: drag-to-close, scroll, Back, edge-swipe.

## Photos

- **Live bug, unfixed:** gallery learns `created_by` only from `?by=`, frontend falls back to
  `admin`, the only validator fails silently. Re-check now the Apps Script gateway is gone.

## Price list — next

1. Fill real prices for the 33 rows at placeholder `price 0` (all `active: false`).
2. **Add-price-to-existing-item is buried:** `+` always opens "new item". A `BaseSwipeCard` action
   passing `itemCode` is designed, not built.

Reported, not fixed:
- `InvoiceItems.service_type` written `null` always — service survives only in the description.
- No `active` filter on the price-list query; picker fetches everything, filters client-side.

## Page-load latency — next, ranked

Measured 2026-09-08: GViz 0.49s · prod warm 0.82s · prod cold 1.65s · local 1.71s. Prioritize fewer
reads; local measurements include `vercel dev` overhead (~0.9s/request).

1. **`work-orders` reads the whole Customers sheet on every order-list load**
   (`work-order.service.ts:101-107`, `:195` uses `where: {}` whenever the page holds >1 customer).
   Genuinely dependent reads — `Promise.all` cannot fix it. Options: add `whereIn()` to
   `gviz-query.builder.ts` (`:85-98` emits only `col = value`); drop `customerName` and map it
   client-side; cache customers server-side.
2. **Order detail runs three sequential reads** (`:122-133`). The items read needs only `id`, so it
   can run parallel with the order read. ~20min, cheapest real win left.
3. **`listOrdersByCustomer` sends no `perPage`** — up to 500 rows, 104 KB measured for one customer
   (`src/features/customers/services/order.service.ts:11`).
4. **`invoices` + `dateFrom`/`dateTo` drops pagination** (`invoice.service.ts:631`). Needs `>=`/`<=`
   in `GVizQueryBuilder`. ~3h.
5. **`App.vue:8` prefetches appointments on every page mount.** Scope to routes that need it plus
   the pending badge. ~1h.
6. **No HTTP cache headers on `/api/*`** (`vercel.json` covers only `/scanic-ml/*`). Decide
   staleness first.

## Deferred by the user

- **Pagination, app-wide.** Responses omit real `total`/`totalPages`; invoices and
  customer-packages strand rows past 20. Fix `okPaged` first, then add the two pagers.
- **Customers sheet has one all-null row** (1 of 466) — shows as a blank entry in every picker.
  Decide: delete the sheet row, or filter rows without a `customerId`.
- **Live Orders sheet data is dirty** — 1,074 phantom rows plus mixed spellings and timestamp formats;
  a cleanup decision is deferred.
- **`LaundryPhotos` row order is not chronological** — new rows land ~row 20,869. Sort by timestamp.
- **Other modules still page-walk** (`order by <non-unique column>` + limit/offset, can drop rows).

## Open items

- **API authentication before launch.** Actor is a fallback constant in `src/shared/config/actor.ts`
  + `server/shared/config/actor.ts`; `?by=` must keep overriding. Issue reports asking a human to
  type their name folds into this pass.
- Invoice `CANCELLED` vs `VOID` — decide, then the contract. See
  `docs/plans/invoice-contract-merge-and-status-update.md`. Nested invoice/items update blocked
  until delete or soft-delete exists.
- Remove schema-file `z.infer` exports in one dedicated all-contract pass.
- Consolidate datetime helpers separately — `SheetRepository` is shared by every module.
- Stage 4 overlays still local-state: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`,
  `NavSidebar.vue`; nested `<button>` near :255.
- `customer-packages` **create form** diverges from `docs/design/patterns/forms.md`.
- Docs still describe the deleted header search (`SEARCHABLE_ROUTES`, `meta.searchable`);
  `list-pages.md` needs the ListContainer search instead.
- Delete leftover `C:\MagicwashGemini\webapp-vue-frontend` (~34 MB, dead worktree, needs a restart).

## Test data to remove by hand (`SheetRepository.delete()` throws)

- `Packages`: `ZZTEST01` · customer package `af9f0651` (พิมพ์นิดา)
- `OrderForm`: `246fde2b`, `cc4d375e`, `f68ae08d` (customer `b1d4fc48`, `order_name` `UAT-*`)
- `LaundryPhotos`: `QK0H9DT1`, `a260b2b1`, `1b7649ba` · `AfterPhoto` tab `after`: `0aacd052`
