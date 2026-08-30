# Orders backend — two lanes

## Scope

Backend for the Orders feature, split into two lanes that stop pretending to be one module:

- **display lane** — `orders`, reads `OrdersView` in the **portal workbook**
  (`PORTAL_SPREADSHEET_ID`). 13 columns, primary key `order_id`, with an `items_json` column Apps
  Script materialises on an unmeasured interval. It is a preprocessed read surface for browsing, not
  a system of record. **This plan does not touch it.**
- **staff lane** — `work-orders` (`OrderForm`), `order-items` (`OrderItemForms`),
  `order-images` (`OrderImages`), all in the **orders workbook** (`ORDERS_SPREADSHEET_ID`). Live
  sheets the shop actually operates on: read fresh, written directly.

The two lanes are not two views of one table. They are different workbooks, different column sets
and different primary keys — `OrdersView.order_id` against `OrderForm.id`. Verified by direct GViz
reads and by the two db-contracts' `spreadsheetId` bindings.

Four phases, each deployable once its predecessors are in. Replaces the fixture data in
`src/features/orders/mocks/order-prototype.fixture.ts`.

## What changed from the previous version of this plan

The previous plan extended the single `orders` module to serve both roles: list from `OrdersView`,
detail from `OrderForm`, writes to `OrderForm`. That produced a module whose list and detail
answered from different sheets with different freshness, and it forced edits into
`contracts/orders/order-api.schema.ts`, a file with **10 live importers**.

The split removes both problems:

- `contracts/orders/order-api.schema.ts` and `server/modules/orders/order.module.ts` are now
  **unchanged**, so all 10 importers keep working with no edit and no silent type drift. That
  matters here because the project has no frontend type-check — `npm run build` is esbuild only, so
  a broken DTO shape ships green and is discovered on screen, not in CI.
- `work-orders` reads and writes the same sheet on every route, so its list and detail never
  disagree. `OrdersView` staleness stops being a bug inside a module and becomes a stated property
  of a separate endpoint.

Naming: the module is `work-orders`, but its id field stays `orderId`. `OrderForm.id` and
`OrdersView.order_id` hold the same value for the same real-world job — verified live, e.g.
`117ac0a1` appears in both — so inventing a second identity for it would be a lie in the DTO.

## Inventory

| module | status | sheets read | sheets written | endpoints | phase |
|---|---|---|---|---|---|
| `orders` | **untouched** | `OrdersView` | — | `GET /api/orders` | — |
| `order-items` | new | `OrderItemForms`, `OrderForm` | `OrderItemForms` | `GET /api/order-items?orderId=`, `GET /api/order-items/:id`, `POST /api/order-items` | 1 |
| `work-orders` | new | `OrderForm`, `Customers` | `OrderForm` | `GET /api/work-orders`, `GET /api/work-orders/:id`, `POST /api/work-orders` | 2, 3 |
| `order-images` | new | `OrderImages` | `OrderImages` | `GET /api/order-images?orderId=`, `GET /api/order-images/:id`, `POST /api/order-images` | 4 |

The `/:id` routes are not optional extras: `createCrudRoutes` attaches the item handler from
`response.detail` alone.

Already built, on branch `feat/orders-contracts`:

```
contracts/order-items/order-item-api.schema.ts
contracts/order-images/order-image-api.schema.ts
tests/server/unit/contracts/order-items/order-item-api.schema.dry-test.ts
tests/server/unit/contracts/order-images/order-image-api.schema.dry-test.ts
contracts/work-orders/work-order-api.schema.ts
tests/server/unit/contracts/work-orders/work-order-api.schema.dry-test.ts
```

New files this plan still needs:

```
server/sheets/OrderItemForms/OrderItemForms.db-contract.ts
server/sheets/OrderItemForms/OrderItemForms.repository.ts
server/sheets/OrderImages/OrderImages.db-contract.ts
server/sheets/OrderImages/OrderImages.repository.ts
server/modules/order-items/order-item.module.ts
server/modules/order-images/order-image.module.ts
server/modules/work-orders/work-order.mapping.ts
server/modules/work-orders/work-order.module.ts
server/modules/work-orders/work-order.service.ts
```

`server/api/route-registry.ts` goes 9 keys -> 12 (`order-items` in 1, `work-orders` in 3 — not 2,
see the deferred-registry note in Phase 2 — and `order-images` in 4).

## Structural decisions

- **No combined `/api/work-orders/:id/items` route.** `ApiGateway.dispatch` rejects more than two
  path segments (`api-gateway.ts:25-30`), so a nested route cannot exist without inventing routing
  in the shared layer. `?orderId=` works with the existing `createCrudRoutes`.
- **`orders` is not deleted.** Two live callers read it —
  `src/features/customers/services/order.service.ts:8` and
  `src/features/invoices/services/invoice-create-context.service.ts:23` — plus eight type-only
  importers. It is the right surface for browsing history where a few minutes of lag costs nothing.
- **All services subclass `BaseCrudService`.** `createCrudRoutes(service, api)` types its first
  parameter as `BaseCrudService<any x8>` (`crud-routes.ts:14-17`), so the service passed in must be
  one. Precedent: `AppointmentService` (`appointment.service.ts:65`).
- Subclasses override the public `list`/`getById`/`create` and call `super.*` where the base flow
  fits. `readRows`, `requireId`, `requireSingleRow` and the instance `mapDbRowToApi` are `private`
  (`base-crud.service.ts:275,378,386`) and are NOT reachable from a subclass; the exported function
  `mapDbRowToApi` (`:416`) is. A subclass that bypasses `super.getById` must re-implement the
  blank-id and row-count guards itself.
- **A multi-repository service is an existing pattern**, so `work-orders` holding `OrderForm`,
  `Customers` and an order-items port is not novel: `InvoiceService` already holds four repository
  getters (`invoice.service.ts:293-330`).
- **Every service takes all of its repositories as injectable constructor options** defaulting to
  the real lazy getters. There is no mocking framework, so a dry test can only supply a fake through
  the constructor.
