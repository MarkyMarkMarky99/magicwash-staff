> Status: PLANNING — not implemented.

# Orders

## Purpose

วางแผน Feature สำหรับสร้าง ดู และจัดการ Order

## Routes

| Route | Name | Page | Meta |
|---|---|---|---|
| /orders | order-list | OrderListPage.vue | { searchable: true } |
| /orders/new | order-create | OrderCreatePage.vue | { parent: 'order-list' } |
| /orders/:orderId | order-detail | OrderDetailPage.vue | { parent: 'order-list' }, props: true |

- Overlay: add-item `?item=new`
- There are no nested/`children` routes anywhere in this project; do not introduce them here
- Router is `src/router/index.js` (`createWebHashHistory`); it imports `orderRoutes` from
  `src/features/orders/routes.ts` and spreads it into the `routes` array

## Data sources

| Sheet | Workbook | Role | Registered in server/sheets/ |
|---|---|---|---|
| OrderForm | ORDERS_SPREADSHEET_ID | Order header | yes — `writes: { append: false, update: true, delete: false }` |
| OrderItemForms | ORDERS_SPREADSHEET_ID | Order line items | no |
| OrderImages | ORDERS_SPREADSHEET_ID | Order photos | no |
| OrdersView | PORTAL_SPREADSHEET_ID | Read model behind GET /api/orders | yes — all writes false |

- OrdersView is materialised by Apps Script from OrderForm and its item rows
- `server/modules/orders/order.module.ts` is the only orders module; it binds
  `OrdersViewRepository` + `orderApiContract` through `BaseCrudService` and `createCrudRoutes`
- Registry JSON: `OrderForm.json` and `OrderImages.json` exist; there is no `OrderItemForms.json`
  (`OrderItem.json` describes a different sheet, `OrderItems`, keyed on `item_id` with a `sku`)

## Code location

- Feature root: `src/features/orders/` — does not exist yet
- `routes.ts` — exports `orderRoutes`
- `pages/` — OrderListPage.vue, OrderCreatePage.vue, OrderDetailPage.vue
- `components/` — OrderItemRow.vue and order-local form UI
- `composables/` — parameterised query-overlay composable (below)
- `stores/`, `services/` — feature state and API calls

## Existing overlap

Order UI today lives in `src/features/customers/`:

- `components/OrderCard.vue`, `components/OrderList.vue`, `components/OrderDetailSheet.vue`
- `services/order.service.ts` — exports `listOrdersByCustomer` only
- `stores/customer-order-history.store.ts`
- `composables/useOrderSheetRoute.ts`

- `OrderDetailSheet.vue` offers View Photos (`router.replace('/gallery/AFT-<orderId>')`),
  Book Delivery, Create Invoice. Those three actions are out of scope for this plan.
- Migration of these files to `src/features/orders/` happens after the API and route work exists

## Navigation

- `NavSidebar.vue` items are hardcoded `<li><button>` blocks, in order: Appointments `/` (`home`),
  Customers `/customers` (`group`), Customer packages `/customer-packages` (`redeem`),
  Invoices `/invoices` (`receipt_long`), รายการราคา `/price-list` (`sell`),
  แจ้งปัญหา `/issue-reports` (`bug_report`). There is no Orders item.
- Planned entry, placed directly after Customers: label `Orders`, icon `local_laundry_service`,
  path `/orders`, active check `route.path.startsWith('/orders')`, same hardcoded block shape

## Detail composition

- Header summary: order number, customer, received/due date, status, service type
- Items section: shared `ListContainer` — exact props in `screens.md`
- Item rows: feature-local `OrderItemRow.vue` in the default slot
- Add-item trigger: `ListContainer` `actions` slot

## Overlay and architecture rules

- `useOrderSheetRoute.ts` cannot be reused: its `QUERY_KEY` is hardcoded to `'order'`, and this plan
  needs `item`.
- Build a parameterised composable in `src/features/orders/composables/` — not in `src/shared/`,
  because it is feature code. It must reproduce both non-obvious behaviours of the existing
  template:
  - open state derived from the route with `computed`, never mirrored into a local `ref` — on a
    `KeepAlive`-cached page a stale mirror makes reopening the same item a silent permanent no-op
  - `close()` calls `router.back()` only when this page pushed the entry; on a deep link or a
    refresh there is no parent entry and `router.back()` would leave the app, so it strips the query
    with `router.replace` instead
- An overlay must never call `history.pushState`, `history.back()`, `history.forward()`, or listen
  for `popstate`
- An action that navigates away from an open overlay uses `router.replace`, not close-then-`push`
- `useCustomerFilterRoute.ts` / `useInvoiceFilterRoute.ts` are a different, replace-only convention
  for filter state, never `push`/`back()`. They are not overlay-dismiss templates. Follow them, not
  the overlay template, if the list page gets filters.
- Shared components are imported, never created and never modified — not even to add a prop
- If a planned UI has no shared component, build it feature-locally and record it under SHARED GAPS
- The API is the source of truth for business data: no frontend re-derivation of statuses, totals,
  or merged relations, and no mapper layer over API DTOs. Missing data is fixed in the API.
- `src/shared/api/api-client.ts` exports exactly `apiGetList`, `apiGet`, `apiPost`, `apiPatch`,
  class `ApiError`, type `ListResult`. There is no `apiPut` and no `apiDelete`, so no delete or
  full-replace flow is expressible from the frontend.
