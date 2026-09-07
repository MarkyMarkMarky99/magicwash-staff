# Project memory
Live note — what is in flight, next, stuck. Rules: `.claude/.rules/memory.md`, read before writing.

## Where we are — 2026-09-08

- Gallery still legacy on purpose: binary to Firebase, photo list read from GViz in the browser.
  **Next migration step** — `OrderGalleryPage.vue:84` → `apiGetList`, rename `image_url` →
  `imageUrl` in the template, delete `src/api/photos.js`. ~1h, needs a browser check.
- `src/composables/usePhotoUpload.js` belongs in `src/features/gallery/composables/`. Not moved;
  placement of the legacy photo-capture set is an open decision (`overview.md:176`).
- Known gap, reported not fixed: GET responses pass GViz `Date(...)` through unnormalized on the
  photo modules (and OrderImages), against `docs/conventions/datetime.md`. Not on a live UI path
  while the gallery still reads GViz directly.

- **Branches:** `main` (synced, deployed) · `fix/gviz-date-literal-filter` (2 commits, **unpushed**)
  · `feat/live-order-helper` (pushed, unmerged, **not finished** — kept on purpose). Single worktree.

### `fix/gviz-date-literal-filter` — in flight

- Backend fix committed and verified live: GViz equality filters on native date cells now emit a
  typed literal. `?appointmentDate=` works (was silently 0 rows). 97/97 dry tests, typecheck clean.
- **Not pushed. Not merged.** Nothing deployed yet.
- **Phase 2 committed, unverified in a browser.** `appointment.store.ts` now sends
  `appointmentDate` and makes ONE request instead of five. Store test added (none existed).
  **Open `#/appointments` on a phone before pushing** — Chrome will not launch from a session here.
- Pre-existing web dry-test failures, NOT from this branch: `customer-package-create-page`,
  `package-pages`. Both fail on `main` too.

- **Never dispatch `backend-team` or any pipeline unless the user names it.** No default
  code-writing assistant. Pipeline is mason → clerk → sentinel.

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
3. `#/price-list`: search → ⚙ → `ซักแห้ง` → type nonsense. **Service buttons must remain**
   (default-slot panel vanishes exactly when the filter matches nothing).
4. `#/appointments` and customer detail — must show **no** magnifier at all.
5. Theme sweep: green ink instead of near-black, Noto Sans Thai everywhere.
6. Order detail → scroll so a dropdown trigger sits near the bottom edge, then open it. The
   panel must flip **above** and show every row.
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

## Page-load latency — measured 2026-09-08, ranked

One GViz read is ~2.1s whatever the row count. Cost = NUMBER of reads, not payload.

1. `App.vue:8` runs `loadInitial()` on **every** page mount; appointments page-walks 5 sequential
   reads = **10.7s**. Phase 2 above cuts it to 1. Biggest win in the app.
2. `work-orders`: order read, then a full Customers-sheet read, sequential
   (`work-order.service.ts:189`, `where: {}` when >1 customer).
3. `invoices` + `dateFrom`/`dateTo` drops pagination, reads every matching row
   (`invoice.service.ts:631`). Now properly fixable — the date filter works.
4. No store cache on invoices / customer-packages / orders → refetch every visit.
   customers + price-list cache (`loaded` flag) and are instant after first load.
5. No HTTP cache headers on `/api/*`.

## Deferred by the user

- **Pagination, app-wide.** Responses omit real `total`/`totalPages`; invoices and
  customer-packages strand rows past 20. Fix `okPaged` first, then add the two pagers.
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
- `OrderForm`: `246fde2b`, `cc4d375e`, `f68ae08d` — all customer `b1d4fc48`, `order_name` `UAT-*`
- `LaundryPhotos`: `QK0H9DT1` (`created_by: claude-uat`) · `a260b2b1`, `1b7649ba`
  (`order_id: CLAUDE-PROBE-ORDER`, from the 2026-09-07 live append probe)
- `AfterPhoto` tab `after`: `0aacd052` (`order_id: CLAUDE-PROBE-AFT`, same probe)

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
