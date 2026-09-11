# Project memory
Live note — what is in flight, next, stuck.

## Gallery reads on the API — merged to main 2026-09-12

`4cd603b`. Order detail latency work is browser-confirmed by the user and closed.

- **Known limit, accepted:** photo `perPage` caps at 500; largest album seen is 8.
- Not addressed: `OrderGalleryPage.vue` `onDeactivated` wipes `requestedKey` and forces a refetch
  on re-entry; `loadFetchedPhotos` blanks the list before awaiting. The cache answers it now, but
  the round trip is still needless.
- Ten section-banner comments in `OrderGalleryPage.vue` were skipped to avoid a conflict with this
  branch; it is gone now, so they can be done.
- Stale on the gallery read path, still not corrected: `feature-structure.md`, `data-fetching.md`,
  `docs/features/orders/overview.md`, `docs/features/orders/forms/create-order-image.md`.
- Session transcript `2026-09-11-003747-*.txt` sits untracked in the repo root; delete it.
- Then: `onFresh` at the remaining call sites, app-wide cache policy.
- **Decided against 2026-09-11:** lazy-loading the gallery route to drop Firebase from boot. Staff
  open the gallery on nearly every order. Do not re-propose.

## Branch `chore/remove-stale-code-comments` — in flight, not merged

Six commits. 271 comment lines deleted across the frontend, zero lines added.

- **Red test, decision pending:** `customer-package.service.dry-test.ts:48-53` asserts
  `createCustomerPackage` holds a literal per response kind. Five existed only inside a deleted
  comment — the function parses the union by schema and names no kind — and `:155-166` already
  tests every kind behaviourally. Delete the loops, retarget them at the contract schema, or
  restore the comment.
- `.user/memory/doc-comment-docs-work.md` holds the remaining 140 decisions. Do not act on a row
  without checking it — one row was already wrong.
- Blocked on the user reading `data-fetching.md`: 58 deletions justified by pointing at it or at
  `cache-gateway.md`, which is build history, not a rule.
- `app-boot.md` is edited on this branch and on main; expect a conflict on merge.

## GViz read normalization — DEFERRED, do not start

> "ผมยังไม่อยากแก้ไขโครงสร้างระดับนั้นเพราะมันจะส่งผลกระทบต่อทุกจุดแล้วเราก็ไม่รู้ว่าทุกจุดที่เรียกใช้สะอาดแค่ไหน
> ผมกังวลว่ามันจะส่งผลกระทบต่อหลายคอลัมน์เดิมที่แสดงผลอยู่ตอนนี้ อ่านแนวคิดของคุณผมคิดว่ามันถูกต้องนะแต่ยังไม่ใช่ตอนนี้"
> — 2026-09-11

- Full proposal and traps: `.user/memory/gviz-read-normalization.md`. Direction agreed, timing not.
- Do not re-propose it as a next step, and do not delete the frontend compensating code as
  "redundant" — some of it is the only thing stopping a runtime throw.
- Separable and still worth doing alone: the invoice `dateFrom`/`dateTo` filter compares
  `Date(...)` against ISO lexicographically (`invoice.service.ts:631`).

## Queue — 2026-09-09, in order

1. **Backfill `Cache-Control` on existing photos.** Script writable now, **not runnable** until the
   user supplies Firebase bucket credentials.
2. **Decide the document scanner's 2400px / q0.88 output.** 3× the camera path's file size. Needs
   the user's eyes on real scans; not a number to lower blindly.
3. **Add compression to the order image upload.** `order-image.store.ts:48` calls `uploadToStorage`
   with no `compressImage` — the only upload path with no size ceiling. Put `compressImage` in front
   of it, as `use-screenshot-upload.ts` and `usePhotoUpload.js:41` already do. Settle item 2 first:
   scanner output is what this bites, and ≤200 KB may be too aggressive for scans.

## Where we are — 2026-09-10

- Delete `scroll-region.md` and `overlay-frame.md` from `docs/plans/` once nothing references them;
  the debt they record is `BaseOverlayFrame` needing a full-bleed size so `LightboxOverlay` can drop
  five `!important` padding overrides.
- **On `main`, merged but unverified on a phone:** `BaseSwipeCard` ghost-click fix (ISS-72adcdca).
  Source-based dry test only; no device has confirmed it. Issue row is still `OPEN`.
- **Open cache gap:** `onFresh` is unwired. `docs/plans/cache-gateway.md`.
- Pre-existing web dry-test failures on an unmodified tree, unrelated to recent work — 6, re-checked
  2026-09-11: `package-pages`, `invoice-price-list-service`, `order-price-list.store`,
  `customer-package-create-page`, `price-list.store`, `price-list-service`.
- Gallery: move `src/composables/usePhotoUpload.js` to `src/features/gallery/composables/`; decide
  legacy photo-capture placement (`overview.md:176`).
- Known gap, not on a live UI path yet: photo modules and OrderImages pass GViz `Date(...)` through
  unnormalized, against `docs/conventions/datetime.md`.
- **Old-photo cache backfill blocked:** bucket credentials required for
  `magicwashlaundry-a50ca.firebasestorage.app`. `docs/plans/image-pipeline.md`.

## Browser checks still pending on `main`

0. **ISS-72adcdca:** cache-hit customer list, finger tap a row — only customer detail may open, no
   order sheet; a swiped card's panel button must still fire. Close the issue row once it passes.
1. ListContainer search: `#/price-list` and `#/invoices` filter and `✕` clears; deep link
   `#/invoices?keyword=INV` opens the box; `#/price-list` service buttons survive a nonsense query;
   `#/appointments` and customer detail show no magnifier at all.
2. Theme sweep: green ink, Noto Sans Thai everywhere.
3. Order detail → dropdown near the bottom edge must flip **above**, all rows visible.

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

Measured 2026-09-08: GViz 0.49s · prod warm 0.82s · prod cold 1.65s. Fewer reads beats smaller ones.

1. **`work-orders` reads the whole Customers sheet per order-list load** (`work-order.service.ts:195`
   uses `where: {}` above one customer). Dependent reads, so `Promise.all` cannot help. Add
   `whereIn()` to `gviz-query.builder.ts`, or drop `customerName` and map it client-side.
2. **`listOrdersByCustomer` sends no `perPage`** — 104 KB measured for one customer
   (`customers/services/order.service.ts:11`).
3. **`invoices` + `dateFrom`/`dateTo` drops pagination** (`invoice.service.ts:631`); needs `>=`/`<=`
   in `GVizQueryBuilder`. ~3h.
4. **`App.vue:8` prefetches appointments on every page mount.** ~1h.
5. **No HTTP cache headers on `/api/*`**; decide staleness first.

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

- **Issue screenshot upload, raised in review of #17, none blocking:** hidden file input is
  `display:none` so its `FormLabel` names nothing to a screen reader (use `sr-only`); upload-busy
  overlay has no `aria-live`; a failed upload still lets ส่ง through with no image and the Thai copy
  does not say so; raw English Firebase errors reach staff. Abandoned picks orphan Storage objects —
  inherent to uploading before submit, no cheap client-side fix.
- **`naming.md` says `usePascalCase.ts` for composables; the codebase is kebab-case** (9 of 19 in
  `src/`). Fix the doc, not the files.
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
