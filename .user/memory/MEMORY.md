# Project memory
Live note — what is in flight, next, stuck. Rules: `.claude/.rules/memory.md`, read before writing.

## Where we are — 2026-09-07

- **feature/laundry-photos-module:** LaundryPhotos POST append shipped (`cdab410`) — db-contract
  `append: true` + `audit.onAppend: ['timestamp']`, strict create schema, 8-hex id in the repo
  wrapper. Verified against the live sheet: column H stores correctly, no day/month swap.
  Frontend still uploads via Apps Script; switching `usePhotoUpload.js:55` is the next step and
  needs the local tile key split from the server-generated db id.
- **AfterPhoto append not done.** Blocked on the user: share workbook `1_0gUApQ…` (tab `after`)
  with the service account, and set `AFTER_PHOTOS_SPREADSHEET_ID` in Vercel Production + Preview.
  Also unresolved: `src/api/photos.js` READ_SHEET.AFT says tab `AfterPhoto`, the db-contract says
  `after` — check which tabs actually exist before trusting either.

- **Branches:** `main` (synced) · `feature/laundry-photos-module` (in flight) ·
  `feat/live-order-helper` (pushed, unmerged, **not finished** — kept on purpose). Single worktree.

- **Never dispatch `backend-team` or any pipeline unless the user names it.** No default
  code-writing assistant. Pipeline is mason → clerk → sentinel.
- `main`: documentation was consolidated. Root `CLAUDE.md` is the only index; backend rules live
  under `docs/architecture/backend/`. Retired `api/CLAUDE.md`, `api/AGENTS.md`, completed plans,
  handoff documents, and `docs/scripts/` are deleted and pushed in `e6058a6`.
- Uncommitted: `.codex/skills/explore/SKILL.md` contains the Codex discovery workflow; the short
  `.claude/skills/explore/SKILL.md` wrapper invokes it with Luna, high reasoning effort, and a
  prompt example.

## Workers

- **Codex quota was exhausted 2026-09-06** (resets 00:17). When it is, dispatch a
  general-purpose sonnet agent with the same brief — that is what finished the scanner.