- **Field maps live in `work-order.mapping.ts`, not in the module file.** Precedent:
  `server/modules/appointments/appointment.mapping.ts`. The service imports the maps and the module
  imports the service; maps in the module would close that cycle.
- **`ModuleApiContract` (`contracts/shared/module-api-contract.ts:37-41`) requires `request.create`
  and `request.update` together** when `request` is present. Modules that create but never update
  declare `<m>UpdateSchema = z.never()` and omit `response.update`, leaving `canUpdate === false`,
  so no `PATCH` is attached and `BaseCrudService.update` is uncallable.
- **No Vercel function is added.** `api/` holds exactly one function, `api/[...path].ts`, and
  `route-registry.ts` lazy-imports every module. A registry key adds no serverless function.

Route gating, verified against `server/shared/http/crud-routes.ts:18-20`:

```
canCreate  = api.request?.create !== undefined && api.response.create !== undefined   # BOTH
canGetById = api.response.detail !== undefined                                        # detail only
canUpdate  = api.request?.update !== undefined && api.response.update !== undefined
```

Absent slot outcomes: no `response.create` -> `POST` omitted from the collection method map ->
405 + `Allow: GET`. No `detail` and no `update` -> `item` is `undefined` -> gateway 404
`Route not found`.

## Notation

`L` = calls / next step. `# comment` = a decided fact. Every response schema listed is projected by
`BaseCrudService.project`, which copies only the keys in `schema.shape` and yields `undefined` for a
key the row lacks — that is how a subclass fills a joined field after `super.list()`.

## Type aliases

Every `<Sheet>DbRow` alias is derived where it is used, from the row schema its db-contract already
exports. There is no shared types file and none of these are re-exported:

- `OrderItemFormsDbRow` = `z.infer<typeof orderItemFormsRowSchema>`
- `OrderImagesDbRow` = `z.infer<typeof orderImagesRowSchema>`
- `OrderFormDbRow` = `z.infer<typeof orderFormRowSchema>` — Phase 1 derives it locally in
  `order-item.module.ts`; Phase 2's `work-order.mapping.ts` derives and exports its own. That is
  why Phase 1 has no dependency on Phase 2.
- `CustomersDbRow` = `z.infer<typeof customersRowSchema>` — `Customers.repository.ts` keeps its own
  `CustomersRow` local and unexported, but `customersRowSchema` is exported, so the alias is
  derivable at the use site.

Use the `<Sheet>DbRow` spelling everywhere. `OrderItemFormsRow` and `OrderImagesRow` are not names
this plan uses.

---

## Phase 1 — `order-items` module

No dependencies on the other phases. It reads the `OrderForm` sheet contract (already registered)
for the parent-order lookup, and derives `OrderFormDbRow` locally — see Type aliases. The API
contract already exists; this phase registers the sheet and builds the
module.

### `server/sheets/OrderItemForms/OrderItemForms.db-contract.ts` (new)

```
orderItemFormsRowSchema = z.object({ ... })    # KEY ORDER = physical column order A..O
 L id: z.string()                              # A
 L order_id: z.string().nullable()             # B
 L item_id: z.string().nullable()              # C
 L description: z.string().nullable()          # D
 L quantity: z.number().nullable()             # E
 L price: z.number().nullable()                # F
 L credits_used: z.number().nullable()         # G
 L timestamp: z.string().nullable()            # H
 L category: z.string().nullable()             # I  free string, NOT an enum
 L service_type: z.string().nullable()         # J  free string, Thai and English live values
 L special_instructions: z.string().nullable() # K
 L created_by: z.string().nullable()           # L
 L updated_at: z.string().nullable()           # M
 L updated_by: z.string().nullable()           # N
 L invoice_item_id: z.string().nullable()      # O

orderItemFormsDbContract = { ... } satisfies SheetContract
 L row: orderItemFormsRowSchema
 L primaryKey: 'id'
 L sheetName: 'OrderItemForms'
 L spreadsheetId: 'ORDERS_SPREADSHEET_ID'
 L audit: { onAppend: ['timestamp'], onUpdate: [] }
 L writes: { append: true, update: false, delete: false }
 # no valueInput key
```

`id` is `z.string()` not `z.string().min(1)`: reads are not validated, but the schema must not claim
a constraint 1,074 live rows break.

### `server/sheets/OrderItemForms/OrderItemForms.repository.ts` (new)

```
let repository: SheetRepository<OrderItemFormsDbRow> | undefined
export function getOrderItemFormsRepository(): SheetRepository<OrderItemFormsDbRow>
 L return repository ??= new SheetRepository({ contract: orderItemFormsDbContract })
```

### `server/modules/order-items/order-item.module.ts` (new)

