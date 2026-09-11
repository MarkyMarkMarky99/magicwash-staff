# Project memory
Live note — what is in flight, next, stuck.

**Start here after a `/clear`:** `.user/memory/HANDOFF-2026-09-12.md` — what shipped, what is
blocked and why, and how to reach the full session transcript with grok-explorer.

## Gallery reads on the API — merged 2026-09-12 (`4cd603b`)

Order detail latency is browser-confirmed by the user and closed.

- **Accepted limit:** photo `perPage` caps at 500; largest album seen is 8.
- Not addressed: `OrderGalleryPage.vue` `onDeactivated` wipes `requestedKey`, forcing a refetch on
  re-entry, and `loadFetchedPhotos` blanks the list before awaiting. Cache answers it; still waste.
- Stale on the gallery read path: `feature-structure.md`, `data-fetching.md`,
  `docs/features/orders/overview.md`, `docs/features/orders/forms/create-order-image.md`.
- Session transcript `2026-09-11-003747-*.txt` sits untracked in the repo root; delete it.
- Then: `onFresh` at the remaining call sites, app-wide cache policy.
- **Decided against 2026-09-11:** lazy-loading the gallery route to drop Firebase from boot. Staff
  open the gallery on nearly every order. Do not re-propose.

## Comment cleanup — merged 2026-09-12 (`2e7de90`)

- **140 decisions and 13 uncovered defects: `.user/memory/doc-comment-docs-work.md`.** Verify every
  row before acting; two were already wrong.
- **Deferred, not blocked:** 58 ALREADY-DOCUMENTED deletions cite `data-fetching.md` or
  `cache-gateway.md`. Neither is an authority now that the drafts moved to `agent-docs/`, so those
  rows are undecidable until a real cache convention is written. Do not touch them.
- Also deferred: MOVE 23 (doc writing), UNVERIFIED 13 and the 13 defects (investigation).
- **Round 2 done 2026-09-12:** gallery template banners, the `unknownCreateOutcome` JSDoc and every
  KEEP row are cleared. What remains in that file is the three deferred groups above.

## GViz read normalization — DEFERRED, do not start

> "ผมยังไม่อยากแก้ไขโครงสร้างระดับนั้นเพราะมันจะส่งผลกระทบต่อทุกจุดแล้วเราก็ไม่รู้ว่าทุกจุดที่เรียกใช้สะอาดแค่ไหน
> ผมกังวลว่ามันจะส่งผลกระทบต่อหลายคอลัมน์เดิมที่แสดงผลอยู่ตอนนี้ อ่านแนวคิดของคุณผมคิดว่ามันถูกต้องนะแต่ยังไม่ใช่ตอนนี้"
> — 2026-09-11

- Full proposal and traps: `.user/memory/gviz-read-normalization.md`. Direction agreed, timing not.
- Do not re-propose it as a next step, and do not delete the frontend compensating code as
  "redundant" — some of it is the only thing stopping a runtime throw.
- Separable and still worth doing alone: the invoice `dateFrom`/`dateTo` filter compares
  `Date(...)` against ISO lexicographically (`invoice.service.ts:631`).

## Two unfinished drafts — moved out of `docs/` 2026-09-12

- `app-boot.md` and `data-fetching.md` now live under `agent-docs/`, not `docs/`. They were written
  by an agent session, merged in `d9e34bc` without the owner reading them, and are unfinished work
  that is **not scheduled on any current branch**.
- `agent-docs/` is not canonical. Nothing there may be cited as the authority for deleting a source
  comment or for any rule.
- One statement in `app-boot.md` was already wrong (it claimed the appointment query schema accepts
  `dateFrom`/`dateTo`; it has no date-range field). Corrected 2026-09-12.
- `CLAUDE.md` no longer indexes either; `docs/plans/cache-gateway.md` no longer claims the live
  cache rules exist. There is no canonical cache convention yet.

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
- **Customers sheet has one all-null row** (1 of 466), blank in every picker: delete it, or filter
  rows with no `customerId`.
- **Live Orders sheet data is dirty** — 1,074 phantom rows, mixed spellings and timestamp formats.
- **`LaundryPhotos` row order is not chronological** — new rows land ~row 20,869. Sort by timestamp.
- **Other modules still page-walk** (`order by <non-unique column>` + limit/offset, can drop rows).

## Open items

- **Issue screenshot upload, from the #17 review, none blocking:** hidden file input needs
  `sr-only` not `display:none`; busy overlay needs `aria-live`; a failed upload still lets ส่ง
  through silently; raw English Firebase errors reach staff. Abandoned picks orphan Storage
  objects — inherent, no cheap fix.
- **`naming.md` says `usePascalCase.ts` for composables; the codebase is kebab-case** (9 of 19 in
  `src/`). Fix the doc, not the files.
- **API authentication before launch.** Actor is a fallback constant in `src/shared/config/actor.ts`
  + `server/shared/config/actor.ts`; `?by=` must keep overriding. Issue reports asking a human to
  type their name folds into this pass.
- Invoice `CANCELLED` vs `VOID` — decide, then the contract
  (`docs/plans/invoice-contract-merge-and-status-update.md`). Nested invoice/items update is
  blocked until delete or soft-delete exists.
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
