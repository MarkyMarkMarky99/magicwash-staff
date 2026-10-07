---
last_audited: 2026-09-07
audit_sources:
  - api/[...path].ts
  - server/api/route-registry.ts
  - server/shared/http
  - server/shared/repositories
  - contracts/shared/api.schema.ts
---

# Backend Operations and API Conventions

## Runtime and imports

Vercel treats every JavaScript or TypeScript file under `api/` as a serverless function. Keep the
single gateway at `api/[...path].ts`; gateway, registry, modules, and helpers live outside `api/`.

Backend code has no path aliases. Every relative import or export specifier, including dynamic
imports in `server/api/route-registry.ts`, uses an explicit `.js` extension. Type checking and
`vercel dev` do not reliably detect a missing extension under the native ESM production runtime;
run a real Vercel build or deployment before accepting a change that affects backend module imports.

## Contracts and validation

- Feature API schemas and enums live in `contracts/<feature>/`; they satisfy
  `ModuleApiContract`. Shared response envelope schemas, error codes, and pagination metadata live
  in `contracts/shared/api.schema.ts`.
- API contracts are camelCase and never import database shapes. Database schemas, repository types,
  services, and handlers never live in `contracts/`.
- Validate every public service boundary with `parseOrThrow`; invalid input returns HTTP 422. Use
  Zod coercion, defaults, and refinements in the public schema rather than casts or duplicated
  private validation. Derive types with `z.input`/`z.infer`.
- Build success and error envelopes only through `ok`, `created`, `okPaged`, and `ApiError`; do not
  create parallel envelope types.

## Modules, mapping, and reads

Routes use `createCrudRoutes(service, api)` unless the flow is genuinely nonstandard. Modules own
`fieldMap` and `jsonColumns`; repositories know only physical database column names and never
import contracts or modules. Complex joins, multi-sheet workflows, and nonstandard outcomes use a
dedicated module service.

`BaseCrudService` validates the list query, reserves keyword/page/perPage/sort fields, maps other
query fields to `where`, maps API fields to database fields, and projects responses through the API
response schema. Keep custom query paths only for different semantics and test them.

The Items master uses the `Items` tab in `PRICE_LIST_SPREADSHEET_ID` and exposes `GET /api/items`,
`GET /api/items/:id`, `POST /api/items`, and `PATCH /api/items/:id`. Its API contains item identity,
classification, display names, active state, and image URL; pricing and service fields remain in
PriceList. Collection reads include inactive items unless `active=true` or `active=false` is supplied.
Creates assign an eight-character lowercase alphanumeric `id`, the next `ITM-####` code after the
largest numeric suffix currently readable in Items, nullable fields as null, and `active=true` by
default. Client-provided `id` and `itemCode` are rejected. The read-then-append code allocation
has a cross-instance race because Sheets provides no atomic sequence operation; callers must not
assume concurrent creates receive distinct codes. `POST /api/price-list` is deliberately disabled
with 405 and `Allow: GET`; PriceList GET and PATCH remain available. This stops new PriceList rows
from allocating item codes independently of Items while preserving its physical sheet structure.
Items serializes nullable write fields as empty cells so PATCH with null clears an existing value;
its response transformer returns those blank optional fields as null.

Legacy dirty cells must not become 500 responses. JSON view columns listed in `jsonColumns` decode
to their API fields with `[]` for malformed arrays and `null` for malformed objects; correct a
wrong materialized view in its Apps Script source rather than guessing in the API or frontend.

## Public delivery tracking

`GET /api/delivery-tracking/:orderImageId` serves the customer page opened from a bag-tag QR,
without login. It returns 404 unless the id is a `WEIGHT` OrderImages row. The response lists
every WEIGHT image of the same order as bags, ordered by weigh time, with the order's received
date and status label and its customer index; it never returns customer name, phone, or address.
Only `https://` image paths are returned; legacy relative paths become `null`. Delivery state
comes from the scanned bag's JobTickets id `LOG-<orderId>-<orderImageId>-LOG-BAG`: Completed
means Delivered with `deliveredAt` normalized from `completed_at` (null when empty); In Progress
means Out for delivery with no delivered time. Other states use the OrderForm status label.
Proof of delivery is the https image path of the newest same-order DELIVERY OrderImages row,
or null. Bags remain WEIGHT rows only. This endpoint does not read Appointments.

## Live portal reads