- Chrome **cannot be launched from a Claude session on this machine** (`0xC0000003`, real
  Chrome and Playwright's chromium alike). Browser proof goes to the user's phone.
- Solo codex briefs must forbid subagents in the first lines, redirect to a log file, and
  never pipe through `tail`.

## Browser checks still pending on `main`

Nothing below has been opened in a browser; there is no frontend type-check, so a broken
prop ships green.

1. Search on `#/price-list` (client filter) and `#/invoices` (store fetch); `✕` clears.
2. Deep link `#/invoices?keyword=INV` — the box must open by itself with the word in it.
3. `#/price-list`: search → ⚙ → `ซักแห้ง` → type nonsense. **Service buttons must remain.**
   `ListContainer` renders one slot at a time; a panel only in the default slot vanishes
   exactly when the filter matches nothing.
4. `#/appointments` and customer detail — must show **no** magnifier at all.
5. Theme sweep: green ink instead of near-black, Noto Sans Thai everywhere.
6. Order detail → scroll so a dropdown trigger sits near the bottom edge, then open it. The
   panel must flip **above** and show every row.
7. Order create → customer picker: scroll the options, no scrollbar should appear.

## Photos — settled, do not re-litigate

- `OrderImages` (weight/belonging/document, `/api/order-images`) and `LaundryPhotos` +
  `AfterPhoto` (garment before/after, `/gallery/:key`, Apps Script) are **two systems on
  purpose**. An earlier note proposed merging them; rejected.
- **Live bug, unfixed:** the gallery learns `created_by` only from `?by=`. Rows without it
  are rejected by Apps Script with `Missing required field: created_by`. The frontend
  falls back to `admin`, but the gateway is the only validator and it fails silently.

## Price list — next

1. Fill real prices for the 33 rows at placeholder `price 0` (all `active: false`).
2. **Add-price-to-an-existing-item is still buried.** The `+` always opens "new item"; adding
   another service to a visible row costs a mode switch and a re-search. An action on the card
   itself (`BaseSwipeCard` supports one) would pass `itemCode` straight through. Designed, not built.

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

## Deferred by the user

- **Pagination, app-wide.** Responses omit real `total`/`totalPages` while frontend types claim
  otherwise. Invoices and customer-packages strand rows past 20. Two passes: make `okPaged` count
  for real and drop invoices' fabricated total, then add pagers to those two modules.
- **Live Orders sheet data is dirty.** Do not normalize it incidentally. `OrderItemForms` holds
  1,074 phantom quantity-only rows; categorical columns mix spellings and languages;
  `OrderImages.image_path` and timestamps mix formats.
- **`LaundryPhotos` row order is not chronological.** New rows land mid-sheet (~row 20,869), the
  physical last row is months old. Sort by timestamp; never trust the bottom of the sheet.
- **Other modules still page-walk** with `order by <non-unique column>` + `limit/offset` and can
  silently drop rows. Orders and OrderItems will actually hit it.

## Open items

- **API authentication before launch.** Until then the actor is a fallback constant, defined once
  per side: `src/shared/config/actor.ts` and `server/shared/config/actor.ts`. Auth work changes
  those two files; `?by=` must keep overriding for AppSheet deep links.
- Issue reports still ask a human to type their name, on purpose — fold into the auth pass.
- Invoice `CANCELLED` vs `VOID` — decide the distinction, then the contract. UI deferred; see
  `docs/plans/invoice-contract-merge-and-status-update.md`.
- Nested invoice/items update blocked until delete or soft-delete exists.
- Remove schema-file `z.infer` exports in one dedicated all-contract pass.
- Consolidate datetime helpers separately — `SheetRepository` is shared by every module.
- Stage 4 overlays still local-state: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`,
  `NavSidebar.vue`. The gallery mirrors `route.meta` into a `ref`; nested `<button>` near :255.
- `customer-packages` **create form** still diverges from `docs/design/patterns/forms.md`.
- `customer-package-create-page.dry-test.ts:20` asserts `@close="returnToList"`; the page says
  `@close="closeForm"`. Failing at HEAD, unrelated to any recent change — decide which is right.
- Docs still describe the old header search (`SEARCHABLE_ROUTES`, `meta.searchable`); both are
  deleted from the code. `docs/design/patterns/list-pages.md` needs the ListContainer search too.
- Confirm `CUSTOMERS_SPREADSHEET_ID` is set in every Vercel environment.
- Test the merged overlay sheet on a real phone: drag-to-close, scroll, Back, edge-swipe.
- Delete leftover `C:\MagicwashGemini\webapp-vue-frontend` — locked native bindings, ~34 MB,
  from a removed worktree; needs a restart to release.

## Test data to remove by hand (`SheetRepository.delete()` throws)

- `Packages`: `ZZTEST01` · customer package `af9f0651` (พิมพ์นิดา)
- `OrderForm`: `246fde2b`, `cc4d375e`, `f68ae08d` — all customer `b1d4fc48`, `order_name` `UAT-*`
- `LaundryPhotos`: `QK0H9DT1` (`created_by: claude-uat`) · `a260b2b1`, `1b7649ba`
  (`order_id: CLAUDE-PROBE-ORDER`, from the 2026-09-07 live append probe)

## Environment

- Dev server was on **3000** (`vercel dev` in front of Vite, which pins 3102). Do not start a
  second one; check what is listening first.
- Pushing `main` deploys production. Deliberate act.
- A long-lived `vercel dev` can break its frontend proxy silently: `/` returns 500
  `FUNCTION_INVOCATION_FAILED` while `/api/*` still returns 200. Restart it, don't debug the app.

## Project rules — pointers only

- `CLAUDE.md` — frontend architecture, navigation, testing, working rules.
- `docs/design/patterns/list-pages.md` — required pattern for root collection pages.
- Search/filters belong to `ListContainer` (`searchable`, `#search-actions`), not the app
  header. A panel in the default slot must also go into `#empty` and `#error`.
- Service-type Thai labels: `src/shared/utils/service-type-labels.ts` only. `contracts/` is for
  API schemas and enums, never labels.
