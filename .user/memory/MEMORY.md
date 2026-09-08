# Project memory
Live note — what is in flight, next, stuck. Rules: `.claude/.rules/memory.md`, read before writing.

## Queue — 2026-09-08, in order

1. **Verify `feat/cache-invalidation` on a phone** (3 checks, preview URL below). Blocked on the
   user. Nothing else in the cache work should merge past it.
2. **localStorage layer** for the response cache — step 4 of `docs/plans/cache-gateway.md`. Ready to
   start; today a page reload empties the cache.
3. **Raise the first TTLs** (`/api/price-list`, `/api/customers`). Only after 1 and 2.
4. **Backfill `Cache-Control` on existing photos.** Script is writable now, **not runnable** until
   the user supplies credentials for the Firebase bucket.
5. **Decide the document scanner's 2400px / q0.88 output.** Three times the camera path's file size.
   Needs the user's eyes on real scans; not a number to lower blindly.

## Where we are — 2026-09-08

- Gallery still legacy on purpose: binary to Firebase, photo list read from GViz in the browser.
  **Next migration step** — `OrderGalleryPage.vue:84` → `apiGetList`, rename `image_url` →
  `imageUrl` in the template, delete `src/api/photos.js`. ~1h, needs a browser check.
- `src/composables/usePhotoUpload.js` belongs in `src/features/gallery/composables/`; placement of
  the legacy photo-capture set is an open decision (`overview.md:176`).
- Known gap, not fixed: photo modules and OrderImages pass GViz `Date(...)` through unnormalized,
  against `docs/conventions/datetime.md`. Not on a live UI path yet.

- **Branches:** `main` (synced, deployed 2026-09-08 — date filter + one-request appointments live
  and verified) · `feat/live-order-helper` (pushed, unmerged, **not finished**) ·
  `fix/customer-picker-filter` (shallowRef + null-name guard, browser-verified, unmerged).
  Single worktree.
- Pre-existing web dry-test failures, unrelated to any recent work: `customer-package-create-page`,
  `package-pages`. Both fail on an unmodified tree — decide which side is right.

- **Disproven 2026-09-08 — do not act on the old note:** invoices / customer-packages / orders do
  NOT refetch on revisit. `App.vue:17-21` keeps every route component except nine form pages, and
  those pages fetch from `watch(..., {immediate:true})` with no `onActivated`, so returning with the
  same query issues no request. The slowness is the FIRST load, not a repeat one. A per-store
  `loaded` flag would have bought nothing.
- **No frontend cache has a TTL or eviction anywhere**, but nothing accumulates either: all eleven
  caching stores hold one slot and overwrite it (new customer replaces the old customer's arrays,
  new date replaces `dailyItems`, new order replaces its images). A URL-keyed central gateway would
  be the first thing that can actually grow without bound — it needs TTL, a size cap and a
  write-invalidation rule from day one.

- **`feat/cache-invalidation` — pushed, NOT merged, NOT opened in a browser yet.** Commit `c3b493e`.
  All 14 write services call `invalidate()` on success; the nav sidebar has a bottom-pinned
  "รีเฟรชข้อมูล" action that clears everything and reloads. `typecheck:web` and three dry tests pass.
  **Three checks are outstanding on a real phone** — preview
  `https://magicwash-staff-ogtyrmi0q-magicwashth-8243s-projects.vercel.app`:
  1. the refresh button reloads and data still loads;
  2. the issue-report reporter name in `localStorage` SURVIVES it (the button must never call
     `localStorage.clear()`);
  3. writing still works — 14 functions changed from `return apiPost(...)` to `await` then return,
     so a slip breaks saving. Try a price edit, an appointment, and an order item.
  Nothing observable changes until a TTL is raised, so the branch is safe to sit.
- **API read cache — built, deliberately inert.** Merged to main 2026-09-08, verified on a real
  Android device (all lists and details load, switching customers keeps data separate, search and
  photo upload unaffected):
  `src/shared/config/cache.ts` (policy), `src/shared/api/response-cache.ts` (RAM + LRU +
  `invalidate()`), wired into `apiGet`/`apiGetList` with in-flight de-duplication. **Every TTL is 0
  on purpose** — same network traffic as before, the only change is that a cached copy paints
  first. Design and build order: `docs/plans/cache-gateway.md`.
  Both prerequisites for raising a TTL are now BUILT on `feat/cache-invalidation` (writes call
  `invalidate()`, and the sidebar has a refresh control) but neither is browser-verified.
  Still not built: the localStorage layer (step 4 of the plan doc), so a page reload empties the
  cache and `PERSIST_ENDPOINTS` in `src/shared/config/cache.ts` is inert.
  **Order of remaining work:** verify the branch on a phone → merge → step 4 → only then raise a
  TTL, starting with `/api/price-list` and `/api/customers`.
  `/api/orders` is deliberately never invalidated: it reads `OrdersView`, a materialized view this
  project does not write, and that belongs to `feat/live-order-helper`.
