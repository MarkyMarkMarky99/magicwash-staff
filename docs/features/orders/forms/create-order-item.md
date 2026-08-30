> Status: PLANNING — not implemented.

# Create Order Item Form

## Route

Parent route: /orders/:orderId — name `order-detail`

Overlay query: `?item=new`

Shell: `FormOverlay` (shared layout) — `open`, `title`, `submitLabel`, `isSubmitting`,
`isSubmitDisabled`; emits `close`, `submit`

Purpose:
เพิ่มรายการสินค้าให้กับ Order

## User-filled fields

| Field | Required | Component | Validation |
|---|---|---|---|
| description | no | FormTextarea | Optional text (Thai) |
| quantity | yes | FormInput | Numeric; decimal allowed |
| price | no | FormInput | Empty or numeric; decimal allowed |
| category | no | FormOptionGrid | Empty or one of `Tops`, `Bottoms`, `Home Textile`, `Others` |
| service_type | no | FormOptionGrid | Empty or one of `WSIR`, `IRON`, `DRCL`, `WASH` |
| special_instructions | no | FormTextarea | Optional text |

- `category` options are the live values; `Bedding` (1 row) is not offered.
- `service_type` options are the canonical four, not the live label set. See Known data debt in
  `data-model.md`.
- No frontend mapper layer, and no frontend derivation of totals from `quantity` and `price`.

## Not form fields

| Field | Source |
|---|---|
| id | server-generated on append |
| order_id | route param `orderId` |
| timestamp | server-generated on append |
| created_by | server; effectively unused today (23,162 of 23,165 rows blank) |
| updated_at | server, on update only |
| updated_by | server, on update only |
| item_id | **unresolved** — links to the separate `OrderItems` sheet (registry `OrderItem.json`, keyed `item_id`). No API exposes that sheet, so there is no way to choose a value. |
| credits_used | **unresolved** — decimal, tied to customer packages. No contract or endpoint defines who computes it. Left blank until defined. |
| invoice_item_id | never written by this form; empty across all 23,165 live rows |

## Overlay behaviour

- Open with the parameterised query-overlay composable in `src/features/orders/composables/`,
  query key `item`, value `new`. `useOrderSheetRoute.ts` cannot be reused — its `QUERY_KEY` is
  hardcoded to `'order'`.
- Derive open state with `computed` from the route; never mirror it into a local `ref` — on a
  `KeepAlive`-cached page a stale mirror makes reopening a silent permanent no-op.
- `close()` calls `router.back()` only when this page pushed the entry; on a deep link or a refresh
  it strips `item` with `router.replace`, because `router.back()` there would leave the app.
- Never call `history.pushState`, `history.back()`, `history.forward()`; never listen for
  `popstate`.

## Submit flow

1. Component collects the user-filled fields.
2. `OrderDetailPage` supplies `order_id` from the route param.
3. Store submits the API-shaped item request through the order service.
4. Service calls the planned `OrderItemForms` write endpoint with `apiPost`.
5. On success, refetch the detail from the API and `close()` the `item` query.

## Blocker

⛔ BLOCKED — `OrderItemForms` has no HTTP surface. It is not registered in `server/sheets/`, has no
registry JSON, no `contracts/` api schema, no `server/modules/` module, and no route. Sheet-layer
registration with `writes: { append: true, update: false, delete: false }` is designed but not
implemented, on branch `feat/register-order-sheets`. See Blocker 4 in `overview.md`.