`server/modules/portal/` exposes read-only `GET /api/portal/orders` and
`GET /api/portal/invoices`, plus `GET /api/portal/customers/:customerId`, in the normal
success envelope, without pagination. The customer route returns `{ customer, orders,
invoices, appointments, packages }` or 404 for a missing customer. Customer and appointment
projections preserve React GViz scalar/date formats; appointments include every matching
row. Packages port CustomerPackageViewBuild.js, including transaction JSON, running credits,
and status computed at request time. The gateway supports an explicitly registered nested
item path for this route; other three-segment paths return 404.

The module reads each whole source sheet once through unauthenticated GViz, selecting only
required columns derived from database contract key order. All needed sheets load in parallel.
A module-local singleton caches each sheet for 60 seconds after completion and shares one
in-flight read across callers. Failures are not cached; the cache clock is injectable in tests.
Customer and identity filters apply before assembly, with related items/payments restricted
to those parents. It assembles the Apps Script OrdersView / InvoiceViewSync projections;
it never reads or writes a materialized view.
Orders accept optional `customerId` and `orderId`; invoices accept `customerId` and
`invoiceNumber`. Filters use exact string equality and preserve source invoice/order row order.

The contracts in `contracts/portal/` preserve React GViz field order, scalar values,
and JSON text, including blank source cells as empty strings inside nested JSON.
Orders copy physical OrderForm column S (`invoice_id`) to `invoiceNumber` and
`received_date` to `createdAt`. `syncedAt` is the request assembly date in Asia/Bangkok,
matching the live view's date-cell precision rather than its historical sync time;
the envelope `meta.timestamp` provides a full response timestamp.
GViz date/datetime cells become native Date objects for their Bangkok wall-clock time;
numbers stay numbers and null source cells become empty strings for assembly. GViz can
coerce mixed-column values to strings or suppress minority types entirely. The integration
source parity check accepts the captured old-reader JSON baseline and reports every selected
column's differences and nonblank-to-empty losses, excluding rows blank across all selected
columns for alignment. Such losses are not repaired. Normal repository reads remain live.
Top-level text columns stringify numeric identifiers as the live view's GViz
response does; nested JSON retains numeric values that GViz returns.
React's declared date columns become YYYY-MM-DD; native billing-period dates retain
GViz `Date(...)` values because React does not convert those columns. Native dates
inside JSON become UTC ISO strings, as Apps Script JSON.stringify serializes Date objects.

Invoice calculations deliberately belong to this module rather than the existing
InvoiceService: source `net_total` drives subtotal, invoice adjustments round at each
step, item adjustments keep an unrounded per-unit running amount, and only VERIFIED
payments affect paidAmount. All non-deleted payments remain visible. DRAFT and other
non-ISSUED statuses pass through, and cancellation does not zero the computed balance,
matching InvoiceViewSync.js. Deleted invoices are omitted. Historical materialized-view
row order, stale rows, and stale calculated values are not reconstructible from live sources.

## Sheets writes and certainty

Schema key order is physical column order for GViz reads; never reorder it cosmetically. Append
rows are full header width. Unspecified values normally serialize as `''`; repositories that preserve
nullable values send `null`, which the Values API skips. An append response can therefore report an
`updatedRange` that omits trailing blank cells. The landed-range check requires column A anchoring,
coverage of every submitted nonblank value, and no columns beyond the submitted width. Echo
normalization restores the full known width. General repository writes use Google Sheets API with `USER_ENTERED`;
`valueInput` declarations guard unsupported column intent and do not change the wire option. APPEND
writes complete rows and UPDATE patches changed columns, then verifies row identity.

A write response echoes the row as it was serialized for the wire, not as a read would return it.
Unspecified columns come back as `''` where a GViz read of the same row yields `null`, so a create
or update response can carry `''` for a field its API schema types as `boolean | null`. Write
responses are not runtime-validated, so this passes through to the caller. Measured on
`POST /api/laundry-photos` (2026-09-07): `checked` and `isActive` returned `''`, and the same row
read back through `GET` returned `null`. Treat a write response as write confirmation plus the
server-owned fields (id, audit timestamps); re-read when the caller needs read-shaped values.

Write outcomes distinguish rejected from unknown persistence. Never auto-retry a write after a
request was sent: a transport failure can follow a committed write and retry can duplicate data.
Token acquisition may be retried. Unsupported delete must fail rather than report false success.

`classifySheetWriteFailure` in `server/shared/repositories/write-failure.ts` is the single place that
maps a thrown write error to that certainty, and every module reads it from there. `WriteRejectedError`
and `DuplicateRowKeyError` are `rejected`, because nothing was stored. `WriteTransportError`,
`WriteCommittedUnreadableError` and `WriteRowIdentityMismatchError` are `unknown`, because the row may
have landed. An unrecognised error is `unknown`, never `rejected`: claiming `rejected` invites a retry
that duplicates data, so a new error class must be added to the classifier deliberately.

