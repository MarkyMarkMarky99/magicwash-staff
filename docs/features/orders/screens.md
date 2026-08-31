> Status: PLANNING — not implemented.

# Order Screens

## Order List

Route: /orders — name `order-list`, meta `{ searchable: true }`

Purpose:
แสดงรายการ Order ทั้งหมด ค้นหา กรองตามสถานะ และเปิดดูรายละเอียด

Main UI:
- `ListPageLayout` (shared layout) with `v-model:searchValue` bound to the page keyword
- `GenericTabs` (shared component, unmodified) in the `filters` slot for the status filter
- `OrderRow.vue` — feature-local, one row per order
- `OrderListPagination.vue` — feature-local, driven by `ListResult.pagination`

Sections:
- Search bar — rendered by `ListPageLayout` only when `showSearch` is true and `searchValue` is not
  `undefined`; the toggle in `AppHeader` appears only because the route sets `meta.searchable`
- Status filter tabs — `filters` slot
- Order rows — default slot
- Pagination footer — feature-local, below the rows

Actions:
- Open order detail — `router.push('/orders/' + orderId)`
- Create order — `router.push('/orders/new')`
- Change status filter — replace-only query update, following the
  `useCustomerFilterRoute.ts` / `useInvoiceFilterRoute.ts` convention

Shared components:
- `AppHeader` (via `ListPageLayout` → `AppLayout`)
- `GenericTabs`

⛔ BLOCKED — the page cannot load any data. `GET /api/orders` requires `customerId`, and this page
has no customer. Server-side keyword search is additionally a no-op because `ordersService` is
constructed with `searchFields: []`. See Blockers 1 and 3 in `overview.md` and the list flow in
`flows.md`.

## Order Detail

Route: /orders/:orderId — name `order-detail`, meta `{ parent: 'order-list' }`, `props: true`

Purpose:
แสดงรายละเอียด Order พร้อมรายการสินค้าและรูปภาพ

Main UI:
- `AppLayout` (shared layout) as the page shell
- `AppHeader` back target resolved from `meta.parent`
- `ListContainer` (shared component) for the items section
- `OrderItemRow.vue` — feature-local
- `FormOverlay` (shared layout) for the add-item overlay

Sections:
- Header summary — order number, customer, received date, due date, status, service type
- Items — `ListContainer`, exact props:
  - `title="รายการสินค้า"`
  - `icon="checkroom"` (required prop; same glyph the existing `OrderDetailSheet.vue` items header uses)
  - `:count="order.items.length"`
  - `countLabel="pcs"` (required prop)
  - `:collapsible="true"`
  - `:loading`, `:error`, `:empty` bound to store state
  - `emptyText="ยังไม่มีรายการสินค้า"`
  - `:skeletonRows="3"`
  - default slot: `OrderItemRow.vue` per item; `actions` slot: the add-item button
  - `ListContainer` is a titled collapsible section, not a table — it has no rows/columns model and
    no emits

Actions:
- Add item — opens `?item=new` (flow: `flows.md` § Add order item; ⛔ Blocker 4)

Shared components:
- `AppHeader`
- `ListContainer`

⛔ BLOCKED — `/api/orders/:id` 404s with `Route not found`; there is no detail endpoint. See
Blocker 2 in `overview.md`.

## Create Order Form

Route: /orders/new — name `order-create`, meta `{ parent: 'order-list' }`

Purpose:
สร้าง Order ใหม่

Main UI:
- `FormOverlay` (shared layout) — props `open` (required), `title` (required), `submitLabel`
  (default `บันทึก`), `isSubmitting`, `isSubmitDisabled`; emits `close` and `submit`
- `FormInput`, `FormTextarea`, `FormOptionGrid`, `FormLabel` (shared components)
- Feature-local customer picker — see SHARED GAPS 5 in `overview.md`

Sections:
- Overlay header — `title`, optional `eyebrow` / `helperText`, rendered by `FormOverlay`
- Field body — `FormOverlay` default slot; field list in `forms/create-order.md`
- Footer — `FormOverlay` submit button, disabled while `isSubmitting`

Actions:
- Submit order — emits `submit`; see `forms/create-order.md` (⛔ Blocker 3)
- Close form — emits `close`

Shared components:
- `FormOverlay`
- `FormInput`, `FormTextarea`, `FormOptionGrid`, `FormLabel`

Form page:
- Component name: `OrderCreatePage`
- Add `'OrderCreatePage'` to the `src/App.vue` KeepAlive `exclude` list; use `onMounted`, never
  `onActivated`/`onDeactivated`
