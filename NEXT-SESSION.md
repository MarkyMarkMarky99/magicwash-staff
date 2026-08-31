# Next session

Forward-looking only. When something is finished, delete its entry — `git log`, `docs/`, and
`CLAUDE.md` already hold the history. What stays here is what is unfinished, deferred, or a trap
someone would otherwise walk into again.

## Where we are

- Current branch: `chore/remove-dead-orders-photo-prototype`; HEAD is `49bb5df`.
- The Orders frontend uses route-owned `?orderAction=item`; legacy `?item=new` URLs remain readable.
  Item drafts reset by `orderId`, store reads ignore stale responses, and browser smoke testing is
  still required because no browser session was connected.
- The Orders backend is built and green but is not deployed or called by the fixture-backed frontend.
  Its design and rationale are in `docs/plans/orders-backend.md`; endpoint contracts are in
  `docs/features/orders/contracts/`.
- `feat/orders-frontend` remains an unreviewed clickable prototype. `main` deploys production when
  pushed, so pushing it is a deliberate act.
- The user runs `vercel dev` on port 3000. Do not start a second server; Vite deliberately pins 3102.

## Commit 49bb5df — dead photo prototype removed

`49bb5df` removed the nonfunctional Orders photo-capture prototype and unused compression surface;
see the commit diff rather than repeating its 13-file change list. The prototype could not upload,
its store state was never populated, and nothing called `POST /api/order-images`.

Two deliberate decisions are not obvious from the deleted code:

- `LEGACY_CAPTURE_QUERY_KEY` and its deletion in `buildOrderOverlayQuery` remain so stale
  `?capture=1` URLs are stripped instead of reviving a removed overlay.
- `compressImage` and `encodeCanvasToJpeg` both remain because they are different operations:
  the former accepts a `File` for the album path; the latter accepts a `<canvas>` for the camera path.

## THE GOAL — one photo system, reached incrementally

This is the destination architecture, **not a single migration**:

- `OrderImages` capture works and can actually take a photo.
- Before-laundry photos, after-laundry photos, and order images all use one shared camera component.
- The backend uploads the binary to Firebase and writes the resulting URL to Google Sheets. The
  browser no longer uploads directly to Firebase.

Reach this in small, separately designed and verified steps. Do not attempt the full destination in
one pass.

## Photo starting point today

- The only live photo path is `src/features/gallery/`: `getUserMedia` camera, client-side
  compression, then a browser-direct Firebase Storage upload through the client SDK in
  `src/firebase.js` and `src/api/storage.js`. `src/api/photos.js` sends the URL to Sheets through the
  Apps Script gateway, not through this project's own `api/`.
- `src/firebase.js` hardcodes the Firebase configuration and bucket; it reads no environment vars.
- Before and after photos are in two separate spreadsheets: the BEF tab is `LaundryPhotos`, and the
  AFT tab is `AfterPhoto`. They are not two tabs in one spreadsheet.
- `server/` has no `firebase-admin` dependency and no binary/upload handling. Only the client
  `firebase` package is installed.

## Why `order-images` cannot simply replace the live path

- `OrderImages` and its API contract have no `orderitem_id` field/column.
- The existing photo sheet uses `image_url`; `OrderImages` uses the differently named
  `image_path` column.
- `OrderImages.image_type` means evidence kind (`BAG`, `WEIGHT`, `DOCUMENT`, and so on), not
  before/after. Reusing it as-is would lose the BEF/AFT distinction.
- `LaundryPhotos.db-contract.ts` declares `writes.append: false`. `SheetRepository` therefore does
  not build a write client for it, and `append()` throws.
- No backend module or HTTP route is registered for `LaundryPhotos` or `AfterPhoto`; only
  `order-images` is registered.

This mismatch needs a design decision before implementation; it is not merely a wiring task.

## Open photo write-path decision

Choose one direction before writing an implementation brief:

1. Extend `OrderImages` with `orderitem_id` and an explicit before/after distinction, then merge the
   two photo spreadsheets into it; or