- `src/App.vue` KeepAlive `exclude`, verbatim: `'CreateAppointmentPage'`,
  `'RescheduleAppointmentPage'`, `'InvoiceCreatePage'`, `'CustomerCreatePage'`,
  `'CustomerPackageCreatePage'`, `'PriceListFormPage'`, `'PackageFormPage'`, `'IssueReportFormPage'`.
  Add `OrderCreatePage` and nothing else — the item overlay is not a page.
- `exclude` matches the component name, not the file path. Renaming a form page silently drops it
  from the list and reintroduces the bug where one customer's typed input survives into another's
  record. A page on that list must use `onMounted`, never `onActivated`/`onDeactivated`, which never
  fire for an uncached component.

## Verification

- `npm run build` is `vite build` — esbuild only, **no frontend type-check**. `typecheck:api` covers
  the backend only.
- This is why the shared-component rule is strict: a broken prop contract ships green.

## SHARED GAPS

Each item is needed by this plan, absent from `src/shared/`, and must therefore be built
feature-locally under `src/features/orders/`.

Verified inventory on 2026-08-30 —
`src/shared/components/`: `AppHeader`, `BaseSwipeCard`, `CardLeadingIcon`, `FormInput`, `FormLabel`,
`FormOptionGrid`, `FormSwitch`, `FormTextarea`, `GenericTabs`, `ListContainer`, `NavSidebar`.
`src/shared/layouts/`: `AppLayout`, `BaseFullOverlay`, `BaseOverlay`, `BaseSlideOverlay`,
`FormLayout` (no call sites), `FormOverlay`, `ListPageLayout`, `use-page-scroll-lock.ts`.
`ListPageLayout` and `FormOverlay` are layouts, not components.

1. **Search** — there is no `Search` component. Search is assembled: `ListPageLayout` renders the
   search bar only when `showSearch` is true *and* `searchValue !== undefined`, `AppHeader` shows
   the toggle only when `route.meta.searchable === true`, and open/close is the module-level flag in
   `src/shared/composables/useHeaderSearch.ts`. The page owns the keyword and the filtering.
   Server-side search is a no-op today: `ordersService` is constructed with `searchFields: []`, so
   the contract's `keyword` param filters nothing.
2. **Pagination** — `ListPageLayout` has no pagination UI at all and no shared component provides
   one. `apiGetList` returns `ListResult.pagination`, so the data exists and only the control is
   missing. Build `OrderListPagination.vue` feature-locally.
3. **Status filter** — no shared filter component exists. Plan: `GenericTabs` in the
   `ListPageLayout` `filters` slot, which is what other list features do. `GenericTabs` is imported
   unmodified; the tab set and the filtering live in the orders feature.
4. **Camera / image capture** — nothing in `src/shared/`. See Blocker 6.
5. **Customer picker** — `create-order.md` must not ask the user to type a raw customer ID.
   `CustomerPicker.vue` is feature-local under `src/features/customer-packages/components/`, so
   importing it from orders is a forbidden cross-feature import.
   `src/shared/stores/selected-customer.store.ts` **is** shared and already carries a
   customer snapshot (`useSelectedCustomerStore`, `select()`, `clear()`), but it is handoff state,
   not a picker UI. Options: (a) duplicate a picker inside `src/features/orders/components/`,
   (b) promote `CustomerPicker.vue` to `src/shared/` in a dedicated refactor pass that checks every
   existing call site, (c) navigate to `/customers`, select there, and read the shared store back.
   Not decided here.

## Blockers

1. `GET /api/orders` requires `customerId` (`z.string().trim().min(1)` in
   `contracts/orders/order-api.schema.ts`). A global `/orders` list has no customer to pass, so the
   list page has no endpoint. Either the query schema makes `customerId` optional or a separate list
   query is added.
2. There is no detail endpoint. `orderApiContract` declares no `response.detail`, so
   `createCrudRoutes` computes `canGetById === false`, attaches no item handler, and
   `/api/orders/:id` 404s with `Route not found`.
3. There is no create endpoint. `orderApiContract` declares no `request.create`, and
   `OrderForm.writes.append` is `false` (its `update` is `true`, used only by invoice creation).
4. `OrderItemForms` has no HTTP surface. Backend work in progress on branch
   `feat/register-order-sheets` will register it in `server/sheets/` as a db-contract + repository
   with `writes: { append: true, update: false, delete: false }`. That design is not implemented,
   and it delivers no `contracts/` api schema, no `server/modules/` module, and no route — so the
   frontend still cannot call anything.
5. `OrderImages` has no HTTP surface, on the same terms as Blocker 4: sheet-layer registration with
   append is in progress on the same branch, with no contract, module, or route. The existing camera
   path does not write here — `src/composables/usePhotoUpload.js` uploads the binary to Firebase
   Storage via `src/api/storage.js`, then `src/api/photos.js` posts an Apps Script `APPEND` with a
   snake_case payload to `target: 'BeforePhoto'` or `'AfterPhoto'`. `LaundryPhotos` is a sheet that
   file *reads* from over GViz.
6. Photo capture code is not shared. It lives in `src/features/gallery/`, `src/api/`,
   `src/composables/`, `src/utils/`. Using it from an orders feature is a cross-feature import,
   which the architecture rules forbid. Open decision: move it to `src/shared/` in a dedicated
   refactor, or duplicate it locally. Not decided here.
7. `OrdersView` is Apps Script-materialised. A newly created order **will not** appear in
   `GET /api/orders` until that sync runs. The interval is unmeasured.
