# Order create and edit screen

**Routes:** `/orders/new` (`order-create`) and `/orders/:orderId/edit` (`order-edit`) · **Page and component name:** `OrderCreatePage`

## Create fields

- **ลูกค้า** — `customerId`, required. A `customerId` route query loads, preselects, and locks the
  customer; without it the field is a searchable picker populated from `GET /api/customers`.
- **วันที่รับผ้า** — `receivedDate`, required. Date.
- **กำหนดส่ง** — `dueDate`, required. Date.
- **บริการ** — `serviceType`, required. Option grid, Thai labels:
  - `WSIR` — ซักรีด
  - `IRON` — รีด
  - `DRCL` — ซักแห้ง
  - `WASH` — ซัก
- **จำนวน** — `quantity`, optional. Integer.
- **ชื่อออเดอร์** — `orderName`, optional. Text.
- **หมายเหตุ** — `note`, optional. Textarea.

Blank optional fields submit as `null`.

## Payload

`workOrderCreateSchema` in `contracts/work-orders/work-order-api.schema.ts`, parsed on submit.

- `items` — always `[]`. Items are added from the detail screen.
- `createdBy` — `'admin'` until an auth system exists.

## Submit

`orderStore.create` → `createWorkOrder` → `POST /api/work-orders`.

- Success → `router.replace` to `order-detail`.
- Error → inline `formError`. No toast.
- Close → `useCloseRoute` returns to the in-app origin or replaces a fresh deep link with the list.

## Caching

`OrderCreatePage` is on the `<KeepAlive>` exclude list in `src/App.vue` and must stay there — the fields are component-local refs, and a cached page would carry one customer's input into the next. The list matches the **component name**, so `defineOptions({ name: 'OrderCreatePage' })` must not be renamed. Use `onMounted`, never `onActivated`.

## Validation

- `receivedDate` must not be later than `dueDate`.
- `quantity` accepts integers only.

## Edit

The same page selects edit mode from the route name, loads the work order by path id, and fills
status, received date, due date, and order-header quantity. Customer is read-only context,
displayed as name and customerIndex from the preloaded customer store (or as the id when that
customer is absent). Service, order name, and note are create-only fields. The status picker offers every valid work-order status.
The page submits only changed fields through `workOrderStore.update` and
`PATCH /api/work-orders/:id`, with `updatedBy` from `currentActor()`. A save with no changes is
disabled. Successful save replaces the form route with order detail; cancel and X use
`useCloseRoute`. An explicit change to `APPROVED` reports the returned ticket count and any
provisioning failure in a closeable inline message at the top of order detail. The page passes
that result through Vue Router history state when replacing the form route. The detail page
consumes and clears the history state on arrival, so closing the message or reloading does not
show it again.