- **Never bind a search input with `v-model`.** It swallows keystrokes while an IME composition is
  open, so Thai typing on Android filters nothing until Enter. All five search inputs now use
  `:value` + `@input`. Only a real Android device reproduces it.
- **Old photos still carry `Cache-Control: private, max-age=0`** and pay a ~0.36s revalidation round
  trip on every repeat view. Only uploads made after 2026-09-08 get the immutable header. Fixing the
  existing objects needs a one-off metadata backfill over bucket
  `magicwashlaundry-a50ca.firebasestorage.app` — **blocked on credentials**: `GOOGLE_SERVICE_ACCOUNT_KEY`
  is for Sheets only, and neither `server/` nor `api/` touches Storage at all. The script can be
  written any time; it cannot be run until the user supplies bucket access. Detail:
  `docs/plans/image-pipeline.md`.
- **Image uploads are now one module** — `src/shared/api/firebase-storage.ts`; `src/api/storage.js`
  and `order-image-storage.service.ts` deleted. Measured state, the closed door on URL resizing, and
  what is left (metadata backfill, scanner resolution, thumbnails) live in
  `docs/plans/image-pipeline.md`.
- **Cache gateway is designed, not built** — handoff for a fresh session is
  `docs/plans/cache-gateway.md`. Read-only scope, explicit `invalidate()`, no changes to writes.

- **Never dispatch `backend-team` or any pipeline unless the user names it.**

## Workers