```
orderItemFieldMap = { ... } as const satisfies Record<keyof OrderItemFormsDbRow & string, string>
 L id: 'orderItemId', order_id: 'orderId', item_id: 'itemId', description: 'description',
   quantity: 'quantity', price: 'price', credits_used: 'creditsUsed', timestamp: 'createdAt',
   category: 'category', service_type: 'serviceType', special_instructions: 'specialInstructions',
   created_by: 'createdBy', updated_at: 'updatedAt', updated_by: 'updatedBy',
   invoice_item_id: 'invoiceItemId'

export function createOrderItemId(): string
 L return generateShortId()                    # no prefix; live OrderItemForms.id is bare 8-hex

export function createOrderItemRepository(): SheetRepositoryContract<OrderItemFormsDbRow>
 L read / append / batchAppend / update / delete delegating to getOrderItemFormsRepository()
 L append and batchAppend inject `id: createOrderItemId()`
 # timestamp is left unset so audit.onAppend stamps it

export interface OrderItemServiceOptions {
  repository?: SheetRepositoryContract<OrderItemFormsDbRow>
  orderFormRepository?: () => SheetRepositoryContract<OrderFormDbRow>
}

export class OrderItemService extends BaseCrudService<...>

private readonly writeRepository: SheetRepositoryContract<OrderItemFormsDbRow>
private readonly orderFormRepository: () => SheetRepositoryContract<OrderFormDbRow>

constructor(input: OrderItemServiceOptions = {})
 L const repository = input.repository ?? createOrderItemRepository()
 L super({ repository, api: orderItemApiContract, searchFields: [], fieldMap: orderItemFieldMap })
 L this.writeRepository = repository
 L this.orderFormRepository = input.orderFormRepository ?? getOrderFormRepository

async list(query: unknown) -> ServiceListResult<OrderItemResponse>    # override
 L const result = await super.list(query)
 L drop items whose orderItemId is not a non-blank string   # the 1,074 phantom rows
 L return { items, pagination: result.pagination }

async create(payload: unknown) -> OrderItemResponse                   # override
 L const data = parseOrThrow(orderItemApiContract.request.create, payload)
 L const rows = await this.orderFormRepository().read(ReadQueryDTO.fromId<Partial<OrderFormDbRow>>(data.orderId))
 L if rows.length === 0
    L throw ApiError.notFound(`Resource '${data.orderId}' not found`)   # doubles as orderId validation
 L const serviceType = rows[0].service_type ?? null
 L const stored = await this.writeRepository.append({
      order_id: data.orderId, item_id: data.itemId, description: data.description,
      quantity: data.quantity, price: data.price, category: data.category,
      service_type: serviceType, special_instructions: data.specialInstructions,
      created_by: data.createdBy,
   })
   # id is injected by createOrderItemRepository; timestamp is stamped by audit.onAppend
 L const apiRow = mapDbRowToApi(stored, orderItemMapper, {})
   # exported function from base-crud.service.js; the instance method and `project` are private
   # and unreachable here. orderItemMapper = new Mapper(orderItemFieldMap), precedent
   # invoice.service.ts:224
 L return an object carrying exactly the orderItemResponseSchema keys, read off apiRow
 # the client can never set service_type; the parent order owns it

async createMany(rows: Array<Partial<OrderItemFormsDbRow>>) -> void    # used by work-orders
 L await this.writeRepository.batchAppend(rows)
 # exposed because BaseCrudService.create writes one row and work-orders needs one batched request

export const orderItemService = new OrderItemService()
export const orderItemRoutes = createCrudRoutes(orderItemService, orderItemApiContract)
```

`create` reads the **OrderForm sheet repository**, not the `work-orders` module, so `order-items`
never imports `work-orders` and the dependency stays one-way.

### Registry — `server/api/route-registry.ts` (edit)

```
'order-items': (): ReturnType<RouteLoader> =>
  import('../modules/order-items/order-item.module.js').then((module) => module.orderItemRoutes),
```

### Test edits

- `tests/server/unit/sheets/sheet-binding.dry-test.ts` — `expectedSheetCount` 15 -> 16; add
  `'OrderItemForms'` to `expectedSheetDirectories`; add a binding entry
  `{ ORDERS_SPREADSHEET_ID, 'OrderItemForms' }`.
- `tests/server/unit/sheets/column-order.dry-test.ts` — add an entry pinning `id:A` .. `invoice_item_id:O`
  and PK column `A`.
- `tests/server/unit/sheets/repository-getters.dry-test.ts` — add `getOrderItemFormsRepository`.
  `ORDERS_SPREADSHEET_ID` is already in `environmentKeys`.
- `tests/server/unit/sheets/audit-declarations.dry-test.ts` — add
  `OrderItemForms: { onAppend: ['timestamp'], onUpdate: [] }`.
- `tests/server/unit/sheets/module-laziness.dry-test.ts` — add
  `'order-items/order-item.module.js'` to `modulePaths`; bump the final count string 9 -> 10.
- `tests/server/integration/sheet-column-parity.ts` — add `OrderItemForms` to `readableSheets`.
- New `tests/server/unit/api/route-registry-order-items.dry-test.ts` — copy of
  `route-registry-issue-reports.dry-test.ts` with the key, path and export name substituted.
- New `tests/server/unit/modules/order-items/order-item-wiring.dry-test.ts` — copy of
  `issue-report-wiring.dry-test.ts`: column order A..O, PK/sheet/env, audit, writes,
  `'valueInput' in orderItemFormsDbContract === false`, getter memoization, five repo methods,
  `orderItemRoutes.collection` and `.item` present, collection DELETE -> 405 `Allow: GET, POST`,
  item DELETE -> 405 `Allow: GET`.
- New `tests/server/unit/modules/order-items/order-item.service.dry-test.ts` — construct
  `new OrderItemService({ repository: fakeRepository, orderFormRepository: () => fakeOrderForm })`.
  Assert: `list` drops a phantom row (`id` null, `quantity` 0); `create` copies `service_type` from
  the parent OrderForm row onto the appended row; `create` throws 404 when the parent order does not
  exist; `orderItemApiContract.response.update === undefined`.

`tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` needs no edit: it discovers every
contract itself, and `ORDERS_SPREADSHEET_ID` is a writable workbook.
`tests/server/unit/sheets/service-wiring.dry-test.ts` needs no edit: it covers only orders,
appointments, invoices and customer-packages, and the `orders` module is unchanged by this plan.

### Verify

```
npx tsx tests/server/unit/sheets/sheet-binding.dry-test.ts
npx tsx tests/server/unit/sheets/column-order.dry-test.ts
npx tsx tests/server/unit/sheets/repository-getters.dry-test.ts
npx tsx tests/server/unit/sheets/audit-declarations.dry-test.ts
npx tsx tests/server/unit/sheets/module-laziness.dry-test.ts
npx tsx tests/server/unit/sheets/writing-workbook-binding.dry-test.ts
npx tsx tests/server/unit/api/route-registry-order-items.dry-test.ts
npx tsx tests/server/unit/modules/order-items/order-item-wiring.dry-test.ts
npx tsx tests/server/unit/modules/order-items/order-item.service.dry-test.ts
npm run typecheck:api
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
npm run build
```

