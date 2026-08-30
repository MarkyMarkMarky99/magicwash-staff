# Order (display lane) — API contract

Module `orders`. Reads `OrdersView` in the **portal workbook** (`PORTAL_SPREADSHEET_ID`), a sheet
Apps Script materialises on an unmeasured interval. Read-only, browse-oriented, and **unchanged by
the orders backend plan** — see [`docs/plans/orders-backend.md`](../../../plans/orders-backend.md).

For the live staff endpoints (create an order, read it back immediately, add items or photos) see
[`work-order.md`](./work-order.md), [`order-item.md`](./order-item.md) and
[`order-image.md`](./order-image.md).

## `GET /api/orders` — list

Query
- `customerId` — string, **required**
- `keyword` — string, default `''` (no-op; `searchFields` is empty)
- `page` — number, default from the shared pagination defaults
- `perPage` — number, max 500 → over that is 422, not clamped
- `sortBy` — `receivedDate` only, default `receivedDate`
- `sortOrder` — `asc` | `desc`, default `desc`

Response `200 { data: OrderListResponse[], meta.pagination: { page, perPage } }`
- `orderId` — string (`OrdersView.order_id`)
- `customerId` — string
- `orderNumber` — string | null
- `invoiceNumber` — string | null
- `receivedDate` — string | null
- `dueDate` — string | null
- `serviceType` — string | null
- `status` — string | null
- `quantity` — number | null
- `note` — string | null
- `items` — `OrderItem[]`, decoded from the `items_json` column

`OrderItem` (this lane's own shape — not the staff `OrderItemResponse`)
- `id` — string | null
- `description` — string | null
- `serviceType` — string | null
- `quantity` — number | null

Notes
- no `customerName`; the callers already know which customer they are looking at
- no `total` / `totalPages`; there is no COUNT query
- `items` is as fresh as the last Apps Script sync, not as fresh as `OrderItemForms`

## Not available

- `GET /api/orders/:id` — the contract declares no `response.detail`, so `createCrudRoutes` attaches
  no item handler and the route is 404 `Route not found`. Nothing in the frontend calls it; the
  Order Sheet overlay picks its order out of the already-loaded list instead. Use
  `GET /api/work-orders/:id` when a live single order is needed.
- `POST` / `PATCH` / `DELETE` — 405. This lane never writes; `OrdersView` is a materialised view.

## Live callers

- `src/features/customers/services/order.service.ts:8`
- `src/features/invoices/services/invoice-create-context.service.ts:23`

Eight more files import types from `@contracts/orders/order-api.schema` without calling the
endpoint. The project has no frontend type-check, so a change to this contract's shape ships green
and breaks on screen — that is why the plan leaves it alone.
