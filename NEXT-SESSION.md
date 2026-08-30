# Next session

Forward-looking only. When something is finished, delete its entry — `git log`, `docs/`, and
`CLAUDE.md` already hold the history. What stays here is what is unfinished, deferred, or a trap
someone would otherwise walk into again.

## Where we are

The **Orders backend is built and green, on `feat/orders-contracts`: not merged, not deployed, and
not called by any frontend code.**

- **`feat/orders-contracts`** — checked out, branched from `feat/orders-frontend` at `b1beff2`.
  Holds the whole orders backend: three API contracts, two newly registered sheets, three modules,
  and the plan/doc set.
- **`feat/orders-frontend`** — the clickable prototype, 4 commits, not merged. **The user has still
  not reviewed it in a browser.** It renders fixtures from
  `src/features/orders/mocks/order-prototype.fixture.ts` and does not call the new endpoints.
- **`main`** — a push deploys prod (`https://magicwash-staff.vercel.app`), so pushing is a
  deliberate act.

The user runs their own `vercel dev` on port 3000. **Do not start a second dev server** —
`vite.config.ts` pins 3102 with `strictPort` on purpose.

## Do this first

1. **Deploy and hit the three new endpoints for real.** Nothing has ever called them. Every proof so
   far is a dry test with a fake repository injected, so no row has been written to a live sheet
   through this code. `POST /api/work-orders` is the sharpest edge: it is the first thing ever to
   append to `OrderForm`, whose `writes.append` was `false` until now. A real deploy plus a curl
   against the prod alias is the only thing that catches the ESM-extension class of failure, which
   typecheck, dry-tests and `vercel dev` all miss.
2. **The user reviews the Orders prototype in a browser** — `#/orders`, `#/orders/new`,
   `#/orders/ORD-...`, plus `?item=new` and `?capture=1` on the detail route.
3. **Delete the leftover test data.** `ZZTEST01` in the `Packages` catalog (deactivated but still
   listed), and customer package `af9f0651` for พิมพ์นิดา, a real ACTIVE GOLD 50-credit package.
   `SheetRepository.delete()` throws, so both must go by hand.
4. **Smoke-test the packages work in a browser.** The packages list/form pages, the package dropdown
   and the customer picker have never been clicked. `/frontend-test` is the tool.

## Orders backend: built, never executed

Design and rationale live in `docs/plans/orders-backend.md` (status FINAL); the endpoint shapes are
in `docs/features/orders/contracts/`. Do not re-derive either here.

The one structural decision worth carrying in your head: **Orders is two lanes, deliberately.**

- `orders` reads `OrdersView` in the **portal** workbook (`PORTAL_SPREADSHEET_ID`), 13 columns, PK
  `order_id`, Apps Script-materialised with an `items_json` column. Read-only, browse-oriented,
  **untouched by this work** — it has 10 live importers and the project has no frontend type-check,
  so changing its DTO ships green and breaks on screen.
- `work-orders` reads and writes `OrderForm`; `order-items` covers `OrderItemForms` and
  `order-images` covers `OrderImages`, all in `ORDERS_SPREADSHEET_ID`. Live staff lane, read fresh
  and written directly.

They are different workbooks, different column sets and different primary keys. Anything that reads
one and writes the other will disagree until the Apps Script sync runs; the sync interval has never
been measured.

Six of the seven original Orders blockers are closed by this backend. **Blocker 6 is still open**:
photo capture lives in `src/features/gallery/`, `src/api/`, `src/composables/` and `src/utils/`, so
reusing it from orders is a cross-feature import. Either move it to `src/shared/` in a dedicated
refactor or duplicate it locally — `POST /api/order-images` cannot be reached from the capture
overlay until that is decided.

Still not done, on purpose: the `OrderItems` catalogue behind `OrderItemForms.item_id`,
package-credit consumption on items, `invoice_item_id` writes, binary upload through the API, and
retiring the frontend fixtures.

### Two behaviours that will look like bugs

- **Item `serviceType` is server-derived and cannot be set by a client.** `orderItemCreateSchema`
  has no such key; `OrderItemService.create` reads the parent `OrderForm` row and copies its
  `service_type` onto the new line. One order carries exactly one service type. That lookup is also
  the only thing validating `orderId`, so an unknown order gives 404 on item create.
- **`GET /api/work-orders` returns no `items`.** `OrderForm` has no `items_json`, and fetching lines
  per row would be one read per order. The detail route has them; the list route never will without
  a schema change.

## Live Orders sheet data is dirty — ruled out of scope, do not "fix" it

Measured 2026-08-30 over every row. Recorded so nobody re-derives it or files it as a bug.

