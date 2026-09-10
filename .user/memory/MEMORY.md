# Project memory
Live note — what is in flight, next, stuck.

## Branch `perf/app-fetch-cache` — 2026-09-11

Uncommitted. `typecheck:api`+`typecheck:web` and the work-order/order-item dry tests pass.
**No browser check yet.**

- Order detail reads parallelized (`work-order.service.ts:122`).
- Detail header seeded from the loaded list row (`order.store.ts:49`); full-page skeleton now only
  when the list never loaded that order. New `tests/web/unit/features/orders/stores/order.store.dry-test.ts`.
- Untracked, user has not read them: `docs/architecture/frontend/app-boot.md`,
  `docs/conventions/data-fetching.md` — drafts from the 2026-09-11 session.
- Remove the session transcript `2026-09-11-003747-*.txt` from the repo root before committing.

### Tomorrow morning, in order

1. Browser check the two changes: list → order must paint the header before the item list, and
   adding an item must not flash the list back to empty. Then commit.
2. **Gallery reads have no cache at all.** `src/api/photos.js:26` goes through raw JSONP
   (`src/utils/gviz.js:33`), never `apiGet`, and `tqx=reqId:N` makes every URL unique so the browser
   cannot cache it either. Cheap fix: `OrderGalleryPage.vue:112` `onDeactivated` wipes
   `requestedKey` and forces a refetch although KeepAlive still holds the photos; `:76` blanks them
   before the await. Real fix: move the read behind `apiGet` — do it as part of the gallery
   migration below.
3. **Gallery migration** — `OrderGalleryPage.vue:84` → `apiGetList`, `image_url` → `imageUrl`,
   delete `src/api/photos.js`. ~1h, needs a browser check.
4. Then the structural pass: `onFresh` (23 call sites), app-wide cache policy.

- **Decided against 2026-09-11:** lazy-loading the gallery route to drop Firebase from boot. Staff
  open the gallery on nearly every order, so it buys nothing. Do not re-propose.

## Queue — 2026-09-09, in order

1. **Backfill `Cache-Control` on existing photos.** Script writable now, **not runnable** until the
   user supplies Firebase bucket credentials.
2. **Decide the document scanner's 2400px / q0.88 output.** 3× the camera path's file size. Needs
   the user's eyes on real scans; not a number to lower blindly.

## Layout rebuild — merged and device-verified 2026-09-10

- Delete `scroll-region.md` and `overlay-frame.md` from `docs/plans/` once nothing references them.
- **Debt, in `overlay-frame.md`:** give `BaseOverlayFrame` a full-bleed size, then drop
  `LightboxOverlay`'s five `!important` padding overrides.

## Where we are — 2026-09-10

- **Branch:** `feat/live-order-helper` — pushed, unmerged, not finished, and now far behind `main`.
  Diff it against `origin/main` before assuming any of it is still wanted.
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
6. Order detail → dropdown near the bottom edge must flip **above**, all rows visible. Its panel is
   a `ScrollRegion` now, so recheck after the overlay migration.

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
2. **`listOrdersByCustomer` sends no `perPage`** — up to 500 rows, 104 KB measured for one customer
   (`src/features/customers/services/order.service.ts:11`).
3. **`invoices` + `dateFrom`/`dateTo` drops pagination** (`invoice.service.ts:631`). Needs `>=`/`<=`
   in `GVizQueryBuilder`. ~3h.
4. **`App.vue:8` prefetches appointments on every page mount.** Scope to routes that need it plus
   the pending badge. ~1h.
5. **No HTTP cache headers on `/api/*`** (`vercel.json` covers only `/scanic-ml/*`). Decide
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
