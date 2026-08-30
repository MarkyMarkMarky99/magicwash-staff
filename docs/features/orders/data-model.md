> Status: PLANNING — not implemented.

# Order Data Model

Row counts and null counts below were measured over every row of the live sheets on 2026-08-30.

## OrderForm

Sheet: ORDERS_SPREADSHEET_ID, 21 columns, A–U. Registered at
`server/sheets/OrderForm/OrderForm.db-contract.ts`, primary key `id`,
`writes: { append: false, update: true, delete: false }`, `audit.onUpdate: ['updated_at']`,
`valueInput: { updated_at: 'USER_ENTERED' }`.

| Column name | Type | Required (registry `OrderForm.json`) |
|---|---|---|
| id | string | yes |
| order_number | string \| null | no |
| customer_id | string | yes |
| received_date | string | yes |
| due_date | string | yes |
| service_type | enum `WSIR \| IRON` | yes |
| status | enum `PENDING \| RECEIVED \| SUBMITTED \| APPROVED \| COMPLETED \| CANCELLED` | yes |
| quantity | number \| null | no |
| hangers | number \| null | no |
| bags | number \| null | no |
| hangers_image | string \| null | no |
| bags_image | string \| null | no |
| form_image | string \| null | no |
| note | string \| null | no |
| timestamp | string \| null | no |
| created_by | string \| null | no |
| updated_at | string \| null | no |
| updated_by | string \| null | no |
| invoice_id | string \| null | no |
| order_name | string \| null | no |
| order_description | string \| null | no |

- The db-contract row schema and the registry agree: `id, customer_id, received_date, due_date,
  service_type, status` are all non-nullable. `forms/create-order.md` marks them required.

## OrderItemForms

Sheet: ORDERS_SPREADSHEET_ID, 15 columns, A–O, 23,165 rows. Not registered in `server/sheets/`.
No registry JSON exists for it (`OrderItem.json` describes a different sheet, `OrderItems`).
Registration with `writes: { append: true, update: false, delete: false }` is designed but not
implemented, on branch `feat/register-order-sheets`.

| Column name | Type | Nulls | Notes |
|---|---|---|---|
| id | string | 1,074 | all nulls are phantom rows |
| order_id | string | 1,087 | |
| item_id | string | 3,532 | |
| description | string | 1,151 | Thai text |
| quantity | number | 0 | decimal |
| price | number | 2,495 | decimal |
| credits_used | number | 5,619 | decimal; 169 rows are non-integer |
| timestamp | datetime | 1,074 | |
| category | string | 2,274 | `Tops`(11734), `Bottoms`(5510), `Home Textile`(2237), `Others`(1409), `Bedding`(1) |
| service_type | string | 3,369 | mixed Thai/English labels — see Known data debt |
| special_instructions | string | 23,155 | effectively unused |
| created_by | string | 23,162 | effectively unused |
| updated_at | datetime | 2,483 | |
| updated_by | string | 2,482 | |
| invoice_item_id | string | 23,165 | entirely empty column |

## OrderImages

Sheet: ORDERS_SPREADSHEET_ID, 10 columns, A–J, 17,376 rows. Not registered in `server/sheets/`.
Registry `OrderImages.json` exists, primary key `id`, required `id` and `order_id` only.
Registration with `writes: { append: true, update: false, delete: false }` is designed but not
implemented, on branch `feat/register-order-sheets`.

| Column name | Type | Nulls | Notes |
|---|---|---|---|
| id | string | 0 | |
| customer_id | string | 546 | |
| delivery_id | string | 17,365 | effectively unused |
| order_id | string | 0 | |
| image_type | string | 1,329 | free string, 13 distinct values — see Known data debt |
| image_path | string | 2 | full Firebase Storage URLs on newer rows; legacy relative paths `OrderForm_Images/<id>.form_image.<n>.jpg` on older ones |
| notes | string | 16,680 | |
| quantity | number | 13,258 | decimal weight (e.g. `20.5`, `8.7`), not a count |
| created_at | datetime/string | 3 | ISO with `Z` on newer rows; `dd/MM/yyyy HH:mm:ss` on older |
| created_by | string | 17,365 | effectively unused |

## OrdersView

Read-only materialised view on PORTAL_SPREADSHEET_ID, 13 columns. Registered at
`server/sheets/OrdersView/OrdersView.db-contract.ts`, primary key `order_id`, all writes `false`.
Built by Apps Script from `OrderForm` and its item rows.