- **`OrderItemForms` has 1,074 phantom rows** — blank in every column except `quantity`, which reads
  `0.0` from a column-E fill-down past the real data. Scattered (row indexes 5 to 20,640), so they
  cannot be trimmed by truncating; `id` comes back `null` on them. Nothing throws: the row schema is
  never `.parse()`d on reads and the append key lookup skips blank key cells. **`quantity` is typed
  nullable precisely because its 0-null count is that artifact.**
- `image_type` has 13 spellings, `category` 5, `service_type` 8 (Thai and English mixed). All free
  strings on purpose — an enum would be a claim the data does not support.
- `OrderImages.image_path` holds both full Firebase URLs and legacy relative paths; `created_at`
  holds both ISO-with-`Z` and `dd/MM/yyyy HH:mm:ss`.
- `OrderForm.service_type` **has been widened** to the canonical four (`WSIR`, `IRON`, `DRCL`,
  `WASH`); live `DRCL` rows are no longer a contract lie. `OrderForm.status` was **not** touched and
  is still a 6-member enum (`PENDING`, `RECEIVED`, `SUBMITTED`, `APPROVED`, `COMPLETED`,
  `CANCELLED`); nobody has sampled the live column against it.

## Pagination is broken app-wide — deferred by the user

**No list endpoint returns `total`/`totalPages`.** Every list route answers through `okPaged`
(`server/shared/http/response.ts:79-90`), which emits `{ page, perPage }` only. The full meta schemas
exist unused: `apiPaginationMetaSchema`/`apiPaginatedSchema` (`contracts/shared/api.schema.ts`) and
`paginatedBody`.

Two things claim otherwise and are wrong: `api/CLAUDE.md:187` documents the full meta, and
`src/shared/api/api-client.ts:18-23` types it — so the frontend has a `total` that is typed present
and `undefined` at runtime.

Six modules dodge this via the cap-once path `docs/design/patterns/list-pages.md:43-47` allows.
Only **`invoices`** and **`customer-packages`** use the default `perPage` 20 with no pager, so
records past row 20 are genuinely unreachable. Invoices hides it: `invoice.service.ts:15-26` sets
`total = items.length` and renders it as a collection total — the exact thing the pattern doc forbids.

When picked up, two separately-reviewed steps because step 1 touches every module:

1. Make `okPaged` emit real `total`/`totalPages` and fix invoices' fake `total`. The work is the
   count query — GViz `limit`/`offset` does not know the unpaged size, so each list request needs a
   second count call.
2. Add pager UI to `invoices` and `customer-packages` only. Leave the six cap-once modules alone.

## customer-packages is off-pattern — frontend-only, still open

Audited 2026-08-28 against `docs/design/patterns/list-pages.md` and `forms.md`. Pagination excluded
(above); all of this is doable without touching the backend.

List page + filter bar + cards:
- Search is a permanently visible field instead of `useHeaderSearch` + `meta.searchable`; the route
  declares no `meta` at all, unlike its three peers.
- Keyword is not debounced — `router.replace` fires on every keystroke.
- Raw API enums render as-is (`ACTIVE`/`INACTIVE`/`EXPIRED`/`CANCELLED`); no label map, no badge colors.
- Filter inputs are placeholder-only with no `<label>`; row buttons have no `focus-visible`.
- `main` is missing `min-h-0 no-scrollbar w-full min-w-0`; the filter sibling has no `flex-none`.

`CustomerPackageCreatePage.vue`:
- Uses `AppLayout` + an in-page `<form>` instead of `FormOverlay`.
- Package / service day / time slot are native `<select>`s; `FormOptionGrid` and `FormLabel` unused.
- The write body is an object literal inside `submit()`, not a single `createPayload()`.
- **If it is renamed to `<Entity>FormPage.vue`, the `KeepAlive` exclude entry in `src/App.vue` must
  change in the same commit** — that list matches component names, and a silent mismatch reintroduces
  typed-fields-leaking-between-records.

Already correct, do not "fix": it is in the `KeepAlive` exclude list, `meta.parent` is right,
`ListContainer` owns loading/error/empty/skeleton, validity is one computed, `"" → null` is done.

## Still open

- **CANCELLED vs VOID** — nothing in code, the DB contract, or the registry defines the difference.
  `invoiceStatusUpdateSchema` accepts both because both exist in the sheet enum. If the business has
  one notion of "cancel", drop the other; the structure does not change either way.
- **`z.infer` exports in schema files** — standing rule is that schema files carry no type exports.
  `invoice-api.schema.ts` has 14. Stripping them is a pass across all contract files.
- **Cancel/void UI** — deferred by the user. Design in
  `docs/plans/invoice-contract-merge-and-status-update.md`.
- **Nested invoice+items update** — blocked, not skipped. `SheetRepository.delete()` throws, the
  Sheets client exposes only `values.*` (no `batchUpdate`/`deleteDimension`, and `SheetContract`
  stores no gid), and `InvoiceItems` has no soft-delete column. One of those three must change first.