- Codex quota runs out; when it does, dispatch a general-purpose sonnet agent with the same brief.
- Chrome **cannot be launched from a Claude session on this machine** (`0xC0000003`, real
  Chrome and Playwright's chromium alike). Browser proof goes to the user's phone.
- Solo codex briefs must forbid subagents in the first lines, redirect to a log file, and
  never pipe through `tail`.

## Browser checks still pending on `main`

Nothing below has been opened in a browser. `typecheck:web` passes green on layout bugs.

1. Search on `#/price-list` (client filter) and `#/invoices` (store fetch); `✕` clears.
2. Deep link `#/invoices?keyword=INV` — the box must open by itself with the word in it.
3. `#/price-list`: search → ⚙ → `ซักแห้ง` → type nonsense. **Service buttons must remain.**
4. `#/appointments` and customer detail — must show **no** magnifier at all.
5. Theme sweep: green ink, Noto Sans Thai everywhere.
6. Order detail → open a dropdown near the bottom edge: it must flip **above**, all rows visible.
7. Order create → customer picker: scroll the options, no scrollbar should appear.

## Photos — settled, do not re-litigate

- `OrderImages` (weight/belonging/document, `/api/order-images`) and `LaundryPhotos` +
  `AfterPhoto` (garment before/after, `/gallery/:key`, Apps Script) are **two systems on
  purpose**. An earlier note proposed merging them; rejected.
- **Live bug, unfixed:** the gallery learns `created_by` only from `?by=`; frontend falls back to
  `admin` and the only validator fails silently. Re-check — the Apps Script gateway is now gone.

## Price list — next

1. Fill real prices for the 33 rows at placeholder `price 0` (all `active: false`).
2. **Add-price-to-an-existing-item is buried.** `+` always opens "new item". A card action
   (`BaseSwipeCard` supports one) would pass `itemCode` through. Designed, not built.

Verified 2026-09-06, do not re-check: live sheet = G Drive registry = `PriceList.db-contract.ts`,
16 columns, enum `WSIR|IRON|DRCL|WASH`; `PRICE_LIST_SPREADSHEET_ID` set in all three Vercel
environments; sheet shared with the staff-writer service account as Editor.

Reported, not fixed:
- `InvoiceItems.service_type` is written `null` unconditionally — a line's service survives only
  inside the description string.
- No `active` filter on the price-list query; the picker fetches everything and filters client-side.

## Orders backend

- Two lanes on purpose: `orders` reads browse-only `OrdersView` in the portal workbook;
  `work-orders` / `order-items` / `order-images` write live staff sheets in
  `ORDERS_SPREADSHEET_ID`. Never read one lane and write the other. Design: `docs/plans/orders-backend.md`.
- Absent on purpose: `OrderItems` catalogue, package-credit consumption, nested
  `invoice_item_id` writes, server-side binary upload, retiring the frontend fixtures.

## Page-load latency — next, ranked

Measured 2026-09-08. **Never optimise from local numbers**: `vercel dev` adds ~0.9s per request.

| | one read |
|---|---|
| GViz direct | 0.49s |
| **production warm** | **0.82s** |
| production cold | 1.65s |
| local `vercel dev` | 1.71s |

Our own overhead in prod is ~0.33s, which is fine. The work left is **fewer reads**, not faster
ones. Appointments' 5-read walk is already fixed and merged.

1. **`work-orders` reads the whole Customers sheet on every order-list load.**
   `work-order.service.ts:101-107` awaits the order read, then `readCustomerNames`; `:195` uses
   `where: {}` whenever the page holds >1 distinct customer, which a real list always does. The two
   reads are genuinely dependent — `Promise.all` cannot fix the list; the second read has to get
   cheaper or disappear. Three options: add `whereIn()` to `gviz-query.builder.ts` (`:85-98` only
   emits `col = value`, no IN); or drop `customerName` from the list response and map it on the
   client from the customer store; or cache customers server-side.
2. **Order detail runs three sequential reads** (`work-order.service.ts:122-133`): order →
   customer → order items. The items read needs only `id`, so it can run parallel with the order
   read. ~20min, the cheapest real win left.
3. **`listOrdersByCustomer` sends no `perPage`**, so the customer detail page pulls up to 500 rows
   — measured 104 KB for a single customer (`src/features/customers/services/order.service.ts:11`,
   `MAX_ORDERS_PER_PAGE` 500). Not urgent; it is one request, but a heavy one on mobile.
4. **`invoices` + `dateFrom`/`dateTo` drops pagination** and reads every matching row
   (`invoice.service.ts:631`). Needs `>=`/`<=` in `GVizQueryBuilder` — a feature, not a bug fix,
   and only now possible because typed date literals work. ~3h.
4. **`App.vue:8` prefetches appointments on every page mount**, including pages that never show
   them. Scope it to the routes that need it plus the pending badge. ~1h.
5. **No HTTP cache headers on `/api/*`** (`vercel.json` only covers `/scanic-ml/*`). Decide
   staleness first; do not start here.

Also unmeasured: whether prod cold starts are frequent enough to matter (1.65s vs 0.82s).

## Deferred by the user

- **Pagination, app-wide.** Responses omit real `total`/`totalPages`; invoices and
  customer-packages strand rows past 20. Fix `okPaged` first, then add the two pagers.
- **The Customers sheet has one all-null row** (1 of 466; every field `null`). It reaches the API
  as a real row and shows up as a blank entry in every customer picker. Left alone deliberately —
  decide between deleting the sheet row and filtering rows without a `customerId` in code.
- **Live Orders sheet data is dirty.** Do not normalize it incidentally: 1,074 phantom
  `OrderItemForms` rows, mixed spellings/languages, mixed timestamp formats.
- **`LaundryPhotos` row order is not chronological.** New rows land mid-sheet (~row 20,869), the
  physical last row is months old. Sort by timestamp; never trust the bottom of the sheet.
- **Other modules still page-walk** (`order by <non-unique column>` + `limit/offset`, can drop
  rows). Orders and OrderItems will hit it.

## Open items

- **API authentication before launch.** Actor is a fallback constant in
  `src/shared/config/actor.ts` + `server/shared/config/actor.ts`; `?by=` must keep overriding.
- Issue reports still ask a human to type their name, on purpose — fold into the auth pass.
- Invoice `CANCELLED` vs `VOID` — decide the distinction, then the contract. UI deferred; see
  `docs/plans/invoice-contract-merge-and-status-update.md`.
- Nested invoice/items update blocked until delete or soft-delete exists.
- Remove schema-file `z.infer` exports in one dedicated all-contract pass.
- Consolidate datetime helpers separately — `SheetRepository` is shared by every module.
- Stage 4 overlays still local-state: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`,
  `NavSidebar.vue`; nested `<button>` near :255.
- `customer-packages` **create form** still diverges from `docs/design/patterns/forms.md`.
- Docs still describe the deleted header search (`SEARCHABLE_ROUTES`, `meta.searchable`);
  `list-pages.md` needs the ListContainer search instead.
- Confirm `CUSTOMERS_SPREADSHEET_ID` is set in every Vercel environment.
- Test the merged overlay sheet on a real phone: drag-to-close, scroll, Back, edge-swipe.
- Delete leftover `C:\MagicwashGemini\webapp-vue-frontend` (~34 MB, dead worktree, needs a restart).

## Test data to remove by hand (`SheetRepository.delete()` throws)

- `Packages`: `ZZTEST01` · customer package `af9f0651` (พิมพ์นิดา)
- `OrderForm`: `246fde2b`, `cc4d375e`, `f68ae08d` (customer `b1d4fc48`, `order_name` `UAT-*`)
- `LaundryPhotos`: `QK0H9DT1`, `a260b2b1`, `1b7649ba` · `AfterPhoto` tab `after`: `0aacd052`

## Environment

- Dev server on **3000** (`vercel dev` fronting Vite on 3102). Check what is listening first.
- Pushing `main` deploys production. Deliberate act.
- `/` returns 500 `FUNCTION_INVOCATION_FAILED` while `/api/*` stays 200 → an **orphaned Vite from an
  earlier session still holds 3102**, so vercel dev proxies a child it does not own. Kill both PIDs
  and restart. Do not debug the app; check process start times to spot it.

## Project rules — pointers only

- `CLAUDE.md` — frontend architecture, navigation, testing, working rules.
- `docs/design/patterns/list-pages.md` — required pattern for root collection pages, incl. the
  `ListContainer` search rules and the `#empty`/`#error` slot trap.
