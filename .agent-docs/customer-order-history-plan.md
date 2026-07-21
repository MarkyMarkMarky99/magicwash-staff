# Plan: Customer → Order History (webapp-vue)

**Date:** 2026-07-21
**Status:** DONE (2026-07-21) — plan confirmed ready by Codex across three
read-only review passes, implemented end to end by Codex (workspace-write),
then independently verified by Claude: `npm run build`, `npm run
typecheck:api`, both new dry-tests, and the pre-existing appointments/
repository/service dry-tests (no regression from the shared GViz-reader
extraction) all pass; manual file-by-file review against every plan
requirement found no defects.

Full live E2E confirmed against real production data via `vercel dev`:
customer list → tap-to-navigate (not a swipe artifact) → order history page
→ real order card (`2025-10-27`, `DRCL`, `SUBMITTED`, qty 2) → detail sheet
(received/due dates, both Thai items, note) → all rendering correctly.
`GET /api/orders?customerId=...` and `GET /api/customers/:id` verified
directly via curl with real spreadsheet data too.

Both env gaps from §2.5 are resolved: `ORDERS_SPREADSHEET_ID` and
`CUSTOMERS_SPREADSHEET_ID` were already registered on the Vercel project for
all environments; `APPSCRIPT_URL` was also already registered (added ~1
month prior, just never synced to local `.env.local` — so was never
actually a real gap, only a local-cache staleness issue). Added the two
that were missing for local `vercel dev` (`APPOINTMENTS_SPREADSHEET_ID`,
`CUSTOMERS_SHEET_NAME`) to the Development environment via `vercel env add`.
Local `vercel dev` (not plain `vite dev`) is required to exercise `/api/*`
routes locally — root `.env.local` alone is not read by the function
runtime; it's Vercel's project-level env store that matters.
**Audience:** implementing agent (Codex). Predecessor doc:
`.agent-docs/customer-order-history-handoff.md` (exploration only).
**Orchestration:** Claude drafted this plan from the handoff doc + direct repo
reads, Codex (`gpt-5.6`, read-only) reviewed it three times and its
corrections are folded in below. Two scope decisions were made by the human
owner (Section 0). Codex implements; Claude reviews the diff.

---

## 0. Locked decisions (do not re-litigate these)

1. **Waiting-pickups filtering stays on the frontend for this MVP**, not the
   backend, even though it is less correct (see §3.5 for the known gaps).
   Document it as a temporary exception in code and cover it with unit tests.
2. **Orders backend uses the "C-lite" shared read-only contract** — a new
   `ReadOnlyModuleApiContract` shape shared under `contracts/shared/`, not a
   one-off ad hoc reader private to `orders`. See §2.1.

---

## 1. Scope

**MVP:** tap a customer card → Order History page (customer header + Schedule
Pickup + waiting pickups + order list) → tap an order → detail bottom sheet →
View Photos (existing gallery route). Schedule Pickup reuses the existing
`/new-booking` flow via `selected-customer.store.ts`.

**Explicitly cut from MVP:** Schedule Delivery, embedding booking as page
state (React's `booking`/`galleryOrderId` local-state embeds — Vue navigates
instead), i18n TH/EN, pull-to-refresh (a manual refresh **button** stays in
scope — cutting pull-to-refresh doesn't mean cutting refresh entirely), a
dedicated `/api/orders/:id` detail endpoint.

---

## 2. Backend

### 2.1 New shared engine primitive: read-only module contract

Every module in the current engine (`ModuleContract` / `ModuleApiContract` /
`BaseCrudService` / `GSheetRepository`) assumes full CRUD — `request.create`
and `request.update` are non-optional in the type. `OrdersView` is a
materialized, read-only view (synced from elsewhere) with no write path in
this feature, and forcing it through `GSheetRepository` would let someone
accidentally POST an APPEND/UPDATE against a view sheet. Codex confirmed
there's no existing read-only precedent in the new architecture (only the
legacy `server/gviz/*` proxy, which `api/CLAUDE.md` explicitly says is not
the source of truth for new work).

Add:

- `contracts/shared/read-only-module-api-contract.ts` — a `ReadOnlyModuleApiContract`
  type: `{ query: { list: ZodSchema }, response: { list: ZodSchema } }`. No
  `request`, no `response.detail` (this module has no getById — see §2.4).
  Same `satisfies`-checked philosophy as `ModuleApiContract`, just smaller.
- Extract the private GViz fetch/parse/table-row logic currently inside
  `server/shared/repositories/gsheet.repository.ts` (`fetchGVizRows`,
  `parseGVizResponse`, `tableToRows`, the `GVIZ_BASE_URL` constant) into a
  shared reader, e.g. `server/shared/repositories/utils/gviz-reader.ts`, that
  both `GSheetRepository` and the new orders reader import. Do not duplicate
  this transport code, and do not import the legacy `server/gviz/gviz-utils.js`
  (different env var names, non-standard response shape, unbounded query
  string).

### 2.2 `contracts/orders/order-api.schema.ts`

```ts
export const orderItemSchema = z.object({
  id: z.string().nullable(),
  description: z.string().nullable(),
  serviceType: z.string().nullable(),
  quantity: z.number().nullable(),
})

export const MAX_ORDERS_PER_PAGE = 500

export const orderListQuerySchema = z.object({
  customerId: z.string().trim().min(1),   // REQUIRED — omitted must 422, never "all orders"
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  // Default perPage MUST equal MAX_ORDERS_PER_PAGE, not the shared
  // API_PAGINATION_DEFAULTS.perPage (20) — a page-of-20 default would
  // silently truncate a customer's order history. Same reasoning applies to
  // the waiting-pickups fetch in §3.2: it must explicitly pass
  // `perPage: MAX_APPOINTMENTS_PER_PAGE` (100), since the generic
  // `/api/appointments` list defaults to 20 and this feature needs every
  // appointment for the customer to filter correctly.
  perPage: z.coerce.number().int().positive().max(MAX_ORDERS_PER_PAGE).default(MAX_ORDERS_PER_PAGE),
  sortBy: z.enum(['receivedDate']).default('receivedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const orderListResponseSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  orderNumber: z.string().nullable(),
  receivedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  serviceType: z.string().nullable(),
  status: z.string().nullable(),   // loose, NOT z.enum — see rationale below
  quantity: z.number().nullable(),
  note: z.string().nullable(),
  items: z.array(orderItemSchema),
})

export const orderApiContract = {
  query: { list: orderListQuerySchema },
  response: { list: orderListResponseSchema },
} satisfies ReadOnlyModuleApiContract
```