---

## Phase 2 — `work-orders` read path

Depends on Phase 1: the detail response embeds live items, which only `order-items` can supply.
`OrderForm` has no `items_json` column, so there is no second source for them.

### `contracts/work-orders/work-order-api.schema.ts` — ALREADY BUILT, do not edit

Reference only: this is what the frozen contract already contains. It was written, reviewed and
gate-tested before this phase. Read it; never edit it.

```
import { orderItemResponseSchema } from '../order-items/order-item-api.schema.js'
import { orderServiceTypeSchema } from '../order-items/order-item-api.schema.js'
# orderServiceTypeSchema already lives in the order-items contract and is exported for exactly this

MAX_WORK_ORDERS_PER_PAGE = 500

workOrderListQuerySchema
 L keyword: z.string().default('')            # no-op, searchFields stays []
 L customerId: z.string().trim().min(1).optional()
 L status: z.string().trim().min(1).optional()       # free string on the API side on purpose:
                                                     # OrderForm.status IS a 6-member db enum, and a
                                                     # live row outside it must not 422 a whole list
 L page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page)
 L perPage: z.coerce.number().int().positive().max(MAX_WORK_ORDERS_PER_PAGE).default(MAX_WORK_ORDERS_PER_PAGE)
 L sortBy: z.enum(['receivedDate']).default('receivedDate')
 L sortOrder: z.enum(['asc', 'desc']).default('desc')

workOrderListResponseSchema                    # NO items: see Risks
 L orderId: z.string()
 L customerId: z.string()
 L customerName: z.string()                    # '' when the Customers row is missing
 L orderNumber: z.string().nullable()
 L invoiceNumber: z.string().nullable()
 L receivedDate: z.string().nullable()
 L dueDate: z.string().nullable()
 L serviceType: z.string().nullable()
 L status: z.string().nullable()
 L quantity: z.number().nullable()
 L hangers: z.number().nullable()
 L bags: z.number().nullable()
 L note: z.string().nullable()
 L createdAt: z.string().nullable()

workOrderDetailResponseSchema = workOrderListResponseSchema.extend({
 L orderName: z.string().nullable()
 L orderDescription: z.string().nullable()
 L formImage: z.string().nullable()
 L hangersImage: z.string().nullable()
 L bagsImage: z.string().nullable()
 L createdBy: z.string().nullable()
 L items: z.array(orderItemResponseSchema)
})

workOrderUpdateSchema = z.never()

workOrderApiContract satisfies ModuleApiContract
 L query:    { list: workOrderListQuerySchema }
 L request:  { create: workOrderCreateSchema, update: workOrderUpdateSchema }
 L response: { list: workOrderListResponseSchema, detail: workOrderDetailResponseSchema,
               create: workOrderCreateResponseSchema }
 # BUILT ALREADY, at this full shape — see Phase 3 for the create schemas themselves.
 # Because response.create is present, canCreate is already true (crud-routes.ts:19). The module is
 # therefore NOT registered in this phase: see F1b.
```

### `server/modules/work-orders/work-order.mapping.ts` (new)

```
export type OrderFormDbRow = z.infer<typeof orderFormRowSchema>

export const orderFormFieldMap = { ... } as const satisfies Record<keyof OrderFormDbRow & string, string>
 L id: 'orderId', order_number: 'orderNumber', customer_id: 'customerId',
   received_date: 'receivedDate', due_date: 'dueDate', service_type: 'serviceType',
   status: 'status', quantity: 'quantity', hangers: 'hangers', bags: 'bags',
   hangers_image: 'hangersImage', bags_image: 'bagsImage', form_image: 'formImage',
   note: 'note', timestamp: 'createdAt', created_by: 'createdBy',
   updated_at: 'updatedAt', updated_by: 'updatedBy', invoice_id: 'invoiceNumber',
   order_name: 'orderName', order_description: 'orderDescription'
 # invoice_id holds the invoice NUMBER: invoice.service.ts:484-488 writes request.invoiceNumber into it

export type OrderFormApiRow = ApiRowFromFieldMap<OrderFormDbRow, typeof orderFormFieldMap>
```

### `server/modules/work-orders/work-order.service.ts` (new)

```
export interface OrderItemPort {
  listByOrderId(orderId: string): Promise<OrderItemResponse[]>
}

export interface WorkOrderServiceOptions {
  orderFormRepository?: () => SheetRepositoryContract<OrderFormDbRow>
  customerRepository?: () => SheetRepositoryContract<CustomersDbRow>
  orderItemPort?: OrderItemPort
}

export class WorkOrderService extends BaseCrudService<...>

constructor(input: WorkOrderServiceOptions = {})
 L super({ repository: input.orderFormRepository ?? getOrderFormRepository,
           api: workOrderApiContract, searchFields: [], fieldMap: orderFormFieldMap })
 L this.customerRepository = input.customerRepository ?? getCustomersRepository
 L this.orderItemPort = input.orderItemPort ?? defaultOrderItemPort

const defaultOrderItemPort: OrderItemPort = {
  listByOrderId: async (orderId) => {
    const result = await orderItemService.list({ orderId, page: 1, perPage: MAX_ORDER_ITEMS_PER_PAGE })
    return result.items
  },
}
 # imports orderItemService from '../order-items/order-item.module.js'. One-way: order-items never
 # imports work-orders. Nothing is constructed eagerly because the repository getters stay lazy.

async list(query: unknown) -> ServiceListResult<WorkOrderListResponse>   # override
 L const result = await super.list(query)
 L const customerIds = [...new Set(result.items.map((item) => item.customerId))]
 L const namesById = await this.readCustomerNames(customerIds)
 L fill customerName from namesById, '' when absent
 L return { items, pagination: result.pagination }

async getById(id: string) -> WorkOrderDetailResponse                     # override
 L const row = await super.getById(id)         # 404 on 0 rows, 409 on >1 (requireSingleRow)
 L const namesById = await this.readCustomerNames([row.customerId])
 L const items = await this.orderItemPort.listByOrderId(id)
 L return { ...row, customerName: namesById.get(row.customerId) ?? '', items }

private async readCustomerNames(customerIds: string[]): Promise<Map<string, string>>
 L drop blank ids; return an empty Map when none remain
 L const where = ids.length === 1 ? { CustomerID: ids[0] } : {}   # GViz '=' cannot express IN;
                                                                  # >1 id reads the whole sheet
 L read Customers, key by trimmed CustomerID, first row wins   # matches firstByKey in customer-package-assembly
```

