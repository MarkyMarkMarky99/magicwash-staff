> Status: PLANNING — not implemented.

# Create Order Form

## Route

Route: /orders/new — name `order-create`, meta `{ parent: 'order-list' }`

Page: OrderCreatePage.vue — component name `OrderCreatePage`, added to the `src/App.vue` KeepAlive
`exclude` list; uses `onMounted`, never `onActivated`/`onDeactivated`

Purpose:
สร้าง Order ใหม่

## User-filled fields

| Field | Required | Component | Validation |
|---|---|---|---|
| customer_id | yes | feature-local customer picker | A customer must be selected; the raw ID is never typed |
| received_date | yes | FormInput | Valid date |
| due_date | yes | FormInput | Valid date |
| service_type | yes | FormOptionGrid | One of `WSIR`, `IRON`, `DRCL`, `WASH` |
| quantity | no | FormInput | Empty or numeric |
| hangers | no | FormInput | Empty or numeric |
| bags | no | FormInput | Empty or numeric |
| note | no | FormTextarea | Optional text |
| order_name | no | FormInput | Optional text |
| order_description | no | FormTextarea | Optional text |

- `due_date` and `service_type` are **required**. Registry `OrderForm.json` lists them under
  `required`, and `OrderForm.db-contract.ts` types both as non-nullable. The form follows the
  registry.
- The four `service_type` options are the canonical domain values. See the Known data debt section
  in `data-model.md` for the consequence: the `OrderForm` row enum currently accepts only
  `WSIR | IRON`, so a create endpoint must widen it before `DRCL` or `WASH` can be stored.
- The customer picker is a SHARED GAP — `CustomerPicker.vue` is feature-local to
  `customer-packages` and cannot be imported across features. See SHARED GAPS 5 in `overview.md`;
  the option is not decided.
- No frontend status, total, relation, or enum derivation.

## Server-filled fields

Not form fields:

- id
- order_number
- status
- timestamp
- created_by
- updated_at
- updated_by
- invoice_id

- **Proposal, not a fact:** the future create endpoint sets `status` to `PENDING` on append. Nothing
  defines this today — there is no create endpoint and no `request.create` schema, so no default
  exists anywhere in the contract, the db-contract, or the registry.

## Submit flow

1. Component collects the listed user-filled fields.
2. `OrderCreatePage` validates required and basic field values.
3. Store submits the API-shaped request through the order service.
4. Service calls `apiPost('/api/orders', …)`.
5. API fills the server fields and returns the API DTO.

- No frontend mapper layer.

## Blockers

⛔ BLOCKED — `POST /api/orders` does not exist. `orderApiContract` declares no `request.create`, so
`createCrudRoutes` attaches no POST handler, and `OrderForm.writes.append` is `false`.
See Blocker 3 in `overview.md`.

⛔ BLOCKED — on success the page cannot navigate to `/orders/:orderId`; there is no detail endpoint.
See Blocker 2 in `overview.md`.

⛔ BLOCKED — the new order **will not** appear in `GET /api/orders` until the Apps Script
`OrdersView` sync runs. The interval is unmeasured. See Blocker 7 in `overview.md`.