All sheet row writes use the Google Sheets API; there is no SheetLib or Apps Script row-write
fallback. `APPSCRIPT_INVOICE_VIEW_SYNC_URL` only recomputes `InvoicesView`. Browser photo upload
sends its image binary to Firebase Storage and then writes the row through this API like any other
module; the binary itself never passes through the backend.

Invoice printing uses the collection endpoint `POST /api/invoice-prints`. The backend forwards only
the invoice number to the shop print service. `PRINT_SERVER_URL`, `CF_ACCESS_CLIENT_ID`, and
`CF_ACCESS_CLIENT_SECRET` are server-only environment variables; Cloudflare Access credentials must
never be exposed to browser code or API responses.

`BAG_TAG_PRINT_ENABLED` enables one bag tag after each saved WEIGHT order image only when set to `true`; `BAG_TAG_TRACKING_URL_BASE` is the QR URL prefix concatenated with the saved image ID. The backend awaits POST /print-bag-tag with a 10-second timeout using the same print server credentials; failures are logged as `bag_tag_print_failure` and leave the save response unchanged.

Payments are a ledger. `POST /api/payments` appends a staff-recorded payment as `VERIFIED`, so it
counts toward the invoice at once; an invoice's paid amount, balance and `PAID` status are derived
from `VERIFIED` rows, never set on the invoice. `PATCH /api/payments/:paymentId` reviews only a
`PENDING` row (for example a slip the verifier could not read): `VERIFY` fills the amount and sets
`VERIFIED`, `REJECT` sets `FAILED` and requires a note. Staff notes are appended to the existing
note. Rows are never deleted, and any non-`PENDING` row is final (409).

Laundry tag printing uses the collection endpoint POST /api/laundry-tag-prints.
The order detail page sends the customerIndex, the order header quantity (or staff-adjusted tag count), and one
sequence/tagId pair per physical piece. The backend validates and forwards the
complete print body to the shop service's POST /print-order-tags using the same
server-only Cloudflare Access credentials. Tag IDs are currently generated in
the browser and are not persisted; barcode lookup is not part of this route.
Forwarding failures remain opaque to the browser and are logged server-side as
`laundry_tag_print_failure` JSON events. These events distinguish timeout, transport, HTTP,
JSON, schema, and count-mismatch failures and redact the print server URL and Access credentials.

## Environment and external state

The gateway leaves `portal` and `delivery-tracking` public. The `staff` module always verifies identity through
`authenticateIdentity`; missing or invalid Firebase ID tokens in the `Authorization: Bearer`
header return 401. Token verification uses Firebase's public keys for `FIREBASE_PROJECT_ID` and requires
a verified email, normalized by trimming and lowercasing. Missing or invalid tokens return 401.
The restricted `Staff` tab in `STAFF_SPREADSHEET_ID` is read through the authenticated Sheets
API, never GViz. The active allowlist includes only `admin` and `staff` roles and is cached
for 60 seconds. Successful staff POST and PATCH invalidate that instance's cache; an older
in-flight read cannot repopulate the cache after invalidation.

`GET /api/auth/me` still requires an active allowlist entry (403 otherwise) and returns its
staffId, email, name, and role. The staff module receives the verified email and, when listed, the
active StaffMember. Unregistered verified identities can still register and request their own row.
Every other module, including `auth`, requires approved staff through `authenticate`: missing or
invalid tokens return 401, and identities outside the active allowlist return 403. The approved
StaffMember is passed to the handler. Registry lookup returns 404 for unknown modules before
authentication; authentication completes before the registered module is loaded.

The sole business-route exception is `GET /api/invoices/:id`, with exactly two path segments.
It accepts an `x-print-api-key` header exactly matching the server-only `PRINT_API_KEY`, compared
with `crypto.timingSafeEqual` on equal-length buffers. An unset or blank environment key disables
this path. A matching key permits the request without a token and passes no StaffMember. Other
methods, invoice collection requests, and other modules still require approved staff.

`GET /api/work-transactions?from=yyyy-MM-dd&to=yyyy-MM-dd` requires approved staff. It reads the whole
WorkTransactions tab once and returns every row whose `created_at` falls in the inclusive Bangkok-day
period (shorter than 62 days). Each row carries `department`, derived from the job ticket id prefix
(`IRN-`, `WSH-`, …; null when unknown), and `staffId`, the worker credited: the row's own
`created_by` for EARN, and the same ticket's EARN `created_by` for ADJUSTMENT and VOID.