### `server/modules/work-orders/work-order.module.ts` (new)

```
export const workOrderService = new WorkOrderService()
export const workOrderRoutes = createCrudRoutes(workOrderService, workOrderApiContract)
```

### Registry — deferred to Phase 3

The `'work-orders'` key is NOT added here. The contract already carries `response.create`, so the
moment the key exists `POST /api/work-orders` is attached to `BaseCrudService.create` — which would
write malformed `OrderForm` rows until Phase 3 lands the `create` override. Phase 2 and Phase 3
therefore deploy together; Phase 2 alone is a compile-and-test milestone, not a release.

### Accepts / returns

| endpoint | accepts | returns |
|---|---|---|
| `GET /api/work-orders` | `customerId?`, `status?`, `keyword`, `page`, `perPage`, `sortBy=receivedDate`, `sortOrder` | 200 `{ data: WorkOrderListResponse[], meta.pagination: { page, perPage } }` |
| `GET /api/work-orders/:id` | route `id` = `OrderForm.id` | 200 `{ data: WorkOrderDetailResponse }` |

### Test edits

- `tests/server/unit/sheets/module-laziness.dry-test.ts` — add
  `'work-orders/work-order.module.js'`; bump the count string 10 -> 11.
- New `tests/server/unit/api/route-registry-work-orders.dry-test.ts`.
- New `tests/server/unit/modules/work-orders/work-order.service.dry-test.ts` — construct
  `new WorkOrderService({ orderFormRepository: () => fakeOrderForm, customerRepository: () => fakeCustomers, orderItemPort: fakePort })`.
  Assert: `customerName` filled; `''` on a missing Customers row; one Customers read for a
  single-id list; `getById` embeds the port's items and propagates the base 404;
  `workOrderApiContract.response.update === undefined`.

No sheet-registration test changes: `OrderForm` is already a registered sheet.

### Verify

```
npx tsx tests/server/unit/sheets/module-laziness.dry-test.ts
npx tsx tests/server/unit/api/route-registry-work-orders.dry-test.ts
npx tsx tests/server/unit/modules/work-orders/work-order.service.dry-test.ts
npx tsx tests/server/unit/sheets/service-wiring.dry-test.ts
npm run typecheck:api
npm run build
```

---

## Phase 3 — `work-orders` create

Depends on Phases 1 and 2. Writes two sheets.

### `server/sheets/OrderForm/OrderForm.db-contract.ts` (edit)

```
service_type: z.enum(['WSIR', 'IRON', 'DRCL', 'WASH'])   # was ['WSIR', 'IRON']; live rows already contain DRCL
audit: { onAppend: ['timestamp'], onUpdate: ['updated_at'] }   # onAppend was []
writes: { append: true, update: true, delete: false }          # append was false
```

`service_type` is pinned in two places in code: `OrderForm.db-contract.ts:11` (the db enum this
phase widens) and `contracts/order-items/order-item-api.schema.ts:8` (`orderServiceTypeSchema`,
which this phase imports and does not change). No test asserts `orderFormDbContract.writes` or the
append capability. `tests/server/unit/sheets/order-form.sheets-api.dry-test.ts:33` uses `'WSIR'` as a
fixture cell only.

### `contracts/work-orders/work-order-api.schema.ts` — ALREADY BUILT, do not edit

Reference only. The create schemas below (`workOrderCreateItemSchema`, `workOrderCreateSchema`,
`workOrderCreateResponseSchema`, `workOrderUpdateSchema`) are already exported by the frozen
contract; this phase consumes them and adds no contract change.

```
import { orderItemCreateSchema, orderServiceTypeSchema } from '../order-items/order-item-api.schema.js'

workOrderCreateItemSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })
 # serviceType is already absent from orderItemCreateSchema; the header's serviceType applies to
 # every item

workOrderCreateSchema
 L customerId: z.string().trim().min(1)
 L receivedDate: z.string().trim().min(1)
 L dueDate: z.string().trim().min(1)
 L serviceType: orderServiceTypeSchema
 L quantity: z.number().nonnegative().nullable().default(null)
 L hangers: z.number().int().nonnegative().nullable().default(null)
 L bags: z.number().int().nonnegative().nullable().default(null)
 L note: z.string().trim().min(1).nullable().default(null)
 L orderName: z.string().trim().min(1).nullable().default(null)
 L orderDescription: z.string().trim().min(1).nullable().default(null)
 L createdBy: z.string().trim().min(1)
 L items: z.array(workOrderCreateItemSchema).default([])
 # not accepted: orderId, orderNumber, status, invoiceNumber, timestamp, updatedAt, updatedBy

workOrderCreateResponseSchema
 L orderId, orderNumber, customerId, receivedDate, dueDate, serviceType, status, quantity,
   note, createdAt, createdBy
 L itemsRequested: z.number()
 L itemsCreated: z.number()
 L itemsFailed: z.boolean()
 L itemsError: z.string().nullable()

workOrderApiContract
 L request:  { create: workOrderCreateSchema, update: workOrderUpdateSchema }
 L response: { list, detail, create: workOrderCreateResponseSchema }
 # response.update stays absent, so no PATCH /api/work-orders/:id is attached
```

### `server/modules/work-orders/work-order.service.ts` (edit)