- `status` stays `z.string().nullable()`, not an enum. The only enum evidence
  found (`server/gviz/schemas/ordersView.js`'s JSON-Schema `enum:
  ['CONFIRM','SUBMITTED', null]`) looks stale/incomplete versus the
  React reference's six-value status list (`SUBMITTED | PENDING | APPROVED |
  CONFIRM | RECEIVED | COMPLETED`), and reads are never runtime-`.parse()`d
  in this engine anyway (see `api/CLAUDE.md` — "cell values are never
  runtime-validated"), so a wrong enum would silently lie about the type
  without being caught. `OrderCard.vue` needs a fallback badge for unknown
  status strings rather than assuming the six-value list is exhaustive.
- `MAX_ORDERS_PER_PAGE` (500, see schema above) exists because a real
  paginated envelope must exist — the frontend uses `apiGetList`, which
  expects `meta.pagination` — even though the UI likely never paginates in
  practice for one customer. The default MUST equal the max (see the
  perPage comment above), not the generic 20-item default other list
  endpoints use.

### 2.3 `server/modules/orders/`

- `order.contract.ts` — DB-side row schema, **key order = physical
  `OrdersView` column order** (confirmed from
  `server/gviz/schemas/ordersView.js`): `orderId, customerId, orderNumber,
  receivedDate, dueDate, serviceType, status, quantity, note, itemsJson,
  syncedAt, createdAt`. Columns are already camelCase (unlike the
  PascalCase sheets `customers`/`appointments` use) so the field map is
  effectively identity — declare it explicitly anyway per the "field map is
  load-bearing" rule. Do **not** derive this row schema from
  `orderListResponseSchema` — the API response has `items`, the sheet has
  `itemsJson`; they are different shapes on purpose.
- `orders.repository.ts` — a small class that does NOT extend
  `BaseRepository`/`GSheetRepository` (those hard-require create/update
  generics). Uses the shared GViz reader from §2.1 plus
  `deriveGVizColumns`/`GVizQueryBuilder` (already usable as-is from
  `server/shared/repositories/utils/gviz-query.builder`) to build a
  `WHERE customerId = '...' ORDER BY receivedDate <validated sortOrder>`
  query — the repository must honor `sortBy`/`sortOrder` from the validated
  query (both directions are legal per `orderListQuerySchema`, default
  `desc`), **not** hardcode `DESC` — fetch, and return raw DB rows
  (`Partial<OrderRow>[]`) with **no validation** (dirty cells must flow,
  matching the rest of the engine).
- `orders.mapper.ts` — pure functions, DB row → API row. Must be defensive
  end to end, not just around `JSON.parse` — the real sheet data can violate
  every assumption below, and any one bad row must degrade to safe defaults
  rather than throwing and 500ing the whole list (Codex caught two concrete
  ways the original draft mapper could still crash or silently corrupt data
  — folded in below):
  - `itemsJson` → `items[]`: `JSON.parse` in a try/catch. If parsing throws,
    **or** the parsed value is not an `Array`, result is `items: []`. Filter
    out array entries that are not plain objects before mapping (a `null`
    entry or a stray string/number in the array must not reach the
    per-item mapper). Raw item keys are snake_case (`id, description,
    service_type, quantity` per the handoff doc) → map to `id, description,
    serviceType, quantity`.
  - A shared `toNullableNumber(value)` helper used for both item `quantity`
    and order-level `quantity`: **`null`, `undefined`, and `''` must map to
    `null` explicitly before calling `Number(...)`** — `Number(null)` is
    `0` and `Number('')` is `0`, neither of which is `NaN`, so a bare
    `Number(...) || null`-style check silently turns a genuinely-missing
    quantity into `0` instead of `null`. After the explicit null/blank
    check, `Number(value)` → `Number.isNaN(result) ? null : result`.
  - order-level `quantity` (stored as string) → `toNullableNumber(...)`.
  - `receivedDate`/`dueDate`: **these come back as GViz `Date(Y,M,D)`
    literals**, not plain ISO text — confirmed via
    `server/gviz/gviz-utils.js`'s `dateColumns` set for `ordersView`
    (`receivedDate, dueDate, syncedAt, createdAt`) and its `gvizDateToISO()`
    helper (`Date(2026,6,21)` → `"2026-07-21"`, note the `+1` month
    correction for GViz's 0-indexed month). Port equivalent normalization
    logic into `orders.mapper.ts` (or a small shared date-serial util) —
    this is confirmed different from `customers`, which stores dates as
    plain ISO text (`api/CLAUDE.md` gotcha: "ISO strings compare
    correctly... no Date parsing needed"). That assumption does NOT hold for
    `OrdersView`, and — per §3.5 — is **not actually confirmed for
    `appointments` either**; do not assume `appointmentDate` is clean ISO
    just because the general CLAUDE.md gotcha says sheet dates usually are.
  - `orderNumber`/`serviceType`/`note`/`status`: pass through as-is
    (nullable).
- `orders.service.ts` — `OrdersService.list(query)`: `parseOrThrow(orderListQuerySchema,
  query)` → repository read (customerId + pagination) → map each row →
  project onto `orderListResponseSchema.shape` keys (same convention as
  `BaseCrudService.project()` — key-presence projection, not value
  validation) → `{ items, pagination }`.

### 2.4 `api/orders/index.ts`

GET only. **No `api/orders/[id].ts`.** The order-detail sheet always renders
from the already-loaded list item (the frontend never re-fetches a single
order), matching how React's `OrderDetailSheet` is in practice always
satisfied from the `getOrdersByCustomerId` cache. This is safe *only* as long
as: the history page always loads the list first, the detail sheet receives
the full order object (not just an id), the sheet is not independently
routable, and the list response already contains every field the sheet
needs. If any of those stop being true later (deep link to one order,
pagination that can exclude the selected order from the loaded page), a real
detail endpoint becomes necessary — not now.

```ts
// Same destructuring shape as api/customers/index.ts and api/appointments/index.ts
// — okPaged(items, pagination) takes two positional args, NOT a spread of
// the { items, pagination } result object (that isn't iterable).
export default new ApiHandler({
  GET: async (req) => {
    const { items, pagination } = await ordersService.list(req.query)
    return okPaged(items, pagination)
  },
}).handle
```

Adds exactly **one** Vercel function. Handoff doc estimated ~6 of 12 in use.

### 2.5 Environment — blocking prerequisite

`.env.local` currently has **no** `GVIZ_PORTAL_SPREADSHEET_ID` (or any
`GVIZ_*` var at all) — the legacy `ordersView` GViz-proxy source is
unconfigured in webapp-vue today, so live-data verification is not possible
until this is fixed. Add a new var following the existing
`APPOINTMENTS_SPREADSHEET_ID`/`CUSTOMERS_SPREADSHEET_ID` naming convention:

```
ORDERS_SPREADSHEET_ID=<the OrdersView / MagicwashPortal spreadsheet id>
```

**RESOLVED:** confirmed as `1ucqeUqRN25L4YF1GEnjP02ex_IohR1f8h8IwaP_EBRQ` —
cross-checked against `webapp-react/.env.local`'s `GVIZ_PORTAL_SPREADSHEET_ID`
(exact match with the `ordersView.js` header comment's candidate value) and
added to `webapp-vue/.env.local` as `ORDERS_SPREADSHEET_ID`. Sheet name to
query is `OrdersView` (confirmed in `gviz-utils.js`'s `SOURCE_MAP`).

**Second, unrelated env gap — STILL OPEN, does not block this feature:**
`appointment.module.ts` and `customer.module.ts` both call
`requireEnv('APPSCRIPT_URL')` at import time (per `api/CLAUDE.md`: "every
backend module must use the shared Apps Script endpoint `APPSCRIPT_URL`").
`webapp-vue/.env.local` has no `APPSCRIPT_URL` key — only a differently-named
`APPSCRIPT_APPOINTMENT_URL` (a leftover from the older per-resource-URL
convention `webapp-react/.env.local` still uses: `APPSCRIPT_CUSTOMER_URL`,
`APPSCRIPT_APPOINTMENT_URL`, `APPSCRIPT_INVOICE_URL`). The new engine
consolidated to one shared dispatching endpoint (the repository POSTs
`{ action, sheet, data }` and expects the Apps Script `doPost` to route by
`sheet`), so simply renaming `APPSCRIPT_APPOINTMENT_URL` → `APPSCRIPT_URL`
is not safe to do blindly — that deployment may only know how to write the
Appointments sheet. **This orders module never calls Apps Script (read-only,
no create/update route), so it is not blocked by this gap.** It only matters
if the implementer needs to run the full local dev server to manually
exercise other pages (`/customers` PATCH, `/new-booking` writes) during the
end-to-end pass in §5 step 8 — those pre-existing modules will throw at
import if `APPSCRIPT_URL` is truly absent everywhere (it may still be set as
a Vercel project env var for deployed environments, untested here). Left as
a known open item for the human owner; do not guess a value.

---

## 3. Frontend

### 3.1 `src/shared/api/api-client.ts`

Add `apiGet<T>(path: string): Promise<T>` (single-resource GET, unwraps
`{ data }` without a pagination meta) — mirrors `apiGetList`'s error handling.
Needed for `getCustomerById`.

### 3.2 Services (`src/features/customers/services/`)

Kept under `customers/` rather than spinning up a full `src/features/orders/`
skeleton — nothing else needs an independent orders feature yet, and
`webapp-vue/CLAUDE.md` says not to create folders upfront that aren't needed.
The API contract itself still lives at `contracts/orders/` (domain-named,
independent of where the frontend code sits).

- `customer.service.ts` — add `getCustomerById(customerId)` via the new
  `apiGet`.
- `order.service.ts` (new) — `listOrdersByCustomer(customerId)` via
  `apiGetList(ORDERS_ENDPOINT, { query: { customerId }, querySchema:
  orderListQuerySchema })`.
- `waiting-pickup.service.ts` (new — **not** `appointment.service.ts`; Codex's
  point: a generic "appointment service" name is domain-wide, but this is a
  customer-scoped read for one screen. Promote to `src/features/appointments/`
  only if/when appointments gets an independent Vue UI elsewhere).
  `listAppointmentsByCustomer(customerId)` via `apiGetList('/api/appointments',
  { query: { customerId, perPage: MAX_APPOINTMENTS_PER_PAGE }, querySchema:
  appointmentListQuerySchema })` — **`perPage` must be passed explicitly in
  this actual call, not left to the schema default** (the shared default is
  20, see the perPage comment in §2.2; omitting it here would silently
  fetch only 20 appointments). Returns raw appointment DTOs, unfiltered.
  Filtering happens in the store
  (§3.3), not the service, so the "this is a temporary client-side filter"
  boundary is visible in one place.

### 3.3 Store — `src/features/customers/stores/customer-order-history.store.ts`

Every other feature page in this codebase loads through a store
(`CustomerListPage.vue` → `customer.store.ts`, `InvoiceListPage.vue` →
`invoice.store.ts`); page-local state calling three services directly would
be an architectural outlier. Add a store that owns:

- `customer`, `orders`, `appointments` (raw, unfiltered) refs.
- **Independent loading/error state per source** — `Promise.allSettled`,
  not `Promise.all` — so a waiting-pickups fetch failure does not blank out
  the customer header or order list (this is a real React behavior being
  ported, not a nicety: React treats the three loads as independently
  non-fatal).
- `load(customerId, force = false)` / `refresh()`.
- A `waitingPickups` computed applying the **temporary, documented**
  client-side filter (see §3.5) over `appointments`.

Sheet-open state and the currently-selected order stay page-local UI state
(not store state) — only data-loading concerns belong in the store.

### 3.4 Components (`src/features/customers/components/`)

- `OrderHistoryCustomerCard.vue` — name / phone / address / type badge +
  Schedule Pickup button. On click: `selectedCustomerStore.select(customer)`
  then `router.push('/new-booking')` — this exact handoff already exists in
  `CustomerCard.vue`'s `openNewBooking()`; reuse the same shape, don't
  reinvent it (this was missing from the original plan draft — Codex caught
  it).
- `OrderList.vue` — "Order History" header, order count, **manual refresh
  button** (calls `store.refresh()`), collapse toggle. Renders
  `WaitingPickupCard` rows first, then `OrderCard` rows (matches React's
  `OrderList.jsx` ordering).
- `WaitingPickupCard.vue` — read-only row (date, status badge, time slot),
  deliberately **not clickable** — no `@click`, no hover affordance.
- `OrderCard.vue` — `receivedDate`, status badge (with a fallback
  presentation for statuses outside any known label map — status is a loose
  string, see §2.2), `quantity`, `note || serviceType`, a photo icon button.
  The photo button is a **separate tap target that does not select/open the
  order** (matches React's `OrderCard.jsx` — clicking the photo icon calls
  `onViewPhotos` directly, it does not also fire row selection). Row click
  (anywhere else) opens `OrderDetailSheet` for that order.
- `OrderDetailSheet.vue` — Teleport bottom sheet, same structural pattern as
  `src/features/invoices/components/PaymentHistorySheet.vue` (`Teleport to
  body`, `fixed inset-0` backdrop, `rounded-t-2xl` panel, `open` prop +
  `close` emit). Shows `orderId`, **`receivedDate` → `dueDate`** (both, not
  just one), items (collapsible per React), `note`, and a **View Photos**
  button → `router.push('/gallery/AFT-' + orderId)`. No Schedule Delivery
  button in MVP (cut per §1) — omit entirely rather than rendering a
  disabled stub.

### 3.5 Waiting-pickups filter — documented temporary exception

Per the locked decision in §0, this stays client-side for MVP. Port
directly from React's `filterWaitingPickups`:

```
appointmentType === 'PICKUP'
status ∈ { CONFIRMED, IN_TRANSIT }
appointmentDate >= today (Asia/Bangkok)
sorted ascending by date
```

**Known correctness gaps to leave a comment about** (from Codex's review —
do not silently fix these by expanding scope, but do not hide them either):

- `appointmentListResponseSchema` has no `deletedAt` field and
  `appointment.module.ts` does not filter deleted rows server-side, so a
  soft-deleted appointment can currently appear in "waiting pickups." React
  explicitly excludes deleted rows.
- The query schema supports only one `status` value and no date range, so
  this fetch pulls ALL of a customer's appointments (no status/date filter
  at the API layer) and filters client-side — for a customer with many
  appointments this is fine in practice (small per-customer counts) but the
  generic list endpoint caps at 100 total per page across everything, which
  is a latent correctness bound worth knowing about.
- Write unit tests for: excluded/never-appears deleted rows (currently
  impossible to exclude — test should document the gap, not assert false
  correctness), both active statuses, the Bangkok date boundary (today vs.
  yesterday vs. tomorrow local time), malformed/missing `appointmentDate`,
  and sort order.
- **`appointmentDate` may not be a clean ISO string — verify against live
  data before writing the `>= today` comparison.** `api/CLAUDE.md`'s gotcha
  ("ISO `YYYY-MM-DD` strings compare correctly with `<=`") is a general
  rule, but three pieces of evidence suggest `appointmentDate` specifically
  might not satisfy it: `server/gviz/schemas/appointments.js`'s
  `dateColumns` set includes `appointmentDate` (the legacy proxy treats it
  as a GViz date-serial column needing `Date(Y,M,D)` → ISO conversion, see
  `gviz-utils.js`'s `gvizDateToISO`); the **new** engine's
  `gsheet.repository.ts.tableToRows()` does no such conversion — it passes
  `cell.v` through unchanged for every column, dates included; and an
  existing test fixture (`appointment.transformer.dry-test.ts`) uses
  `AppointmentDate: '1 Apr 2026'` as a sample value, which is neither ISO
  nor a `Date(...)` literal. Before implementing the `>= today` filter,
  fetch a real `GET /api/appointments?customerId=...` response and inspect
  the actual `appointmentDate` value shape. If it isn't reliable ISO, the
  frontend filter needs a defensive date parser (handle `Date(Y,M,D)`,
  `D MMM YYYY`, and ISO), not a bare string comparison — and this is a
  pre-existing gap in the already-shipped `appointments` module, not
  something introduced by this feature, so fixing the root cause
  server-side is out of scope for this plan; work around it client-side and
  flag it separately to the human owner.

### 3.6 Page — `CustomerOrderHistoryPage.vue`

`src/features/customers/pages/`. Reads `customerId` route param, calls
`store.load(customerId)` on mount, renders
`OrderHistoryCustomerCard` + `OrderList`, owns `selectedOrder`/`sheetOpen`
local refs, renders `OrderDetailSheet`.

### 3.7 Routing — `src/features/customers/routes.ts`

```ts
{
  path: '/customers/:customerId/orders',
  name: 'customer-order-history',
  component: () => import('./pages/CustomerOrderHistoryPage.vue'),
  props: true,
}
```

### 3.8 `BaseSwipeCard.vue` — required change, not optional

Confirmed gap (Codex read the actual component): `src/shared/components/
BaseSwipeCard.vue` today only exposes `snapCard()` and emits
`swipe-left`/`swipe-right`. It has no way to tell a consumer "the user just
tapped without dragging" vs. "the user just finished a drag gesture" vs. "the
card is currently snapped open." A plain `@click` on `CustomerCard.vue`'s
content would fire after every swipe gesture too, which is wrong.

Add a gesture-safe `tap` event to `BaseSwipeCard.vue` — emit `tap` only when
pointer movement stayed under a small threshold AND the card was not snapped
open at gesture start (a tap on a snapped-open card should close it via the
existing swipe-close behavior, not navigate). `CustomerCard.vue` listens for
`@tap` (not a raw `@click`) to navigate to order history.

**Acceptance cases** (all must be manually verified before this is
considered done):
- ordinary tap → opens order history
- swipe left → opens Call/Book/Nav panel, no navigation
- tapping Call/Book/Nav → does not navigate to order history
- tapping a snapped-open card → closes the panel, does not navigate
- mouse drag behaves the same as touch drag
- keyboard activation (if the card becomes a focusable/interactive element)
  still works

### 3.9 `AppHeader.vue`

`src/components/layout/AppHeader.vue` currently special-cases exact path
strings (`/pending`, `/customers`) for the close button. Add a case using the
**route name**, not a path prefix (params make path-string matching
fragile):

```ts
route.name === 'customer-order-history'
```

→ show a back button that explicitly pushes `{ name: 'customer-list' }`
(not just `router.back()` — a direct URL hit has no history to go back to).

---

## 4. Acceptance criteria

- [ ] Tap customer card (no drag) → `/customers/:id/orders`
- [ ] Swipe left still opens Call/Book/Nav; those buttons don't navigate
- [ ] Tapping a snapped-open card closes it, doesn't navigate
- [ ] Direct URL hit on `/customers/:id/orders` loads the customer via
      `getCustomerById` (not just store state) and renders correctly
- [ ] Schedule Pickup → `selectedCustomerStore` populated → `/new-booking`
      prefilled, same as the existing `CustomerCard.vue` Book action
- [ ] Waiting pickups render above orders, filtered per §3.5, not clickable
- [ ] If the waiting-pickups fetch fails, customer + orders still render
      (independent failure — verify with a forced network error)
- [ ] Order card tap → detail sheet; photo icon tap → gallery directly,
      does *not* also open the detail sheet
- [ ] Detail sheet shows `receivedDate` + `dueDate`, items, note, View
      Photos; no Schedule Delivery button
- [ ] View Photos → `/gallery/AFT-{orderId}`
- [ ] Header back button on the order-history route returns to `/customers`
- [ ] `GET /api/orders` with no `customerId` → 422, never "all orders"
- [ ] A row with malformed `itemsJson` → that order's `items: []`, doesn't
      500 the whole list
- [ ] No route anywhere can POST/PATCH against `OrdersView`
- [ ] Vercel function count increases by exactly 1 (`api/orders/index.ts`)

---

## 5. Build & verification sequence

1. **Confirm `ORDERS_SPREADSHEET_ID`** with the human owner (§2.5) — blocks
   everything else that touches live data.
2. Backend: `ReadOnlyModuleApiContract` + extracted shared GViz reader +
   `orders` module, with unit/fixture tests for the mapper (date
   normalization, quantity coercion, item key mapping, malformed JSON,
   required-customerId validation) — write these against fixture rows first,
   confirm against live `OrdersView` data second.
3. `api/orders/index.ts` wiring + a manual smoke test against the real sheet.
4. Frontend contracts + services + `apiGet` addition.
5. `BaseSwipeCard.vue` tap fix + `CustomerCard.vue` wiring — manually verify
   all six acceptance cases in §3.8 before building the page around it.
6. Store + page + components, including the waiting-pickups filter and its
   unit tests.
7. `AppHeader.vue` + routing.
8. Full manual E2E pass: customer list → history → detail sheet → gallery →
   back; direct history URL; Schedule Pickup handoff into `/new-booking`.

---

## 6. Reference files

**React (behavior/UI source):** `webapp-react/src/pages/CustomerOrders.jsx`,
`webapp-react/src/components/customer-orders/*`,
`webapp-react/src/api/{orderApi,customerApi,appointmentApi}.js`.

**Vue (read before touching):** `src/features/customers/**`,
`src/shared/components/BaseSwipeCard.vue`, `src/shared/stores/
selected-customer.store.ts`, `src/router/index.js`, `src/components/layout/
AppHeader.vue`, `src/features/invoices/components/PaymentHistorySheet.vue`,
`contracts/{customers,appointments}/*-api.schema.ts`,
`server/modules/{customers,appointments}/*`,
`server/shared/repositories/{base.repository.ts,gsheet.repository.ts}`,
`server/shared/services/base-crud.service.ts`, `server/gviz/{gviz-utils.js,
schemas/ordersView.js}`, `api/CLAUDE.md`, root `CLAUDE.md`, this repo's
`.agent-docs/customer-order-history-handoff.md`.
