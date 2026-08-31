> Status: PLANNING — not implemented.

# Order Flows

## List orders

1. Page — `OrderListPage` mounts and reads keyword, status filter, and page from the route query.
2. Store — order list store requests a page of orders.
3. Service — calls `apiGetList('/api/orders', { query, querySchema: orderListQuerySchema })`.
4. Service — ⛔ BLOCKED — `orderListQuerySchema.customerId` is `z.string().trim().min(1)`. A global
   list has no customer, so `querySchema.parse` throws before any request is sent. See Blocker 1.
5. Service — ⛔ BLOCKED — even with a customer, `keyword` filters nothing: `ordersService` is built
   with `searchFields: []`. See SHARED GAPS 1 in `overview.md`.
6. Store → Page → Component — on a future working endpoint, rows render from the DTO unchanged, and
   pagination comes from `ListResult.pagination`.

## Create order

1. Component → Page — user fills the `OrderCreatePage` fields.
2. Page — validates required fields and builds the API-shaped payload; no frontend mapper.
3. Page → Store — store submits through the order service.
4. Service → API — `apiPost('/api/orders', …)`.
5. Service → API — ⛔ BLOCKED — no create endpoint. `orderApiContract` has no `request.create`, so
   `createCrudRoutes` attaches no POST handler, and `OrderForm.writes.append` is `false`.
   See Blocker 3.
6. Page — ⛔ BLOCKED — the page cannot navigate to order detail on success; there is no detail
   endpoint and `/api/orders/:id` 404s. See Blocker 2.
7. Store → Service → API — ⛔ BLOCKED — a newly created order **will not** appear in
   `GET /api/orders` until the Apps Script `OrdersView` sync runs. The interval is unmeasured.
   See Blocker 7.

## View order detail

1. Component → Page — user opens `/orders/:orderId` from the list.
2. Page — `OrderDetailPage` reads `orderId` from route props.
3. Page → Store — store requests the order detail.
4. Service → API — `apiGet('/api/orders/:id')`.
5. Service → API — ⛔ BLOCKED — `orderApiContract` declares no `response.detail`, so
   `createCrudRoutes` computes `canGetById === false`, attaches no item handler, and the request
   404s with `Route not found`. See Blocker 2.
6. Store → Page → Component — on a future working endpoint, the page renders the DTO directly:
   header summary and items in `ListContainer`.

## Add order item

1. Component → Page — user activates the add-item button in the `ListContainer` `actions` slot.
2. Page → Router — `open()` pushes `?item=new`; the overlay reads its state from the route.
3. Component → Page — `FormOverlay` collects the item fields.
4. Page → Store — page supplies `order_id` from the route; store submits the item payload.
5. Service → API — calls the planned `OrderItemForms` write endpoint.
6. Service → API — ⛔ BLOCKED — `OrderItemForms` has no contract, module, or route. Sheet-layer
   registration with `append: true` is in progress on `feat/register-order-sheets` and is not
   implemented. See Blocker 4.
7. Store → Page → Router — on a future success, refetch the detail from the API and `close()` the
   `item` query.

## Add-item overlay navigation and Back

1. Page → Router — open with `router.push({ query: { ...route.query, item: 'new' } })`.
2. Page — derive open state with `computed` from the route; never mirror it into a local `ref` —
   on a `KeepAlive`-cached page a stale mirror makes reopening a silent permanent no-op.
3. Page → Router — `close()` calls `router.back()` only when this page pushed the entry.
4. Page → Router — on a deep link or a refresh there is no parent entry, so `close()` strips `item`
   with `router.replace` instead; `router.back()` there would leave the app.
5. Page — browser and Android Back are handled entirely by the query-param route. The overlay never
   calls `history.pushState`, `history.back()`, `history.forward()`, and never listens for
   `popstate`.
