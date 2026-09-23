# Work order (staff lane) — API contract

Module `work-orders`. Reads and writes `OrderForm` in the orders workbook
(`ORDERS_SPREADSHEET_ID`). Customer display names are resolved in the frontend from the customer
store; the work-order API returns only the `OrderForm.customer_id` value as `customerId`.

Source: the orders API contract and the contract conventions.
The id field is `orderId`, not `workOrderId`: `OrderForm.id` and `OrdersView.order_id` hold the same
value for the same job (verified live, e.g. `117ac0a1`).

## `GET /api/work-orders` — list

Query
- `customerId` — string, optional → omitted means an unfiltered list
- `status` — string, optional, free string on the API side (the db column is a 6-member enum;
  the API stays open so an out-of-enum legacy row cannot 422 the list)
- `keyword` — string, default `''`, searched across order id, order number, customer id, and invoice number
- `page` — number, default from the shared pagination defaults
- `perPage` — number, max 500 → over that is 422, not clamped
- `sortBy` — `receivedDate` only, default `receivedDate`
- `sortOrder` — `asc` | `desc`, default `desc`

Response `200 { data: WorkOrderListResponse[], meta.pagination: { page, perPage } }`
- `orderId` — string
- `customerId` — string
- `orderNumber` — string | null
- `invoiceNumber` — string | null (from `OrderForm.invoice_id`, which holds the invoice number)
- `receivedDate` — string | null
- `dueDate` — string | null
- `serviceType` — string | null
- `status` — string | null
- `quantity` — number | null
- `note` — string | null

Notes
- **no `items`** — `OrderForm` has no `items_json`, and fetching lines per row would be one read per
  order. A list screen that needs an item count cannot get it here; see the plan's Risks.
- `customerName` is not part of the work-order response; order screens resolve it from the cached
  customer store and fall back to `customerId` while the customer list is unavailable

## `GET /api/work-orders/:id` — detail

Path
- `id` — `OrderForm.id`

Response `200 { data: WorkOrderDetailResponse }` — every list field, plus
- `orderName` — string | null
- `orderDescription` — string | null
- `formImage` — string | null
- `hangersImage` — string | null
- `bagsImage` — string | null
- `createdBy` — string | null
- `items` — `OrderItemResponse[]`, read live from `OrderItemForms` via the order-items module

Errors
- blank / whitespace id → 400 `id is required`
- not found → 404 `Resource '<id>' not found`
- more than one row → 409
- 3+ path segments → 404 `Route not found`

An order created through `POST` is readable here immediately — no Apps Script sync is in the path.

## `PATCH /api/work-orders/:id` — update header

Request
- `status` — `PENDING` | `RECEIVED` | `SUBMITTED` | `APPROVED` | `COMPLETED` | `CANCELLED`, optional
- `receivedDate` — `YYYY-MM-DD` string, optional
- `dueDate` — `YYYY-MM-DD` string, optional
- `quantity` — nonnegative number or `null`, optional; this is `OrderForm.quantity`, not per-line `OrderItemForms.quantity`
- `updatedBy` — nonempty string, required

At least one of the four mutable fields must be present. No other order field is updatable.
The date columns are strings in the OrderForm DB contract. Any valid status value is accepted
without transition guards. The repository stamps `updated_at`; order-item rows remain append only.

The response is the updated work-order list/header shape plus:

- `ticketProvisioning.ticketsCreated` — number of ticket rows whose batch append was confirmed
- `ticketProvisioning.skippedGarments` — garments that could not be routed, with `laundryItemId`,
  `serviceType`, and a `missingLaundryItemId` or `unsupportedServiceType` reason
- `ticketProvisioning.failure` — `null`, or `{ certainty: 'rejected' | 'unknown' }`

For updates without an explicit `APPROVED` status, ticket provisioning is not run and the nested result contains
zero created tickets, no skipped garments, and no failure. After an `APPROVED` status write, the
service reads LaundryPhotos, OrderItemForms, and existing JobTickets, builds every missing
item-scoped department ticket, and uses one batch append. Existing garment/department pairs are
not appended again, so a repeated approval can fill tickets for a garment tagged later.

The status write is not rolled back if provisioning fails. A rejected append confirms that no
ticket batch landed. An unknown append outcome must not be retried automatically because the batch
may have landed even though its response could not be confirmed.

Errors
- invalid status, date format, quantity, or empty update payload → 422
- not found → 404 `Resource '<id>' not found`

## `POST /api/work-orders` — create

Request
- `customerId` — string, required
- `receivedDate` — string, required
- `dueDate` — string, required
- `serviceType` — enum `WSIR` | `IRON` | `DRCL` | `WASH`, required
- `quantity` — number ≥ 0, nullable, default `null`
- `note` — string, nullable, default `null`
- `orderName` — string, nullable, default `null`
- `orderDescription` — string, nullable, default `null`
- `createdBy` — string, required
- `items` — `WorkOrderCreateItem[]`, default `[]` (the order-item create body minus `orderId` and
  `createdBy`; it carries no `serviceType` — the header's applies to every line). Each item quantity
  is a positive whole-number garment count.
- not accepted: `orderId`, `orderNumber`, `status`, `invoiceNumber`, `timestamp`, `updatedAt`,
  `updatedBy`

Response `201 { data: WorkOrderCreateResponse }`
- `orderId` — string (server-generated)
- `orderNumber` — string | null
- `customerId` — string
- `receivedDate` — string | null
- `dueDate` — string | null
- `serviceType` — string | null
- `status` — string | null (always `PENDING` on create)
- `quantity` — number | null
- `note` — string | null
- `createdAt` — string | null (stamped by `audit.onAppend`)
- `createdBy` — string | null
- `itemsRequested` — number
- `itemsCreated` — number
- `itemsFailed` — boolean
- `itemsError` — string | null

Behaviour
- `orderId` is generated by `generateShortId()` (`shared/utils/id.ts`) — an 8-character
  lowercase hex id with **no prefix**, matching the live `OrderForm.id` column
- the header row is appended first; if that fails nothing is written and the error propagates
- items are appended in one batched request; if they fail after a successful header the response is
  still 201 with `itemsFailed: true` and `itemsCreated: 0`, and the order is completed from the
  detail screen
- there is no transaction and no rollback — **never retry a failed create**, it can duplicate the
  order
- the appended `timestamp` is `yyyy-MM-dd HH:mm:ss` while legacy cells are `dd/MM/yyyy HH:mm:ss`;
  `BANGKOK_TIMESTAMP_PATTERN` rejects anything else, so the two formats coexist

## Not available

- `DELETE` — 405; `writes.delete` stays `false`