```
WorkOrderServiceOptions                        # gains one member
 L orderItemWriter?: OrderItemWriter

export interface OrderItemWriter {
  createMany(rows: Array<Partial<OrderItemFormsDbRow>>): Promise<void>
}

constructor                                    # gains one line
 L this.orderItemWriter = input.orderItemWriter ?? orderItemService

export function createOrderId(): string
 L return generateShortId()                    # no prefix; live OrderForm.id is bare 8-hex

async create(payload: unknown) -> WorkOrderCreateResponse              # override; does NOT call super.create
 L const data = parseOrThrow(workOrderApiContract.request.create, payload)
   # import { parseOrThrow } from '../../shared/http/validate.js'
 L const orderId = createOrderId()
 L const headerRow = {
      id: orderId, customer_id: data.customerId, received_date: data.receivedDate,
      due_date: data.dueDate, service_type: data.serviceType, status: 'PENDING',
      quantity: data.quantity, hangers: data.hangers, bags: data.bags, note: data.note,
      created_by: data.createdBy, order_name: data.orderName,
      order_description: data.orderDescription,
   }
   # timestamp omitted so audit.onAppend stamps it; order_number, invoice_id and the
   # *_image columns are omitted and the repository pads them with ''
 L const storedHeader = await this.orderFormRepository().append(headerRow)
   # throws on failure; nothing else has been written
 L if data.items.length > 0
    L try
       L map each item to { order_id: orderId, item_id, description, quantity, price, category,
                            service_type: data.serviceType, special_instructions,
                            created_by: data.createdBy }
         # the header owns the service type; items inherit it
       L await this.orderItemWriter.createMany(itemRows)
       L itemsCreated = itemRows.length
      catch (error)
       L itemsFailed = true; itemsError = error message or 'order items were not written'
L return the create response, createdAt = storedHeader.timestamp ?? null, status 'PENDING'
```

`getById` needs no change in this phase: it already reads `OrderForm`, so an order created through
`POST` is readable immediately, with no Apps Script sync in the path.

### Registry — `server/api/route-registry.ts` (edit)

```
'work-orders': (): ReturnType<RouteLoader> =>
  import('../modules/work-orders/work-order.module.js').then((module) => module.workOrderRoutes),
```

### Accepts / returns

| endpoint | accepts | returns |
|---|---|---|
| `POST /api/work-orders` | `workOrderCreateSchema` body | 201 `{ data: WorkOrderCreateResponse }` |

### Test edits

- `tests/server/unit/sheets/audit-declarations.dry-test.ts` — change the `OrderForm` entry from
  `{ onAppend: [], onUpdate: ['updated_at'] }` to `{ onAppend: ['timestamp'], onUpdate: ['updated_at'] }`.
- New `tests/server/unit/modules/work-orders/work-order-create.dry-test.ts` — construct
  `new WorkOrderService({ orderFormRepository: () => fakeOrderForm, orderItemWriter: fakeWriter, customerRepository: () => fakeCustomers })`.
  Assert: header appended before items; `status` is `'PENDING'`; `id` matches `/^[0-9a-f]{8}$/`;
  `timestamp` is not on the sent row; every item row carries the header's `service_type`; a throwing
  `createMany` still resolves 201 with `itemsFailed: true`, `itemsCreated: 0`, `itemsRequested: n`;
  a throwing header `append` rejects and `createMany` is never called.
- `tests/server/unit/sheets/order-form.sheets-api.dry-test.ts` — no change required; it exercises
  update only.

### Verify

```
npx tsx tests/server/unit/sheets/audit-declarations.dry-test.ts
npx tsx tests/server/unit/sheets/writing-workbook-binding.dry-test.ts
npx tsx tests/server/unit/sheets/order-form.sheets-api.dry-test.ts
npx tsx tests/server/unit/modules/work-orders/work-order-create.dry-test.ts
npx tsx tests/server/unit/modules/work-orders/work-order.service.dry-test.ts
npm run typecheck:api
npm run build
```

---

## Phase 4 — `order-images` module

Depends on nothing in this plan. The API contract already exists; this phase registers the sheet and
builds the module.

### `server/sheets/OrderImages/OrderImages.db-contract.ts` (new)

```
orderImagesRowSchema = z.object({ ... })       # KEY ORDER = physical column order A..J
 L id: z.string()                              # A
 L customer_id: z.string().nullable()          # B
 L delivery_id: z.string().nullable()           # C
 L order_id: z.string()                        # D
 L image_type: z.string().nullable()           # E  free string, 13 live spellings
 L image_path: z.string().nullable()           # F  Firebase URL on new rows, relative path on legacy rows
 L notes: z.string().nullable()                # G
 L quantity: z.number().nullable()             # H  decimal weight in kg, not a count
 L created_at: z.string().nullable()           # I
 L created_by: z.string().nullable()           # J

orderImagesDbContract = { ... } satisfies SheetContract
 L primaryKey: 'id', sheetName: 'OrderImages', spreadsheetId: 'ORDERS_SPREADSHEET_ID'
 L audit: { onAppend: ['created_at'], onUpdate: [] }
 L writes: { append: true, update: false, delete: false }
 # no valueInput key
```

### `server/sheets/OrderImages/OrderImages.repository.ts` (new)

```
let repository: SheetRepository<OrderImagesDbRow> | undefined
export function getOrderImagesRepository(): SheetRepository<OrderImagesDbRow>
 L return repository ??= new SheetRepository({ contract: orderImagesDbContract })
```

### `server/modules/order-images/order-image.module.ts` (new)

