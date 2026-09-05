# Project memory

Live note — what is in flight, what is next, what is stuck.
Rules: `.claude/.rules/memory.md`. Read it before writing here. Finished → delete the line.

## Where we are — 2026-09-06

- **Branches:** `main` (price-list v2 merged, **ahead 4, not pushed**) · `feat/live-order-helper`
  (pushed, unmerged, kept on purpose). Single worktree.
- `feat/price-list-frontend-v2` was rebased onto `main` and fast-forwarded in. Delete the local
  and remote branch once `main` is pushed.
- `redesign/price-list` held only an uncommitted token/`BaseBadge` restyle of the OLD three-price
  form. Discarded on the user's call; patch kept at
  `%TEMP%\claude\C--MagicwashGemini-webapp-vueǚ85826-*\scratchpad\price-list-restyle-discarded.patch`.
  Delete the branch too.
- `feat/live-order-helper` holds `getLiveOrderById()` plus a read-only parity script that
  samples 50 orders and checks `OrdersView` against live `OrderForm` + `OrderItemForms`.
  Nothing calls it yet.
- **Pipeline is 3 roles:** mason → clerk (executable tests + gates + mutation proof) → sentinel.
  The test-first role was removed 2026-09-05: with no code to call it could only regex the
  source, producing guards that failed against correct code and guards that could not fail.
- **Never dispatch `backend-team` or any pipeline unless the user names it.** No default
  code-writing assistant.

## Price list — next

1. Push `main` (deploys production), then delete both dead branches.
2. UX pass — scope not decided. Friction found while migrating:
   - `ITM-0010` has two active WSIR rows, same name, same group, 120 vs 700. Price is the only
     thing telling them apart, so it must read as the primary field on the card and in the picker.
   - The form's two create modes (new item vs. another price option) look identical.
   - The invoice picker downloads all 79 rows to show 23 — inactive filtered client-side.
3. Fill real prices for the 33 rows at placeholder `price 0` (all `active: false`).

Verified 2026-09-06, do not re-check: live sheet = G Drive registry = `PriceList.db-contract.ts`,
16 columns `id … active`, enum `WSIR|IRON|DRCL|WASH`. `PRICE_LIST_SPREADSHEET_ID` is set in all
three Vercel environments, and the sheet is shared with the staff-writer service account as Editor.
Post-rebase: build, `typecheck:api`, and 18/18 price-list dry-tests pass.

Reported, not fixed:

- `InvoiceItems.service_type` is written `null` unconditionally — a line's service survives
  only inside the description string.
- No `active` filter on the list query; the picker fetches everything and filters client-side.
- **Trap:** clearing a range does not clear number formats. `price` landed where
  `effective_from` used to sit and rendered as dates until the format was reset.

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
- Invoice `CANCELLED` vs `VOID` — decide the business distinction, then the contract. Cancel/void
  UI deferred; see `docs/plans/invoice-contract-merge-and-status-update.md`.
- Nested invoice/items update blocked until delete or soft-delete exists.
- Remove schema-file `z.infer` exports in one dedicated all-contract pass.
- Consolidate datetime helpers separately — `SheetRepository` is shared by every module.
- Stage 4 overlays: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`, `NavSidebar.vue` are still
  local-state. `OrderGalleryPage.vue` also mirrors `route.meta` into a local `ref` — soft conflict
  with the no-mirror rule in `CLAUDE.md`. Review its nested `<button>` (~line 255) while there.
- `customer-packages` frontend is off-pattern: list search/filter/accessibility/layout and the
  create form diverge from `docs/design/patterns/list-pages.md` and `forms.md`.
- Remove stale `SEARCHABLE_ROUTES` references in two old docs.
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
- `vercel dev` can leave a long-lived process whose frontend proxy breaks silently while `/api/*`
  keeps working: `/` returns 500 `FUNCTION_INVOCATION_FAILED`, API routes still 200. Restart it —
  it is not an app-code bug, do not chase it in source.

## Project rules — pointers only

- `CLAUDE.md` — frontend architecture, navigation, testing, working rules.
- `api/CLAUDE.md` — backend under `api/` and `server/`.
- `docs/design/patterns/list-pages.md` — required pattern for root collection pages.
- `docs/frontend-layout-nav-refactor.md` — overlay/navigation rationale.