| Column name | Type |
|---|---|
| order_id | string |
| customer_id | string |
| order_number | string \| null |
| invoice_number | string \| null |
| received_date | string \| null |
| due_date | string \| null |
| service_type | string \| null |
| status | string \| null |
| quantity | number \| null |
| note | string \| null |
| items_json | string \| null |
| synced_at | string |
| created_at | string \| null |

### What the view carries and does not carry

- Carries, from `OrderForm`: `order_id`, `customer_id`, `order_number`, `received_date`,
  `due_date`, `service_type`, `status`, `quantity`, `note`.
- Carries, denormalised: `invoice_number`, and `items_json` — decoded by
  `ordersViewJsonColumns` into the `items` array of the API DTO.
- Carries, view-only: `synced_at`, `created_at`.
- Never had, by design: `hangers`, `bags`, `hangers_image`, `bags_image`, `form_image`,
  `timestamp`, `created_by`, `updated_at`, `updated_by`, `invoice_id`, `order_name`,
  `order_description`.
- Never had, by design: any `OrderImages` column.
- Each `items_json` entry decodes to `{ id, description, serviceType, quantity }` only. The other
  `OrderItemForms` columns — `item_id`, `price`, `credits_used`, `timestamp`, `category`,
  `special_instructions`, `created_by`, `updated_at`, `updated_by`, `invoice_item_id` — are not on
  the view.
- Any UI that needs a field the view lacks is fixed in the API, never re-derived in the frontend.

## Current GET /api/orders

Contract: `contracts/orders/order-api.schema.ts`. Module: `server/modules/orders/order.module.ts`.

Query params:

| Param | Rule |
|---|---|
| keyword | `z.string().default('')` — no-op; `ordersService` has `searchFields: []` |
| customerId | `z.string().trim().min(1)` — required |
| page | positive int, default 1 |
| perPage | positive int, max and default 500 (`MAX_ORDERS_PER_PAGE`) |
| sortBy | `'receivedDate'` only |
| sortOrder | `'asc' \| 'desc'`, default `'desc'` |

DTO (`orderListResponseSchema`): `orderId`, `customerId`, `orderNumber`, `invoiceNumber`,
`receivedDate`, `dueDate`, `serviceType`, `status`, `quantity`, `note`, `items[]`.
Each item (`orderItemSchema`): `id`, `description`, `serviceType`, `quantity`.

- `status` and `serviceType` are free nullable strings in the API contract, not enums.
- The contract declares `query.list` and `response.list` only — no `request.create`, no
  `response.detail`, no update slot.

## service_type — canonical values

The UI offers exactly these four:

```
WSIR, IRON, DRCL, WASH
```

## Known data debt

Recorded for reference only. Not in scope, not scheduled, and no cleanup is proposed.

- `OrderForm.db-contract.ts` and registry `OrderForm.json` declare `service_type` as
  `WSIR | IRON`, narrower than the canonical four. A create or update endpoint that accepts `DRCL`
  or `WASH` requires that row enum to be widened first — a backend change outside this plan.
- Live `OrdersView` rows contain `DRCL`.
- Live `OrderItemForms.service_type` (23,165 rows) holds Thai and English labels for overlapping
  concepts: `ซักรีด`(11350), `WSIR`(5522), `รีดผ้า`(846), `ซักแห้ง`(648), `ซักพับ`(579),
  `IRON`(366), `DRCL`(258), `WASH`(227), plus 3,369 blanks.
- 1,074 `OrderItemForms` rows are blank in every column except `quantity`, which reads `0.0`
  because a fill-down in column E extends past the real data; they are scattered from row index 5
  to 20,640, not contiguous at the end.
- `OrderItemForms.invoice_item_id` is empty across all 23,165 rows.
- `OrderImages.image_type` is a free string with 13 distinct values across 17,376 rows:
  `BAG`(8772), `WEIGHT`(3986), `DOCUMENT`(2282), `FORM`(295), `PICKUP`(271), `HANGERS`(146),
  `HANGER`(132), `DELIVERED`(120), `PickupConfirmation`(32), `BAGS / BASKETS`(6), `DELIVERY`(2),
  `GARMENT`(2), `Document`(1), plus 1,329 blanks. No enum is defined and none is proposed.
- `OrderImages.image_path` and `OrderImages.created_at` each hold two coexisting formats; any
  consumer must accept both.