`GET /api/order-reports?period=day|week|month&date=yyyy-MM-dd` requires approved staff, reads the whole
OrderForm tab once and aggregates it in memory, including per-day detail in `days`; its rules are in `docs/features/orders/order-report.md`.

`GET /api/order-snapshots` requires approved staff and reads the whole OrderForm tab once, selecting only the list columns and timestamp, with no filters or pagination. It returns the order-list contract plus `createdAt`, drops blank order ids, trims customer ids, normalises date and timestamp fields, and sorts by received date descending (nulls last), then order id ascending. The order list and report share this uncached snapshot in the browser and reload it once per page activation. The browser adds a `request` sequence number to the URL so a reload after a write never joins an earlier in-flight GET; the server ignores it.

| Route | Authorization | Result |
| --- | --- | --- |
| `GET /api/staff/me` | Valid token | Own row including pending/inactive rows; 404 if absent |
| `POST /api/staff` | Valid token | Register own verified email; 201, or 409 for any existing email |
| `GET /api/staff` | Approved staff; verified identities without an approved StaffMember return 401 | Every row in the existing list response, with all columns and no role/active filtering; rows with nonempty Email include blank StaffIds |
| `GET /api/staff/:staffId` | Active admin | Staff row, or 404 |
| `PATCH /api/staff/:staffId` | Active admin | Updated row, or 404; own role/active fields return 409 |

Admin routes return 403 for callers outside the active admin allowlist. There is no staff
self-edit route. `contracts/staff/staff-api.schema.ts` validates registration name, phone,
and address as required trimmed nonempty strings. Email comes only from the token. Admin
patches require at least one editable field and reject Email/StaffId and unknown fields;
startDate is a valid `yyyy-MM-dd` date or an empty string. Invalid bodies return 422.

The staff service maps columns by live header name and uses authenticated SheetsApiClient
reads with `UNFORMATTED_VALUE`, coercing text cells with `String()`. StartDate numeric serials
use whole days from the Google Sheets epoch (1899-12-30) with UTC arithmetic; valid
`yyyy-MM-dd` strings are preserved, and other values become empty strings. Read rows are
mapped directly without strict response-schema parsing so a bad cell cannot break all staff
reads and patches. Request bodies remain schema-validated. The login reader reads A:I. Staff writes use `RAW` for every cell so phone numbers retain leading zeroes;
Active is a native boolean. Registration appends a full-width row with an unprefixed
`generateShortId()`, blank Role/Position/StartDate, and Active false. PATCH writes only the
provided columns. Rows with empty Email are absent; legacy owner rows with empty StaffId
remain visible but cannot be addressed by an empty ID. Duplicate email lookup is
case-insensitive; Sheets provides no atomic unique-email constraint across concurrent requests.

The app prefetches appointments, customers, staff, and prices once, on its first signed-in state,
to prepare business data and map StaffIds to names. Frontend routes other than login and staff
registration await auth readiness and require signed-in status, redirecting other sessions to
login with the requested full path in the redirect query. Frontend writes record
the signed-in StaffId as actor, or `unknown` when signed out; `?by=` is ignored.

`FIREBASE_PROJECT_ID` and `STAFF_SPREADSHEET_ID` are server-only environment variables.

Repository getters are lazy, memoized module singletons. Each reads its workbook environment key on
first use; writable sheets also need `GOOGLE_SERVICE_ACCOUNT_KEY`. Server environment variables
never use `VITE_` prefixes.

The Google Sheets schema registry at `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` is
read-only and is the single source of truth, shared by other projects. When the live sheet
conflicts with it, stop and have the user update the registry; never rewrite the registry to match
code. Do not alter the separate Python project's similarly named environment
variables or spreadsheet bindings.

## Backend verification

Run relevant `tests/server/` dry tests with `npx tsx <path>` and run `npm run typecheck:api` for
every backend change. Type-only tests are enforced by `typecheck:api`, not `tsx`. Before deploying a
sheet contract change, run:

```sh
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
```

Also run `git diff --check`. A green typecheck and dry tests do not prove live sheet parity or
production ESM resolution.

## Comments

Comments document durable decisions, invariants, and dangerous constraints. Do not put phase
numbers, plan status, future wiring claims, or other expiring project status in source code. Update
comments that describe changed behavior in the same change; prefer an executable guard or test when
the rule can be enforced.