2. Add a separate `laundry-photos` backend module matching the spreadsheets that already exist.

Option 1 requires a schema-registry change under
`G:\My Drive\Magicwash\Database\GoogleSheets\*.json`. That registry is shared with another project,
is read-only to agents, and **only the user may edit it**. Never write to it.

## Do this first

1. Choose the photo write-path direction above; do not implement the whole target architecture.
2. Decide whether to delete `docs/features/orders/forms/create-order-image.md` or retain it as a
   record of the earlier design. Commit `49bb5df` deliberately left it untouched because deleting
   an entire documentation file is the user's call.
3. Deploy and hit the three Orders endpoints for real. Nothing has called them; especially verify
   `POST /api/work-orders`, the first append to `OrderForm`. A production deploy catches failures
   that typecheck, dry tests, and `vercel dev` can miss.
4. Browser-review the Orders prototype: `#/orders`, `#/orders/new`, `#/orders/ORD-...`, and
   `?item=new` on detail.
5. Manually remove leftover test data: `ZZTEST01` in `Packages` and customer package `af9f0651` for
   พิมพ์นิดา. `SheetRepository.delete()` throws.
6. Browser-smoke-test package list/form pages, dropdown, and customer picker; none has been clicked.

## Orders backend: built, never executed

Orders intentionally has two lanes. `orders` reads the browse-only `OrdersView` in the portal
workbook. `work-orders`, `order-items`, and `order-images` use live staff sheets in
`ORDERS_SPREADSHEET_ID`. Do not mix reads from one lane with writes to the other; they can disagree
until Apps Script syncs them. See `docs/plans/orders-backend.md` for the full design.

Still intentionally absent: the `OrderItems` catalogue, package-credit consumption, nested
`invoice_item_id` writes, server-side binary upload, and retirement of frontend fixtures.

## Live Orders sheet data is dirty — out of scope

Do not normalize it incidentally. `OrderItemForms` contains 1,074 phantom quantity-only rows;
several categorical columns have mixed spellings/languages; `OrderImages.image_path` and timestamps
have mixed formats. Details remain in the history that established the contracts.

## Pagination is broken app-wide — deferred by the user

List responses omit real `total`/`totalPages`, despite frontend typing that says otherwise. Invoices
and customer-packages strand rows after 20. Fix in two reviews: first make `okPaged` perform a real
count and remove invoices' fabricated total; then add pagers only to those two modules.

## customer-packages is off-pattern — frontend-only, still open

The audit remains open: list search/filter/accessibility/layout and the create form diverge from
`docs/design/patterns/list-pages.md` and `forms.md`. If the form component is renamed, update the
`KeepAlive` exclusion in `src/App.vue` in the same commit.

## Still open

- Define the business distinction between invoice `CANCELLED` and `VOID`; then decide the contract.
- Remove schema-file `z.infer` type exports in a dedicated all-contract pass.
- Cancel/void UI remains deferred; see `docs/plans/invoice-contract-merge-and-status-update.md`.
- Nested invoice/items update is blocked by the lack of delete/soft-delete support.
- Consolidate datetime helpers separately because `SheetRepository` is shared by every module.
- Remove stale `SEARCHABLE_ROUTES` references in two old docs.
- Two unmerged branches require code conflict resolution: `feature/customer-create-form`
  (`src/App.vue`) and `feature/invoice-create-form-redesign` (`PriceListFormPage.vue` and memory).

## Traps worth not rediscovering

- Follow `CLAUDE.md` for sheet, frontend-verification, overlay, layout, and form-page traps; do not
  duplicate those rules here.
- Apps Script remains live for invoice sync and `src/api/photos.js`; reads remain unauthenticated
  GViz while row writes use Sheets API v4.
- GViz silently falls back to the first tab when a requested tab is absent. Verify returned headers.
- Sheet IDs are bare eight-character lowercase hex values; do not invent prefixes.
- A green guard is not proof: mutation-test important assertions and read the changed file.