```
orderImageFieldMap = { ... } as const satisfies Record<keyof OrderImagesDbRow & string, string>
 L id: 'orderImageId', customer_id: 'customerId', delivery_id: 'deliveryId', order_id: 'orderId',
   image_type: 'imageType', image_path: 'imagePath', notes: 'notes', quantity: 'quantity',
   created_at: 'createdAt', created_by: 'createdBy'

export function createOrderImageId(): string
 L return generateShortId()                    # no prefix; matches the live OrderImages.id format

export function createOrderImageRepository(): SheetRepositoryContract<OrderImagesDbRow>
 L read / append / batchAppend / update / delete delegating to getOrderImagesRepository()
 L append and batchAppend inject `id: createOrderImageId()`
 # created_at left unset so audit.onAppend stamps it; delivery_id written when supplied

export class OrderImageService extends BaseCrudService<...>
constructor(input: OrderImageServiceOptions = {})
 L super({ repository: input.repository ?? createOrderImageRepository(),
           api: orderImageApiContract, searchFields: [], fieldMap: orderImageFieldMap })

export const orderImageService = new OrderImageService()
export const orderImageRoutes = createCrudRoutes(orderImageService, orderImageApiContract)
```

No `list` override: `OrderImages.id` has zero nulls across 17,376 live rows, so there is no phantom
class to filter.

The binary never reaches the API. `src/api/storage.js` `uploadRaw(file, folder)` already uploads to
Firebase Storage and returns a download URL string; `POST /api/order-images` records which URL
belongs to which order. A Vercel serverless function is a poor place for a file body (payload
limits, cold-start memory, no streaming), and the upload path already exists and works.

### Registry — `server/api/route-registry.ts` (edit)

```
'order-images': (): ReturnType<RouteLoader> =>
  import('../modules/order-images/order-image.module.js').then((module) => module.orderImageRoutes),
```

### Test edits

- `tests/server/unit/sheets/sheet-binding.dry-test.ts` — `expectedSheetCount` -> 17 (16 without
  Phase 1); add `'OrderImages'` + a binding entry `{ ORDERS_SPREADSHEET_ID, 'OrderImages' }`.
- `tests/server/unit/sheets/column-order.dry-test.ts` — add `id:A` .. `created_by:J`, PK column `A`.
- `tests/server/unit/sheets/repository-getters.dry-test.ts` — add `getOrderImagesRepository`.
- `tests/server/unit/sheets/audit-declarations.dry-test.ts` — add
  `OrderImages: { onAppend: ['created_at'], onUpdate: [] }`.
- `tests/server/unit/sheets/module-laziness.dry-test.ts` — add
  `'order-images/order-image.module.js'`; bump the final count string 11 -> 12. (The literal starts
  at `'9 module laziness checks passed'`; Phase 1 takes it to 10, Phase 2 to 11.)
  Note this test's `relevantEnvironmentKeys` is 6 keys and does not include
  `ORDERS_SPREADSHEET_ID`, so it does not actually prove the new modules leave that env unread at
  import time. Adding it is out of scope here.
- `tests/server/integration/sheet-column-parity.ts` — add `OrderImages` to `readableSheets`.
- New `tests/server/unit/api/route-registry-order-images.dry-test.ts`.
- New `tests/server/unit/modules/order-images/order-image-wiring.dry-test.ts` — same template as
  Phase 1, with `Allow: GET, POST` on the collection and `Allow: GET` on the item.

### Verify

Same command list as Phase 1 with the `order-images` paths substituted.

---

## Dependency order

```
1 order-items      -> ships alone; the add-item overlay works
   L 2 work-orders read  ─┐  these two deploy together: the contract's create slot is already
        L 3 work-orders create ─┘  live, so the registry key only lands in Phase 3

4 order-images     -> ships alone, independent of 1, 2 and 3
```

What each delivers by itself:

- 1 — the add-item overlay can list an order's real items and append one. Item `serviceType` is
  inherited from the parent order, never sent by the client.
- 2 — the staff list and detail pages render live `OrderForm` data with a customer name. Both routes
  read the same sheet, so they cannot disagree. Not independently deployable: no registry key until
  Phase 3.
- 3 — the create-order page can submit, and the new order is readable from detail immediately.
- 4 — the capture overlay can record a photo row against an order.

The display lane (`GET /api/orders`, `OrdersView`) keeps working unchanged throughout.

## Edge Cases

`GET /api/work-orders`
- `customerId` omitted -> unfiltered list, GViz drops the empty where clause (`gviz-query.builder.ts:128-130`)
- `status` omitted -> no status clause
- `perPage` > 500 -> 422, not clamped
- Customers row missing for a `customerId` -> `customerName: ''`, row still returned
- more than one `customerId` in the page -> whole Customers sheet is read once per request
- duplicate `CustomerID` rows -> first row wins
- `meta.pagination` carries `page` and `perPage` only; there is no `total` and no COUNT query

`GET /api/work-orders/:id`
- id not found -> 404 `Resource '<id>' not found`
- id matches >1 row -> 409
- empty/whitespace id -> 400 `id is required`
- 3+ path segments -> 404 `Route not found`
- an order created via `POST` is readable immediately; no sync is in the path

`GET /api/order-items`
- `orderId` missing -> 422; the parameter is required so a bare list can never return the
  23,165-row sheet
- phantom row (blank `id`, `quantity` 0.0 from the column-E fill-down) -> its `order_id` is blank, so
  it never matches an `orderId` filter; a row that reaches the service with a blank `orderItemId` is
  dropped by the `list` override
- Thai `service_type` values (`ซักรีด`, `รีดผ้า`, `ซักแห้ง`, `ซักพับ`) -> returned verbatim, never coerced
- `credits_used` non-integer -> returned verbatim
- `invoice_item_id` is not exposed at all: it is mapped in the field map but absent from
  orderItemResponseSchema, so `project` drops it. Same for `updated_at` / `updated_by`.

`POST /api/order-items`
- `serviceType` supplied by the client -> not in the request schema, ignored; the value is taken
  from the parent order's `OrderForm.service_type`
- `orderId` that matches no OrderForm row -> 404
- `category` outside the four offered -> 422; `Bedding` is not accepted
- duplicate generated id -> `DuplicatePrimaryKeyError` from the pre-append check, surfaces as 500
- `timestamp` supplied by the client -> not in the request schema, ignored