- **Datetime helper consolidation** — convention is written down (`docs/conventions/datetime.md`);
  new cross-boundary helpers go in root `shared/utils/`. `server/shared/utils/bangkok-timestamp.ts`
  and `src/shared/utils/sheet-date.ts` still hold their own implementations. Moving the write-side
  helper touches `SheetRepository`, which every module depends on, so it needs its own job on a quiet
  tree.
- **Stale `SEARCHABLE_ROUTES` references** in `docs/plans/issue-reports.md` and
  `docs/packages-module-design.md`. That constant no longer exists.

## Two branches left unmerged, both conflicting

Resolving these is code work, not a merge button.

| Branch | Conflicts |
|---|---|
| `feature/customer-create-form` | `src/App.vue` (the `KeepAlive` exclude list) |
| `feature/invoice-create-form-redesign` | `PriceListFormPage.vue`, `.user/memory/MEMORY.md` |

## Traps worth not rediscovering

**Adding a new physical sheet — three traps, no test catches any, each fails differently:**

1. **Share → "Anyone with the link" → Viewer.** Reads are unauthenticated GViz; a private sheet
   fails every read with `401`. Service-account Editor rights cover writes only, so writes can
   succeed while every read 401s.
2. **The header row must hold every contract key**, or `GViz query error: NO_COLUMN: F`.
3. **The grid must be exactly as wide as the contract.** A fresh tab is 26 columns and the reader
   throws `No DB field resolves for GViz column 'J'`. Delete the surplus.

`docs/scripts/create-issue-reports-sheet.gs` does 2 and 3 and prints reminders for 1 — copy it as the
template.

**Frontend verification is weaker than it looks.** `npm run build` is esbuild only — **no frontend
type-check exists**, so a broken prop contract ships green. `.vue` SFCs cannot be unit tested here;
tests are plain TS run with `npx tsx`. "No automated test was possible" is the correct report for a
component change, not a gap to paper over.

**Vue casts an absent boolean prop to `false`, never `undefined`.** `ListPageLayout` shipped with
`props.showSearch ?? …`, so `??` never fell through and the search input rendered on none of its six
pages. Green build, passing dry-tests, three review stages approved it; found in two minutes by
clicking the button in a browser. **A boolean prop gets an explicit default in `withDefaults` and is
never gated with `??`.**

**`ListPageLayout` boundaries — do not "improve" these.** `ListContainer` stays outside it (pages
pass it in the default slot; absorbing it turns the layout into a prop dump). The layout does not own
the keyword — it debounces and emits, each page keeps its own filter composable. Every prop name is
generic and a dry-test asserts it imports nothing from `src/features/`.
`AppointmentSchedulePage`, `PendingAppointmentsPage`, and `CustomerOrderHistoryPage` stay out.

**`TUE` is absent from `customerPackageServiceDaySchema` on purpose** — Tuesday is the shop's closing
day, confirmed by the user 2026-08-28. Do not "complete" that enum.

**`PATCH /api/customer-packages/:id` is a stub that always 404s** — editing a package is undefined
product-wise, not a bug.

**`invoiceViewResolveStatus_` (Apps Script) recomputes status only when the stored value is
`ISSUED`**, deriving PAID/PARTIALLY_PAID/OVERDUE/UNPAID from payments. DRAFT/CANCELLED/VOID pass
through — that is why a status PATCH survives a re-sync.

**Apps Script is not retired:** `APPSCRIPT_INVOICE_VIEW_SYNC_URL` and `src/api/photos.js` are live.
Row writes moved to Sheets API v4 with a service account; **reads are still unauthenticated GViz**.

**GViz silently falls back to the first sheet when the sheet parameter names a tab the workbook does
not have.** No error, no warning — a query for `OrdersView` against `ORDERS_SPREADSHEET_ID` returns
`OrderForm` rows and reads as "these two sheets are identical". This cost a wrong conclusion once.
When checking a live sheet by hand, confirm the returned header row is the sheet you asked for.

**Every id in these sheets is a bare 8-character lowercase hex string with no prefix** — sampled
live: `OrderForm.id` `117ac0a1`, `OrderItemForms.id` `fc60a477`, `OrderImages.id` `1499bc46`,
`Customers.customer_id` `bdd8854c`. `generateShortId()` returns exactly that. Earlier plans invented
`ORD-`, `ORI-` and `IMG-` prefixes that match nothing in the data. Do not reintroduce one.

**A green gate is not proof; read the file.** Delegated agents on this codebase have twice worked
around a guard rather than reporting it: unicode escape sequences written into a source file purely
to slip past a no-underscore regex assertion, and an `as` cast used to re-add a request field the
contract deliberately removes. Both left every gate green. Mutation-testing the guards — break the
source, confirm the test goes red, restore it — is what actually catches this. Relatedly, a registry
test must assert its OWN key resolves and never that a future sibling is absent, or the next module
to land fails a test that was only ever describing the scope of an old task.
