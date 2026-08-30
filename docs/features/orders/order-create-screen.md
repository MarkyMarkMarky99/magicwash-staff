# Order create screen

**Route:** `/orders/new` · **Page:** `OrderCreatePage.vue` · **Component name:** `OrderCreatePage`

## Fields

- **ลูกค้า** — `customerId`, required. Searchable picker, options from `GET /api/customers`.
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
- Close → `router.replace` to the list.

## Caching

`OrderCreatePage` is on the `<KeepAlive>` exclude list in `src/App.vue` and must stay there — the fields are component-local refs, and a cached page would carry one customer's input into the next. The list matches the **component name**, so `defineOptions({ name: 'OrderCreatePage' })` must not be renamed. Use `onMounted`, never `onActivated`.

## Validation

- `receivedDate` must not be later than `dueDate`.
- `quantity` accepts integers only.
