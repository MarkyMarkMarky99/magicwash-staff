# Project memory
Live note — what is in flight, next, stuck. Rules: `.claude/.rules/memory.md`, read before writing.

## Queue — 2026-09-08, in order

1. **Browser-check the localStorage layer** on `feat/cache-persistence` (below), then merge.
2. **Raise the first TTLs** (`/api/price-list`, `/api/customers`) — the only step that changes
   observable behaviour. Only after 1.
3. **Backfill `Cache-Control` on existing photos.** Script writable now, **not runnable** until the
   user supplies Firebase bucket credentials.
4. **Decide the document scanner's 2400px / q0.88 output.** 3× the camera path's file size. Needs
   the user's eyes on real scans; not a number to lower blindly.

## Where we are — 2026-09-08

- **Branches:** `main` (cache invalidation merged + deployed 2026-09-08, phone-verified) ·
  `feat/cache-persistence` (below) · `feat/live-order-helper` (pushed, unmerged, **not finished**) ·
  `fix/customer-picker-filter` (shallowRef + null-name guard, browser-verified, unmerged).
- **API read cache is inert on purpose** — every TTL is 0, so traffic is unchanged; a cached copy
  only paints first. Writes call `invalidate()`, sidebar has "รีเฟรชข้อมูล". `docs/plans/cache-gateway.md`.
  `/api/orders` is never invalidated on purpose — `OrdersView` is a materialized view this project
  does not write; it belongs to `feat/live-order-helper`.
- **`feat/cache-persistence` — localStorage layer built, NOT browser-checked.**
  `src/shared/api/persistent-cache.ts`; only `/api/customers` + `/api/price-list` persist, 2 MB cap,
  versioned keys, namespaced clear. Typecheck + 3 dry tests pass. On a phone: reload a customer list
  and it should paint instantly; the issue-report reporter name must still survive รีเฟรชข้อมูล.
- Pre-existing web dry-test failures on an unmodified tree: `customer-package-create-page`,
  `package-pages`. Unrelated to recent work; decide which side is right.
- Gallery still legacy on purpose: binary to Firebase, list read from GViz in the browser.
  **Next step** — `OrderGalleryPage.vue:84` → `apiGetList`, rename `image_url` → `imageUrl`, delete
  `src/api/photos.js`. ~1h, needs a browser check.
- `src/composables/usePhotoUpload.js` belongs in `src/features/gallery/composables/`; placement of
  the legacy photo-capture set is open (`overview.md:176`).
- Known gap, not on a live UI path yet: photo modules and OrderImages pass GViz `Date(...)` through
  unnormalized, against `docs/conventions/datetime.md`.
- **Old photos still carry `Cache-Control: private, max-age=0`** (~0.36s revalidation per repeat
  view); only uploads after 2026-09-08 get the immutable header. Backfill over bucket
  `magicwashlaundry-a50ca.firebasestorage.app` is blocked on credentials — `GOOGLE_SERVICE_ACCOUNT_KEY`
  is Sheets-only, nothing in `server/` or `api/` touches Storage. `docs/plans/image-pipeline.md`.
- **Disproven, do not act on the old note:** list pages do NOT refetch on revisit; the slowness is
  the FIRST load, and a per-store `loaded` flag buys nothing. `docs/plans/cache-gateway.md`.

## Workers

- **Never dispatch `backend-team` or any pipeline unless the user names it.**
- Codex quota runs out; when it does, dispatch a general-purpose sonnet agent with the same brief.
- Chrome **cannot be launched from a Claude session on this machine** (`0xC0000003`, real Chrome and
  Playwright chromium alike). Browser proof goes to the user's phone.
- Solo codex briefs must forbid subagents in the first lines, redirect to a log file, never `tail`.

## Browser checks still pending on `main`

1. Search on `#/price-list` (client filter) and `#/invoices` (store fetch); `✕` clears.
2. Deep link `#/invoices?keyword=INV` — box must open by itself with the word in it.
3. `#/price-list`: search → ⚙ → `ซักแห้ง` → type nonsense. **Service buttons must remain.**
4. `#/appointments` and customer detail — must show **no** magnifier at all.
5. Theme sweep: green ink, Noto Sans Thai everywhere.
6. Order detail → dropdown near the bottom edge must flip **above**, all rows visible.
7. Order create → customer picker: scroll options, no scrollbar should appear; merged overlay
   sheet: drag-to-close, scroll, Back, edge-swipe.

## Photos — settled, do not re-litigate

- `OrderImages` (`/api/order-images`) and `LaundryPhotos` + `AfterPhoto` (`/gallery/:key`) are **two
  systems on purpose**. An earlier merge proposal was rejected.
- **Live bug, unfixed:** gallery learns `created_by` only from `?by=`; frontend falls back to
  `admin`, the only validator fails silently. Re-check — the Apps Script gateway is now gone.

## Price list — next

1. Fill real prices for the 33 rows at placeholder `price 0` (all `active: false`).
2. **Add-price-to-existing-item is buried:** `+` always opens "new item". A `BaseSwipeCard` action
   passing `itemCode` is designed, not built.

Verified 2026-09-06, do not re-check: live sheet = G Drive registry = `PriceList.db-contract.ts`.
Reported, not fixed:
- `InvoiceItems.service_type` written `null` always — service survives only in the description.
- No `active` filter on the price-list query; picker fetches everything, filters client-side.

## Orders backend

- Two lanes on purpose: `orders` reads browse-only `OrdersView`; `work-orders` / `order-items` /
  `order-images` write live sheets in `ORDERS_SPREADSHEET_ID`. Never read one lane and write the
  other. Design: `docs/plans/orders-backend.md`.
- Absent on purpose: `OrderItems` catalogue, package-credit consumption, nested `invoice_item_id`
  writes, server-side binary upload, retiring the frontend fixtures.

## Page-load latency — next, ranked

Measured 2026-09-08. **Never optimise from local numbers** (`vercel dev` adds ~0.9s/request):
GViz direct 0.49s · **prod warm 0.82s** · prod cold 1.65s · local 1.71s. Our prod overhead ~0.33s is
fine — the work left is **fewer reads**, not faster ones.

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
- **Live Orders sheet data is dirty** — do not normalize incidentally (1,074 phantom
  `OrderItemForms` rows, mixed spellings, mixed timestamp formats).
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
- Confirm `CUSTOMERS_SPREADSHEET_ID` is set in every Vercel environment.
- Delete leftover `C:\MagicwashGemini\webapp-vue-frontend` (~34 MB, dead worktree, needs a restart).

## Test data to remove by hand (`SheetRepository.delete()` throws)

- `Packages`: `ZZTEST01` · customer package `af9f0651` (พิมพ์นิดา)
- `OrderForm`: `246fde2b`, `cc4d375e`, `f68ae08d` (customer `b1d4fc48`, `order_name` `UAT-*`)
- `LaundryPhotos`: `QK0H9DT1`, `a260b2b1`, `1b7649ba` · `AfterPhoto` tab `after`: `0aacd052`

## Environment

- Dev server on **3000** (`vercel dev` fronting Vite on 3102). Check what is listening first.
- Pushing `main` deploys production. Deliberate act.
- `/` returns 500 while `/api/*` stays 200 → an **orphaned Vite from an earlier session holds 3102**.
  Kill both PIDs and restart; check process start times to spot it. Do not debug the app.