`POST /api/work-orders`
- header append fails -> the error propagates, no items were attempted, nothing is written
- items append fails after the header succeeded -> 201, `itemsFailed: true`, `itemsCreated: 0`,
  `itemsError` set; the order exists with no lines and is completed from the detail screen
- `items: []` -> 201, `itemsRequested: 0`, `itemsFailed: false`
- `serviceType` `DRCL` or `WASH` -> accepted once the db-contract enum is widened; rejected before that
- the appended row's `timestamp` is `yyyy-MM-dd HH:mm:ss` while existing cells are `dd/MM/yyyy HH:mm:ss`
- never retry a failed order create: the write may have committed unreadably and a retry duplicates
  the order

`GET /api/order-images`
- `orderId` missing -> 422
- legacy relative `image_path` (`OrderForm_Images/<id>.form_image.<n>.jpg`) -> returned verbatim
- 13 live `image_type` spellings and 1,329 blanks -> returned verbatim, never normalised
- `created_at` in either ISO-with-`Z` or `dd/MM/yyyy HH:mm:ss` -> returned verbatim

`POST /api/order-images`
- `imagePath` not starting `http://` or `https://` -> 422
- `imageType` outside the seven -> 422
- `deliveryId` supplied -> written to column C; omitted -> the column is left blank

All modules
- a GViz column that maps to no DB field -> throws; that is contract drift, not dirty data
- a dirty cell value -> never 500s; reads are not runtime-validated
- an unregistered module key -> 404 `Route not found`
- a method with no slot -> 405 with an `Allow` header listing the attached methods
- `PATCH` on any of these routes -> 405; `response.update` is never declared
- `DELETE` on any of these routes -> 405

## Risks

- **`work-orders` list carries no `items`.** `OrderForm` has no `items_json`, and fetching lines per
  row would be one GViz read per order. A list screen that needs an item count or preview cannot get
  it from this endpoint; the display lane (`GET /api/orders`) still has `items` from
  `OrdersView.items_json` if a screen genuinely needs them. Decide per screen, do not fan out reads.
- **Two-sheet write with no transaction.** `SheetRepository.delete()` throws
  (`sheet.repository.ts:684-688`) and the Sheets client exposes only `values.*`, so no rollback
  exists. A compensating transaction on top of Sheets is not maintainable; the recoverable
  half-created order is the accepted outcome.
- **The two lanes will disagree after any write**, until Apps Script syncs `OrdersView` on its
  unmeasured interval. That is now visible in the URL rather than hidden inside one module, but a
  screen that mixes both sources will still show two versions of the same order.
- **Appended timestamps are `yyyy-MM-dd HH:mm:ss` while legacy cells are `dd/MM/yyyy HH:mm:ss`.**
  `BANGKOK_TIMESTAMP_PATTERN` (`sheet.repository.ts:51`) rejects anything else, so this is not
  fixable from the caller and the two formats coexist.
- **`OrderForm.service_type` widens from 2 to 4 values.** A read of an existing `DRCL` row stops
  being a contract lie; nothing else reads that enum.
- **`OrderForm.status` is a 6-member db enum** (`PENDING`, `RECEIVED`, `SUBMITTED`, `APPROVED`,
  `COMPLETED`, `CANCELLED`) and this plan does not widen it, unlike `service_type`. Reads are not
  runtime-validated so a stray value will not 500, but the db-contract type is a lie for any row
  outside those six. Nobody has sampled the live column.
- **`OrderForm.writes.append` flips to `true`.** The workbook `1tfgJvj` already has service-account
  Editor access and already accepts `update`; no new access grant is needed.
- **Write-error classes are not mapped to HTTP.** Anything other than an `ApiError` becomes 500 with
  a generic message; only `DuplicatePrimaryKeyError` is translated, and only by the packages module.
- **GViz silently falls back to the first sheet when `sheet=` names a tab the workbook does not
  have.** A query for `OrdersView` against `ORDERS_SPREADSHEET_ID` returns `OrderForm` rows with no
  error, which reads as "the two sheets are identical". Any manual verification against a live sheet
  must confirm the returned header row matches the sheet being asked for.

## Open questions

- **id formats are settled.** All three sheets use a bare 8-character lowercase hex id with no
  prefix — sampled live: `OrderForm.id` `117ac0a1`, `OrderItemForms.id` `fc60a477`,
  `OrderImages.id` `1499bc46`. `generateShortId()` (`server/shared/utils/id.ts:4`) returns exactly
  that, so all three modules call it bare. Do not reintroduce a prefix.

## Not in this plan

- any change to `contracts/orders/order-api.schema.ts`, `server/modules/orders/order.module.ts`, or
  the `OrdersView` sheet — the display lane is untouched
- cleaning dirty live data: the 1,074 phantom `OrderItemForms` rows, the 8 `service_type` spellings,
  the 13 `image_type` spellings, the 5 `category` values, the dual `image_path` and `created_at`
  formats
- any Apps Script change, including adding a column to `OrdersView` or measuring the sync interval
- editing `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`
- `PATCH`/`DELETE` on any of the three new modules; `writes.update` and `writes.delete` stay `false`
  on both new sheets
- keyword search: `searchFields` stays `[]` on all three modules, so `keyword` remains a no-op
- `pagination.total` / `totalPages`
- moving photo-capture code out of `src/features/gallery/`, `src/api/`, `src/composables/`,
  `src/utils/` into a shared location
- the `OrderItems` sheet behind `OrderItemForms.item_id`
- `credits_used` and package-credit consumption on order items
- `invoice_item_id` writes
- binary upload through the API
- retiring `src/features/orders/mocks/order-prototype.fixture.ts` and pointing
  `src/features/orders/stores/order.store.ts` at `/api/work-orders`
- frontend changes of any kind

## Status

FINAL. Supersedes the single-module version of this plan (2026-08-30): `OrdersView` and `OrderForm`
are now separate modules on separate URLs.
