# Project memory
Live note — what is in flight, next, stuck. Rules: `.claude/.rules/memory.md`, read before writing.
## Where we are — 2026-09-06
- **Branches:** `main` (synced, pushed) · `feat/live-order-helper` (pushed, unmerged, kept on
  purpose). Nothing else exists. Single worktree.
- `feat/live-order-helper` holds `getLiveOrderById()` plus a read-only parity script that
  samples 50 orders and checks `OrdersView` against live `OrderForm` + `OrderItemForms`.
  Nothing calls it yet.
- **Pipeline is 3 roles:** mason → clerk (executable tests + gates + mutation proof) → sentinel.
  The test-first role was removed 2026-09-05: with no code to call it could only regex the
  source, producing guards that failed against correct code and guards that could not fail.
- **Never dispatch `backend-team` or any pipeline unless the user names it.** No default
  code-writing assistant.
## Active — feat/order-pricelist-picker
- User authorized autonomous implementation; latest instruction forbids subagents, root owns remaining work and browser UAT; no push.
- Resume plan/briefs: `.codex/tasks/order-pricelist-picker/`; Root finished integration fixes; browser staff UAT in progress; no subagents.
- Scope: active DEFAULT same-service pricelist selection -> quantity/note -> save; existing create/photo path.
- Existing source has live work-orders create/detail and Firebase + order-images camera; older notes below need live verification.
- Browser: CUA transport unavailable; Playwright installed Chrome works. Port 3000 is running; live data may take >10 seconds.
## Main — list pages browser checks pending
Merged and deployed 2026-09-06 (12 commits). Everything below passes build, `typecheck:api` and
the dry-tests, but **nothing has been opened in a browser yet.** There is no frontend type-check,
so a broken prop ships green. Check in this order, and only these:
1. Search on `#/price-list` (client filter) and `#/invoices` (store fetch) — magnifier in the
   list heading, input under it, typing filters, ✕ clears.
2. Deep link `#/invoices?keyword=INV` — the box must open by itself with the word in it.
3. `#/price-list`: open search → ⚙ at the right of that row → pick `ซักแห้ง` → type nonsense so
   nothing matches. **The service buttons must still be there.** ListContainer renders one slot
   at a time, so a panel placed only in the default slot disappears exactly when you need it.
4. `#/appointments` (4 lists on screen) and customer detail — must show **no** magnifier at all.
5. `#/orders` — its hand-built hero is gone; heading is now the ListContainer's.
6. Theme sweep: green ink instead of near-black, Noto Sans Thai everywhere.
7. Order detail → scroll so the "เพิ่มรูป" button sits near the bottom edge, then open it. The
   menu must flip **above** the trigger and show all three rows.
8. Order create → customer picker: scroll the options, no scrollbar should appear.
Not worth checking: the six ghost-button conversions are class-only.

Scrollbars were swept app-wide the same day: every scroller in `src/` is accounted for and
hidden. `.hide-scrollbar` was deleted — `.no-scrollbar` is the only name. `BaseDropdown` now
flips above its trigger when there is under 160px below, because its `maxHeight` is a 96px
**floor**, not a ceiling, and a clipped panel loses rows with no scroll and no hint.

## Price list — next

1. Fill real prices for the 33 rows at placeholder `price 0` (all `active: false`).
2. **Add-price-to-an-existing-item is still buried.** The `+` always opens "new item"; adding
   another service to a row you can see costs a mode switch and a re-search. An action on the
   card itself (BaseSwipeCard already supports one) would pass the `itemCode` straight through.
   Designed, not built.

Verified 2026-09-06, do not re-check: live sheet = G Drive registry = `PriceList.db-contract.ts`,
16 columns `id … active`, enum `WSIR|IRON|DRCL|WASH`. `PRICE_LIST_SPREADSHEET_ID` is set in all
three Vercel environments, and the sheet is shared with the staff-writer service account as Editor.

Reported, not fixed:

- `InvoiceItems.service_type` is written `null` unconditionally — a line's service survives
  only inside the description string.
- No `active` filter on the list query; the picker fetches everything and filters client-side.

## Photos — decide before building

Destination: one shared camera component for before/after/order images; backend uploads the
binary to Firebase and writes the URL to Sheets. Small steps, never one pass.

**Blocked on one decision, no branch yet:**

- (a) extend `OrderImages` with `orderitem_id` + before/after and merge both photo
  spreadsheets into it — needs a registry edit under `G:\My Drive\...\GoogleSheets\*.json`,
  **user-only**; or
- (b) add a separate `laundry-photos` module matching the sheets that already exist.

Why (a) is not just wiring:

- `OrderImages` has no `orderitem_id`; its column is `image_path`, the live sheet uses `image_url`.
- `OrderImages.image_type` means evidence kind (`BAG`, `WEIGHT`, `DOCUMENT`), not BEF/AFT.
- `LaundryPhotos.db-contract.ts` sets `writes.append: false` → `append()` throws.
- No route registered for `LaundryPhotos` or `AfterPhoto`; only `order-images`.

Live path today: `src/features/gallery/` — `getUserMedia`, client-side compression, browser
uploads straight to Firebase Storage via `src/firebase.js` (hardcoded config, no env vars),
then `src/api/photos.js` writes the URL through Apps Script, not this project's `api/`.
`server/` has no `firebase-admin` and no binary handling. BEF and AFT are two separate
spreadsheets: tabs `LaundryPhotos` and `AfterPhoto`.

## Orders backend — built, never executed

- Deploy and hit the three endpoints for real, especially `POST /api/work-orders`, the first
  append to `OrderForm`. Typecheck, dry tests, and `vercel dev` all miss this class of failure.
- Two lanes on purpose: `orders` reads browse-only `OrdersView` in the portal workbook;
  `work-orders` / `order-items` / `order-images` write live staff sheets in
  `ORDERS_SPREADSHEET_ID`. Never read one lane and write the other — they disagree until Apps
  Script syncs. Design: `docs/plans/orders-backend.md`.
- Deliberately absent: `OrderItems` catalogue, package-credit consumption, nested
  `invoice_item_id` writes, server-side binary upload, retiring the frontend fixtures.

## Deferred by the user

- **Pagination, app-wide.** Responses omit real `total`/`totalPages` while frontend types claim
  otherwise. Invoices and customer-packages strand rows past 20. Two passes: make `okPaged`
  count for real and drop invoices' fabricated total, then add pagers to those two modules.
- **Live Orders sheet data is dirty.** Do not normalize it incidentally. `OrderItemForms` holds
  1,074 phantom quantity-only rows; categorical columns mix spellings and languages;
  `OrderImages.image_path` and timestamps mix formats.
- **Other modules still page-walk** with `order by <non-unique column>` + `limit/offset` and can
  silently drop rows. Orders and OrderItems will actually hit it.

## Open items

- Add API authentication before launch.
- Pass actor identity into repository writes for an audit trail.
- Invoice `CANCELLED` vs `VOID` — decide the distinction, then the contract. UI deferred; see
  `docs/plans/invoice-contract-merge-and-status-update.md`.
- Nested invoice/items update blocked until delete or soft-delete exists.
- Remove schema-file `z.infer` exports in one dedicated all-contract pass.
- Consolidate datetime helpers separately — `SheetRepository` is shared by every module.
- Stage 4 overlays still local-state: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`,
  `NavSidebar.vue`. The gallery also mirrors `route.meta` into a `ref` (against `CLAUDE.md`) and
  has a nested `<button>` near line 255.
- `customer-packages` frontend: its list chrome was brought onto the pattern 2026-09-06; the
  **create form** still diverges from `docs/design/patterns/forms.md`.
- Docs still describe the old header search (`SEARCHABLE_ROUTES`, `meta.searchable`); both are
  deleted from the code. `docs/design/patterns/list-pages.md` needs the ListContainer search too.
- Confirm `CUSTOMERS_SPREADSHEET_ID` is set in every Vercel environment.
- Test the merged overlay sheet on a real phone: drag-to-close, scroll inside, Android Back,
  iOS edge-swipe.
- Manually remove test data: `ZZTEST01` in `Packages`, customer package `af9f0651` (พิมพ์นิดา).
  `SheetRepository.delete()` throws.
- Delete leftover `C:\MagicwashGemini\webapp-vue-frontend` — 3 locked native binding files,
  ~34 MB, from a removed worktree. Needs a restart to release.

## Environment

- User runs `vercel dev` on 3001. Do not start a second server; Vite pins 3102.
- Pushing `main` deploys production. Deliberate act.
- A long-lived `vercel dev` can break its frontend proxy silently: `/` returns 500
  `FUNCTION_INVOCATION_FAILED` while `/api/*` still returns 200. Restart it, don't debug the app.

## Project rules — pointers only

- `CLAUDE.md` — frontend architecture, navigation, testing, working rules.
- `api/CLAUDE.md` — backend under `api/` and `server/`.
- `docs/design/patterns/list-pages.md` — required pattern for root collection pages.
- Search and filters belong to `ListContainer` (`searchable` prop, `#search-actions` slot), not to
  the app header or `ListPageLayout`. A panel rendered into its default slot must go into the
  `#empty` and `#error` slots too, or it vanishes when the filter matches nothing.
- Service-type Thai labels: `src/shared/utils/service-type-labels.ts` only. `contracts/` is for
  API schemas and enums, never labels.
- `docs/frontend-layout-nav-refactor.md` — overlay/navigation rationale.
