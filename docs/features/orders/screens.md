> Status: PARTIALLY IMPLEMENTED — see each screen section for current blockers.

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

Route: /orders/:orderId — name order-detail

Purpose:
แสดงรายละเอียดออเดอร์ รายการชิ้น รูปภาพ และสั่งพิมพ์แท็ก

Main UI:
- AppLayout and ScrollRegion wrap the page.
- Header shows customer, status, pickup/due dates, service, and header quantity.
- Items use ListContainer and OrderItemRow; OrderItemsMenu adds an item or opens the garment album.
- OrderTagPrintAction shows the TSC print button and its loading/success/error feedback.
- OrderImageSection shows order images.

Actions:
- Add item — opens the item overlay and reloads work-order detail after saving.
- Print tags — opens a confirmation dialog with the item quantity total. Staff can adjust the tag count from 1 through 999 before printing.
  The customerIndex comes from the loaded customer store. The button is disabled
  while detail is loading, if the index is missing, or if item quantities are
  missing or invalid. For totals above 999, the dialog starts at the per-request maximum of 999 so staff can print in batches.
- The page sends a complete body to POST /api/laundry-tag-prints; the backend
  forwards it to the TSC print server. Tag IDs are not yet persisted.

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
