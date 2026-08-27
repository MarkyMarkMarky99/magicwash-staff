# Customer package read path: service-side assembly

## Scope

Replace `CustomerPackageView` GViz reads behind `GET /api/customer-packages` and
`GET /api/customer-packages/:id` with an in-service join over `CustomerPackages`,
`PackageTransactions`, `Packages`, `Customers`. Response bytes, routes, query params and status
codes unchanged. Write paths, `contracts/customer-packages/customer-package-api.schema.ts`, and
`G:\My Drive\Magicwash\Database\GoogleSheets\*.json` are not touched.

## Functions

### Files

```
server/shared/utils/bangkok-date.ts                                  # NEW
server/modules/customer-packages/customer-package-assembly.ts        # NEW, pure, no repo imports
server/modules/customer-packages/customer-package-read.service.ts    # NEW
server/modules/customer-packages/customer-package-view.module.ts     # EDIT, filename unchanged
server/api/route-registry.ts                                         # UNCHANGED
server/modules/customer-packages/customer-package.mapping.ts         # UNCHANGED
server/sheets/CustomerPackageView/CustomerPackageView.db-contract.ts # KEEP, no production reader
server/sheets/CustomerPackageView/CustomerPackageView.repository.ts  # KEEP, no production reader
tests/server/unit/sheets/service-wiring.dry-test.ts                  # EDIT
tests/server/unit/modules/customer-packages/customer-package-assembly.dry-test.ts     # NEW
tests/server/unit/modules/customer-packages/customer-package-read.service.dry-test.ts # NEW
```

`server/sheets/CustomerPackageView/*` stays on disk and stays registered in
`sheet-binding.dry-test.ts`, `column-order.dry-test.ts`, `repository-getters.dry-test.ts`,
`tests/server/integration/sheet-column-parity.ts`. After this change nothing under `server/modules/`
or `api/` imports `getCustomerPackageViewRepository` or `customerPackageViewRowSchema`.

---

### `server/shared/utils/bangkok-date.ts`

```
GVIZ_DATE_PATTERN                          # /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/
```

Metadata datetime format across this module is `yyyy-MM-dd HH:mm:ss`, Asia/Bangkok, zero-padded,
no offset — the project standard enforced by `BANGKOK_TIMESTAMP_PATTERN` in
`server/shared/repositories/sheet.repository.ts:51` and produced by `formatBangkokTimestamp`.
ISO `+07:00` is never emitted.

```
pad2(value: string | number) -> string                                        # private
 L return String(value).padStart(2, '0')
```

```
bangkokToday(now?: Date) -> string
 L new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
 L .format(now ?? new Date())                # en-CA yields YYYY-MM-DD
 L return string
```

```
normalizeSheetDate(value: unknown) -> string | null
 L if value == null -> return null
 L text = String(value).trim()
 L if text == '' -> return null
 L m = GVIZ_DATE_PATTERN.exec(text)
 L if m != null
    L month = Number(m[2])
    L if month < 0 || month > 11 -> return text
    L return `${m[1]}-${pad2(month + 1)}-${pad2(m[3])}`
 L if /^\d{4}-\d{2}-\d{2}/.test(text) -> return text.slice(0, 10)
 L return text
```

```
normalizeSheetTimestamp(value: unknown) -> string
 L if value == null -> return ''
 L text = String(value).trim()
 L if text == '' -> return ''
 L m = GVIZ_DATE_PATTERN.exec(text)
 L if m != null
    L month = Number(m[2])
    L if month < 0 || month > 11 -> return text
    L datePart = `${m[1]}-${pad2(month + 1)}-${pad2(m[3])}`
    L if m[4] == undefined -> return `${datePart} 00:00:00`
    L return `${datePart} ${pad2(m[4])}:${pad2(m[5])}:${pad2(m[6])}`
 L iso = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(text)
 L if iso != null -> return `${iso[1]} ${iso[2]}`
 L if /^\d{4}-\d{2}-\d{2}$/.test(text) -> return `${text} 00:00:00`
 L return text
```

```
toNumber(value: unknown) -> number
 L if typeof value == 'number' -> return Number.isFinite(value) ? value : 0
 L if value == null -> return 0
 L text = String(value).trim().replace(/,/g, '')
 L if text == '' -> return 0
 L parsed = Number(text)
 L return Number.isFinite(parsed) ? parsed : 0
```

```
toRequiredString(value: unknown) -> string
 L if value == null -> return ''
 L return String(value)                       # NEVER trims: GViz `=` join keys are exact, and today's project() copies cells verbatim
```

```
toNullableString(value: unknown) -> string | null
 L text = toRequiredString(value)
 L return text == '' ? null : text            # only the exact empty string becomes null; a whitespace-only cell stays a whitespace string
```

`server/shared/utils/bangkok-timestamp.ts` and `server/modules/price-list/price-list.module.ts` are
not modified and not refactored onto these helpers.

Why `normalizeSheetDate` and `normalizeSheetTimestamp` exist here, against the general
`api/CLAUDE.md:269` rule "GViz date strings are returned raw; do not parse or format them in the
backend":

```
- CustomerPackageView is a formula sheet; its startDate/expiryDate/transactionsJson cells are formula OUTPUT, i.e. text
- source reads replace formula output with the underlying CustomerPackages / PackageTransactions cells
- both sheets are written with request-wide USER_ENTERED (server/shared/contracts/sheet-contract.ts:29-36 — valueInput is a guard, NOT the wire value; an absent valueInput key declares nothing)
- the same writer + USER_ENTERED path already produced real datetime columns on Invoices.created_at and OrderForm.updated_at (docs/phase-2-handoff.md:167-188) and on Appointments.CreatedAt/UpdatedAt after the 373-cell repair (docs/phase-2-handoff.md:206-240)
- GViz types a COLUMN, not a cell, and returns Date(y,m,d[,h,mi,s]) in `.v` for a date/datetime column
=> without normalization this endpoint would newly emit `Date(2026,7,1)` where it emits `2026-08-01` today, and `Date(2026,7,25,12,0,0)` where it emits `2026-08-02 10:00:00` today
```

The two helpers are scoped to this module's four source columns. They are not applied to any other
endpoint, and `gviz-reader.ts` is not changed — the general raw-passthrough policy stands everywhere
else, and the frontend keeps unwrapping `Date(...)` with `src/shared/utils/sheet-date.ts` on the
endpoints that already leak it.

---

### `server/modules/customer-packages/customer-package-assembly.ts`

Local type aliases derived with `z.infer` at the top of this file, from
`customersRowSchema`, `customerPackagesRowSchema`, `packageTransactionsRowSchema`,
`packagesRowSchema` and `customerPackagePortalRowSchema` / `packageTransactionSchema`.
DB column names are read directly; `Mapper` and `customer-package.mapping.ts` are not used here.

```
export const CUSTOMER_PACKAGE_SEARCH_FIELDS = ['customerPackageId', 'customerId', 'customerName', 'packageCode'] as const
```

```
export interface CustomerPackageLedger {
  entries: PackageTransactionApiRow[]
  remainingCredit: number
  usedCredit: number
  totalCredit: number
}
```

```
export interface CustomerPackageSources {
  packages: Array<Partial<CustomerPackagesDbRow>>
  transactions: Array<Partial<PackageTransactionsDbRow>>
  catalog: Array<Partial<PackagesDbRow>>
  customers: Array<Partial<CustomersDbRow>>
  today: string                              # YYYY-MM-DD Asia/Bangkok
}
```

```
export function groupTransactionsByPackage(rows: Array<Partial<PackageTransactionsDbRow>>) -> Map<string, Array<Partial<PackageTransactionsDbRow>>>
 L grouped = new Map()
 L for row of rows
    L key = toRequiredString(row.customer_package_id)
    L if key == '' -> continue
    L grouped.get(key) ?? grouped.set(key, []) ; push row
 L return grouped
```

```
export function buildLedger(rows: Array<Partial<PackageTransactionsDbRow>>) -> CustomerPackageLedger
 L sorted = rows.map(row => ({ row, stamp: normalizeSheetTimestamp(row.created_at), id: toRequiredString(row.id) }))
 L sorted.sort((a, b) => a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
 L running = 0 ; used = 0
 L entries = []
 L for item of sorted
    L change = toNumber(item.row.credit_change)
    L running = running + change
    L if change < 0 -> used = used + (-change)
    L entries.push({                          # key order fixed by packageTransactionSchema
        id: toRequiredString(item.row.id),
        type: item.row.type,                  # passed through as stored, no enum validation
        creditChange: change,
        remainingCredit: running,
        referenceSource: toNullableString(item.row.reference_source),
        referenceId: toNullableString(item.row.reference_id),
        notes: toNullableString(item.row.notes),
        createdAt: normalizeSheetTimestamp(item.row.created_at),   # yyyy-MM-dd HH:mm:ss, no offset
      })
 L return { entries, remainingCredit: running, usedCredit: used, totalCredit: running + used }
```

```
export function resolveStatus(input: { deletedAt: unknown; startDate: string | null; expiryDate: string | null; today: string }) -> 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
 L if toNullableString(input.deletedAt) != null -> return 'CANCELLED'
 L if input.startDate != null && input.today < input.startDate -> return 'INACTIVE'
 L if input.expiryDate != null && input.today > input.expiryDate -> return 'EXPIRED'
 L return 'ACTIVE'
```

```
export function assembleCustomerPackageRow(input: {
  pkg: Partial<CustomerPackagesDbRow>
  ledger: CustomerPackageLedger
  catalogRow: Partial<PackagesDbRow> | undefined
  customerRow: Partial<CustomersDbRow> | undefined
  today: string
}) -> CustomerPackagePortalRow
 L startDate = normalizeSheetDate(input.pkg.start_date)
 L expiryDate = normalizeSheetDate(input.pkg.expiry_date)
 L return {                                   # key order fixed by customerPackagePortalRowSchema
     customerPackageId: toRequiredString(input.pkg.id),
     customerId: toRequiredString(input.pkg.customer_id),
     customerName: toRequiredString(input.customerRow?.CustomerName),
     customerPhone: toNullableString(input.customerRow?.Phone),
     customerAddress: toNullableString(input.customerRow?.Address),
     packageCode: toRequiredString(input.pkg.package_code),
     packageName: toRequiredString(input.catalogRow?.name),
     packageEligibleService: toRequiredString(input.catalogRow?.eligible_service),
     startDate,
     expiryDate,
     status: resolveStatus({ deletedAt: input.pkg.deleted_at, startDate, expiryDate, today: input.today }),
     serviceDay: toNullableString(input.pkg.service_day),
     timeSlot: toNullableString(input.pkg.time_slot),
     invoiceId: toNullableString(input.pkg.invoice_id),
     notes: toNullableString(input.pkg.notes),
     remainingCredit: input.ledger.remainingCredit,
     usedCredit: input.ledger.usedCredit,
     totalCredit: input.ledger.totalCredit,
     transactions: input.ledger.entries,
   }
```

```
export function assembleCustomerPackageRows(sources: CustomerPackageSources) -> CustomerPackagePortalRow[]
 L byPackage = groupTransactionsByPackage(sources.transactions)
 L catalogByCode = firstByKey(sources.catalog, row => toRequiredString(row.package_code))
 L customersById = firstByKey(sources.customers, row => toRequiredString(row.CustomerID))
 L return sources.packages.map(pkg =>
     assembleCustomerPackageRow({
       pkg,
       ledger: buildLedger(byPackage.get(toRequiredString(pkg.id)) ?? []),
       catalogRow: catalogByCode.get(toRequiredString(pkg.package_code)),
       customerRow: customersById.get(toRequiredString(pkg.customer_id)),
       today: sources.today,
     }))
```

```
private firstByKey<T>(rows: T[], keyOf: (row: T) => string) -> Map<string, T>
 L map = new Map()
 L for row of rows
    L key = keyOf(row)
    L if key == '' -> continue
    L if !map.has(key) -> map.set(key, row)   # first row wins on duplicate key
 L return map
```

```
export function matchesKeyword(row: CustomerPackagePortalRow, keyword: string) -> boolean
 L needle = keyword.replace(/'/g, '')         # mirrors GVizQueryBuilder sanitizeValue; needle is NOT trimmed
 L if needle == '' -> return true
 L return CUSTOMER_PACKAGE_SEARCH_FIELDS.some(field => String(row[field] ?? '').includes(needle))   # case-sensitive, haystack untrimmed, mirrors GViz `contains`
```

```
export function compareRows(a: CustomerPackagePortalRow, b: CustomerPackagePortalRow, sortBy: string, sortOrder: 'asc' | 'desc') -> number
 L av = a[sortBy] ; bv = b[sortBy]
 L aEmpty = av == null || av === '' ; bEmpty = bv == null || bv === ''
 L if aEmpty && bEmpty -> cmp = 0
   else if aEmpty -> cmp = -1                 # GViz sorts blanks first ascending
   else if bEmpty -> cmp = 1
   else if typeof av == 'number' && typeof bv == 'number' -> cmp = av - bv
   else
    L sa = String(av) ; sb = String(bv)
    L cmp = sa < sb ? -1 : sa > sb ? 1 : 0    # plain code-unit compare, not localeCompare
 L return sortOrder == 'desc' ? -cmp : cmp
```

---

### `server/modules/customer-packages/customer-package-read.service.ts`

```
export interface CustomerPackageReadServiceOptions {
  packageRepository: () => SheetRepositoryContract<CustomerPackagesDbRow>
  transactionRepository: () => SheetRepositoryContract<PackageTransactionsDbRow>
  catalogRepository: () => SheetRepositoryContract<PackagesDbRow>
  customerRepository: () => SheetRepositoryContract<CustomersDbRow>
  now?: () => Date
}
```

```
export class CustomerPackageReadService
```

```
constructor(input: CustomerPackageReadServiceOptions) -> CustomerPackageReadService
 L store all four getters as fields, uncalled     # keeps module import env-free, module-laziness.dry-test.ts must stay green
 L this.now = input.now ?? (() => new Date())
```

```
async list(query: unknown) -> Promise<ServiceListResult<CustomerPackageListResponse>>
 L validQuery = parseOrThrow(customerPackageApiContract.query.list, query)
 L today = bangkokToday(this.now())
 L [packages, transactions, catalog, customers] = await Promise.all([   # 4 GViz reads, constant
    L this.packageRepository().read(new ReadQueryDTO({ where: dropEmpty({ customer_id: validQuery.customerId, package_code: validQuery.packageCode }) }))
    L this.transactionRepository().read(new ReadQueryDTO({}))
    L this.catalogRepository().read(new ReadQueryDTO({ where: dropEmpty({ package_code: validQuery.packageCode }) }))
    L this.customerRepository().read(new ReadQueryDTO({ where: dropEmpty({ CustomerID: validQuery.customerId }) }))
   ])                                            # no `pagination` on any DTO -> no GViz limit/offset
 L rows = assembleCustomerPackageRows({ packages, transactions, catalog, customers, today })
 L filtered = rows.filter(row => matchesKeyword(row, validQuery.keyword))
 L if validQuery.status != null -> filtered = filtered.filter(row => row.status === validQuery.status)
 L sorted = filtered.slice().sort((a, b) => compareRows(a, b, validQuery.sortBy, validQuery.sortOrder))   # Array.sort is stable, ties keep sheet order
 L start = (validQuery.page - 1) * validQuery.perPage
 L pageRows = sorted.slice(start, start + validQuery.perPage)
 L return { items: pageRows.map(row => projectRow(row, customerPackageApiContract.response.list)), pagination: { page: validQuery.page, perPage: validQuery.perPage } }
```

```
async getById(id: string) -> Promise<CustomerPackageDetailResponse>
 L safeId = id.trim()
 L if safeId == '' -> throw ApiError.badRequest('id is required')
 L packages = await this.packageRepository().read(ReadQueryDTO.fromId(safeId))    # read 1
 L if packages.length == 0 -> throw ApiError.notFound(`Resource '${safeId}' not found`)
 L if packages.length > 1 -> throw ApiError.conflict(`Resource '${safeId}' resolved to multiple rows`)
 L pkg = packages[0]
 L today = bangkokToday(this.now())
 L [transactions, catalog, customers] = await Promise.all([                        # reads 2-4; where-values taken verbatim from the fetched row, NOT from safeId, so the GViz `=` value equals the in-memory group key
    L this.transactionRepository().read(new ReadQueryDTO({ where: dropEmpty({ customer_package_id: toRequiredString(pkg.id) }) }))
    L this.catalogRepository().read(new ReadQueryDTO({ where: dropEmpty({ package_code: toRequiredString(pkg.package_code) }) }))
    L this.customerRepository().read(new ReadQueryDTO({ where: dropEmpty({ CustomerID: toRequiredString(pkg.customer_id) }) }))
   ])
 L rows = assembleCustomerPackageRows({ packages: [pkg], transactions, catalog, customers, today })
 L return projectRow(rows[0], customerPackageApiContract.response.detail)
```

```
private dropEmpty(where: Record<string, unknown>) -> Record<string, unknown>
 L omit keys whose value is null, undefined or ''   # GVizQueryBuilder already ignores them; this keeps the emitted query identical
```

```
private projectRow<TResponse>(row: Record<string, unknown>, schema: { shape: Record<string, unknown> }) -> TResponse
 L output = {}
 L for field of Object.keys(schema.shape) -> output[field] = row[field]   # key order = schema shape order; list schema omits `transactions`
 L return output as TResponse
```

```
export const customerPackageReadService = new CustomerPackageReadService({
  packageRepository: getCustomerPackagesRepository,
  transactionRepository: getPackageTransactionsRepository,
  catalogRepository: getPackagesRepository,
  customerRepository: getCustomersRepository,
})
```

`getCustomerPackagesRepository`, `getPackagesRepository` and `getPackageTransactionsRepository` are
passed as the same function references already used by `customerPackagePurchaseService` and
`packageTransactionService`, so the `assert.strictEqual` singleton checks in
`service-wiring.dry-test.ts` extend to this service unchanged.

---

### `server/modules/customer-packages/customer-package-view.module.ts` (EDIT)

```
delete: customerPackageViewFieldMap
delete: customerPackageViewJsonColumns
delete: customerPackageViewService
delete: type CustomerPackageViewDbRow, CustomerPackageViewApiRow, CustomerPackageViewService
delete: imports of BaseCrudService, JsonColumnMap, ApiRowFromFieldMap, getCustomerPackageViewRepository, customerPackageViewRowSchema, z
keep: statusForCreateResponse
keep: customerPackageRoutes                    # exported name unchanged, route-registry.ts untouched
add: import { customerPackageReadService } from './customer-package-read.service.js'
add: export { customerPackageReadService } from './customer-package-read.service.js'
```

```
customerPackageRoutes.collection.GET(req) -> ApiResult
 L { items, pagination } = await customerPackageReadService.list(req.query)
 L return okPaged(items, pagination)

customerPackageRoutes.collection.POST(req) -> ApiResult      # unchanged
customerPackageRoutes.item.GET(req) -> ApiResult
 L return ok(await customerPackageReadService.getById(req.params.id))
customerPackageRoutes.item.PATCH() -> never
 L throw ApiError.notFound('Route not found')                # unchanged, still always 404
```

---

### Read plan

| | reads | GViz `where` server-side | applied in memory |
|---|---|---|---|
| list | 4, all in one `Promise.all` | `CustomerPackages.customer_id`, `CustomerPackages.package_code`, `Packages.package_code`, `Customers.CustomerID` | keyword, `status`, `sortBy`/`sortOrder`, `page`/`perPage` |
| detail | 4, in 2 waves (1 then 3) | `CustomerPackages.id`, `PackageTransactions.customer_package_id`, `Packages.package_code`, `Customers.CustomerID` | nothing |

Not N+1: the ledger is fetched once per request, whole-tab for list, and grouped by
`customer_package_id` in `groupTransactionsByPackage`. Read count is 4 regardless of how many
packages the page contains. No repository call happens inside any `map`/`for` over rows.

No `select` is passed on any `ReadQueryDTO`; every read is `select *`.

### Query-param mapping (one-for-one against today's `BaseCrudService`)

| param | today | after |
|---|---|---|
| `keyword` | GViz `contains` OR over the 4 search fields, apostrophes stripped, empty skipped | `matchesKeyword`, same 4 fields, same apostrophe strip, same case sensitivity, empty skipped |
| `customerId` | GViz `=` on view `customerId` | GViz `=` on `CustomerPackages.customer_id` and `Customers.CustomerID` |
| `status` | GViz `=` on view `status` | in-memory `===` after `resolveStatus` |
| `packageCode` | GViz `=` on view `packageCode` | GViz `=` on `CustomerPackages.package_code` and `Packages.package_code` |
| `sortBy` | GViz `order by` | `compareRows` |
| `sortOrder` | GViz `asc`/`desc` | `compareRows` |
| `page` / `perPage` | GViz `limit`/`offset` | `Array.slice` after sort |
| response `pagination` | `{ page, perPage }` | `{ page, perPage }` |
| detail blank id | `ApiError.badRequest('id is required')` | identical |
| detail 0 rows | `ApiError.notFound("Resource '<id>' not found")` | identical |
| detail >1 row | `ApiError.conflict("Resource '<id>' resolved to multiple rows")` | identical |

### Named deviations

```
DEVIATION-1  list reads CustomerPackages, PackageTransactions and (unfiltered cases) Packages + Customers in full on every request; GViz no longer applies limit/offset. Accepted, unbounded in row count.
DEVIATION-2  a CustomerPackageView row that has no matching CustomerPackages row disappears from list and detail.
```

`transactions[].createdAt`, `startDate` and `expiryDate` are NOT deviations: `normalizeSheetTimestamp`
emits `yyyy-MM-dd HH:mm:ss` and `normalizeSheetDate` emits `YYYY-MM-DD`, which is byte-for-byte what
the view sheet emits today (`tests/server/unit/sheets/service-wiring.dry-test.ts:621` pins
`'2026-08-02 10:00:00'`).

Registry note, no action: `G:\My Drive\Magicwash\Database\GoogleSheets\CustomerPackageView.json`
describes `transactionsJson[].createdAt` as "ISO 8601 with the +07:00 offset". The code standard
(`yyyy-MM-dd HH:mm:ss`, no offset) wins and the code is what changes — the registry is read-only and
is not edited by this work. Report the drift, do not resolve it here.

## Edge Cases

### `resolveStatus`

- `deleted_at` set (any non-blank value) -> `CANCELLED`, regardless of dates
- `deleted_at` set AND today past `expiryDate` -> `CANCELLED`
- `startDate` null -> never `INACTIVE`
- `expiryDate` null -> never `EXPIRED`
- `startDate` == today -> `ACTIVE`
- `expiryDate` == today -> `ACTIVE`
- both dates null, no `deleted_at` -> `ACTIVE`
- `remainingCredit` <= 0 -> no effect on status

### `buildLedger`

- zero transactions -> `{ entries: [], remainingCredit: 0, usedCredit: 0, totalCredit: 0 }`
- all `credit_change` positive -> `usedCredit == 0`, `totalCredit == remainingCredit`
- spend exceeds grant -> `remainingCredit` negative, never clamped; `usedCredit > totalCredit`
- `Packages.included_credit` -> never read by the ledger
- equal `created_at` -> tie-broken by ascending `id`
- `created_at` blank -> `createdAt: ''`, sorts first
- `created_at` unparseable -> `createdAt` emitted as the raw trimmed string, sorts by that string
- `created_at` GViz `Date(y,m,d,h,mi,s)` -> `yyyy-MM-dd HH:mm:ss`
- `created_at` already `yyyy-MM-dd HH:mm:ss` text -> passes through unchanged
- `credit_change` arrives as a numeric string -> `toNumber` coerces
- `credit_change` blank or unparseable -> counted as `0`
- transaction row with blank `customer_package_id` -> dropped by `groupTransactionsByPackage`
- transaction row whose `customer_package_id` matches no package -> never surfaced

### `assembleCustomerPackageRow`

- orphan customer (no `Customers` row) -> `customerName: ''`, `customerPhone: null`, `customerAddress: null`
- `Customers.Phone` returned as a GViz number -> `String()`d, not parsed
- `Customers.Phone` / `Address` blank -> `null`
- missing `Packages` row -> `packageName: ''`, `packageEligibleService: ''`
- `Packages.deleted_at` set -> resolved normally, no filtering
- duplicate `package_code` in `Packages` -> first row wins
- duplicate `CustomerID` in `Customers` -> first row wins
- `start_date` / `expiry_date` returned as GViz `Date(y,m,d)` -> normalized to `YYYY-MM-DD`
- `start_date` / `expiry_date` blank -> `null`
- `CustomerPackages` row with blank `id` -> kept in list, gets an empty ledger
- padded cell behind a `toRequiredString` / `toNullableString` field -> emitted verbatim, never trimmed # applies to customerPackageId, customerId, customerName, customerPhone, customerAddress, packageCode, packageName, packageEligibleService, serviceDay, timeSlot, invoiceId, notes, transactions[].id, transactions[].referenceSource, transactions[].referenceId, transactions[].notes
- padded cell behind `normalizeSheetDate` / `normalizeSheetTimestamp` / `toNumber` -> trimmed by those helpers # applies to startDate, expiryDate, transactions[].createdAt, transactions[].creditChange and the credit totals
- whitespace-only `deleted_at` -> treated as set -> `CANCELLED`
- whitespace-only `Phone` / `Address` / `notes` -> emitted as that whitespace string, not `null`

### `list`

- cancelled package -> present in results; excluded only when `status` filter is set to another value
- empty result set -> `{ items: [], pagination: { page, perPage } }`, 200
- `page` beyond the last page -> empty `items`, same pagination echo
- `keyword` == `''` -> no keyword filtering
- `keyword` containing `'` -> apostrophes stripped before matching
- sort key null/blank -> sorts first on `asc`, last on `desc`
- `transactions` -> absent from every list item, dropped by `projectRow` against the list schema

### `getById`

- id of a `CANCELLED` package -> 200 with `status: 'CANCELLED'`
- id with surrounding whitespace -> trimmed, then matched
- id `''` or whitespace-only -> 400 `id is required`
- unknown id -> 404
- duplicate id rows in `CustomerPackages` -> 409
- package with zero transactions -> 200, `transactions: []`, all three credit fields `0`

## Test Plan

### Must be updated

```
tests/server/unit/sheets/service-wiring.dry-test.ts
 L env block at the top of the file
    L add process.env.CUSTOMERS_SPREADSHEET_ID = 'characterization-customers-id'   # Customers.db-contract requires it; SheetRepository.read calls requireEnv
    L leave PORTAL_SPREADSHEET_ID / APPOINTMENTS_SPREADSHEET_ID / LAUNDRY_PACKAGES_SPREADSHEET_ID as they are
 L add helper: sheetGvizBody(rowSchema, values: unknown[]) -> string
    L columns = deriveGVizColumns(rowSchema)                          # import from server/shared/repositories/utils/gviz-query.builder.js
    L keys = Object.keys(rowSchema.shape)
    L assert values.length === keys.length                            # fixture must supply every column
    L return a gviz body whose cols ids are keys.map(key => columns[key]) in that exact order
 L productionCustomerPackageService() -> import { customerPackageReadService } from customer-package-view.module.js
 L test 'CustomerPackageView service wiring decodes and safely falls back for transactions JSON'
    L rename -> 'customer-package read service assembles list and detail from four source sheets'
    L mock fetch: switch on the decoded `sheet=` query param, one branch per tab name
       L 'CustomerPackages'    -> sheetGvizBody(customerPackagesRowSchema, [...])
       L 'PackageTransactions' -> sheetGvizBody(packageTransactionsRowSchema, [...])
       L 'Packages'            -> sheetGvizBody(packagesRowSchema, [...])
       L 'Customers'           -> sheetGvizBody(customersRowSchema, [...])
       L default -> throw, so an unrouted read fails loudly instead of returning an empty table
    L assert list read count == 4
    L assert detail read count == 4
    L assert listRow.customerName comes from the Customers fixture
    L assert detail.transactions running remainingCredit and `yyyy-MM-dd HH:mm:ss` createdAt, no offset
    L delete the malformed-transactionsJson case                      # no JSON cell is read any more
 L test 'customer-package write wiring preserves field maps, shared singletons, and route contracts'
    L destructure { customerPackageRoutes, customerPackageReadService } from viewModule
    L rename local `viewMethods` -> `readMethods`, stub .list/.getById the same way
    L every other assertion in this test unchanged, incl. PATCH 404 and the POST 201 envelopes
```

The existing `gvizBody(columns, values)` helper in that file takes literal column ids and stays for
the orders/appointments/invoices cases; `sheetGvizBody` is added alongside it and used only by the
customer-package case. Fixture column counts are never hardcoded — they come from
`Object.keys(rowSchema.shape)`.

### Fixture correction, in scope

```
tests/server/unit/contracts/customer-packages/customer-package-api.contract.dry-test.ts:166
 L createdAt: '2026-07-13T18:08:20+07:00'  ->  createdAt: '2026-07-13 18:08:20'
 L this is the ONLY line to change in that file; every assertion around it stays
```

The fixture passes today only because `packageTransactionSchema.createdAt` is a bare `z.string()`,
so it pins nothing and would keep passing either way. It is corrected because it is the one place in
the repo that documents this field's format by example, and leaving it ISO would teach the wrong
standard. `contracts/customer-packages/customer-package-api.schema.ts` itself is NOT changed — no
format regex is added to `createdAt`.

### Must keep passing untouched

```
tests/server/unit/sheets/sheet-binding.dry-test.ts
tests/server/unit/sheets/column-order.dry-test.ts
tests/server/unit/sheets/audit-declarations.dry-test.ts
tests/server/unit/sheets/repository-getters.dry-test.ts
tests/server/unit/sheets/module-laziness.dry-test.ts
tests/server/unit/sheets/customers-wiring.dry-test.ts
tests/server/unit/modules/customer-packages/package-transaction.service.dry-test.ts
tests/server/unit/modules/customer-packages/customer-package-purchase.service.dry-test.ts
tests/server/unit/contracts/customer-packages/customer-package-api.merge.dry-test.ts
tests/server/unit/shared/repositories/sheet.repository.audit.dry-test.ts
```

`sheet.repository.audit.dry-test.ts:238-240` asserts that `'2026-03-27T04:37:32+07:00'` is REJECTED
as an audit value. Nothing in this work may relax that.

### New: `tests/server/unit/modules/customer-packages/customer-package-assembly.dry-test.ts`

Structure copied from `tests/server/unit/modules/customer-packages/package-transaction.service.dry-test.ts`:
`import assert from 'node:assert/strict'`, relative `.js` imports, top-level `{ ... }` blocks, no
collector, final `console.log('customer package assembly dry test passed')`.

```
- resolveStatus: deleted_at wins over an expired expiryDate
- resolveStatus: today < startDate -> INACTIVE
- resolveStatus: today > expiryDate -> EXPIRED
- resolveStatus: today == startDate and today == expiryDate -> ACTIVE
- resolveStatus: null startDate + null expiryDate -> ACTIVE
- resolveStatus: negative remaining credit does not change ACTIVE
- buildLedger: running remainingCredit after each entry, PURCHASE 10 then USAGE -3 -> 10 then 7
- buildLedger: equal created_at tie-broken by id ascending
- buildLedger: GViz Date(2026,7,1,9,30,0) created_at -> '2026-08-01 09:30:00'
- buildLedger: plain-text '2026-08-01 09:30:00' created_at -> unchanged
- buildLedger: no createdAt value ever contains 'T' or '+07:00'
- buildLedger: totals 7 / 3 / 10 for that fixture
- buildLedger: overspend -> remainingCredit -2, usedCredit 12, totalCredit 10
- buildLedger: [] -> zeros and []
- assembleCustomerPackageRow: orphan customer -> '' / null / null
- assembleCustomerPackageRow: missing catalog row -> '' / ''
- assembleCustomerPackageRow: Packages.deleted_at set -> name still resolved
- assembleCustomerPackageRow: Date(2026,7,1) start_date -> '2026-08-01'
- assembleCustomerPackageRow: Object.keys equals customerPackagePortalRowSchema shape key order
- assembleCustomerPackageRow: '  padded  ' customerName / packageCode / notes round-trip verbatim
- assembleCustomerPackageRow: '  2026-08-01  ' start_date -> '2026-08-01'; ' 5 ' credit_change -> 5
- assembleCustomerPackageRow: whitespace-only deleted_at -> CANCELLED
- matchesKeyword: case-sensitive, apostrophe stripped, '' matches everything, needle and haystack both untrimmed
- compareRows: blanks first asc / last desc, numeric vs lexicographic
```

### New: `tests/server/unit/modules/customer-packages/customer-package-read.service.dry-test.ts`

Same structure; four fake repositories built from `{ read: async (dto) => rows }` closures that
record the DTO they receive.

```
- list: exactly 4 read calls for a 3-package fixture      # proves no N+1
- list: no ReadQueryDTO carries `pagination`
- list: customerId filter reaches CustomerPackages.customer_id and Customers.CustomerID
- list: packageCode filter reaches CustomerPackages.package_code and Packages.package_code
- list: status filter applied after assembly, CANCELLED rows returned when status is null
- list: keyword matches customerName from the Customers fixture
- list: sortBy remainingCredit desc, then page 2 perPage 1 slice
- list: pagination echo { page, perPage } only
- list: item objects have no `transactions` key
- list: empty CustomerPackages -> items []
- getById: 4 read calls, detail includes transactions
- getById: '' -> ApiError badRequest, no read issued
- getById: 0 rows -> ApiError notFound with "Resource 'x' not found"
- getById: 2 rows -> ApiError conflict
- getById: package with no ledger rows -> transactions [], credits 0
- getById: ledger where-value equals the fetched row's id cell, not the trimmed input id
- getById + list on the same fixture -> identical customerName / packageName / transactions / credits
```

### Verification commands

```bash
npm run typecheck:api
npx tsx tests/server/unit/modules/customer-packages/customer-package-assembly.dry-test.ts
npx tsx tests/server/unit/modules/customer-packages/customer-package-read.service.dry-test.ts
npx tsx tests/server/unit/sheets/service-wiring.dry-test.ts
npx tsx tests/server/unit/sheets/module-laziness.dry-test.ts
npx tsx tests/server/unit/sheets/repository-getters.dry-test.ts
npx tsx tests/server/unit/sheets/sheet-binding.dry-test.ts
npx tsx tests/server/unit/sheets/column-order.dry-test.ts
npx tsx tests/server/unit/modules/customer-packages/package-transaction.service.dry-test.ts
npx tsx tests/server/unit/modules/customer-packages/customer-package-purchase.service.dry-test.ts
npx tsx tests/server/unit/contracts/customer-packages/customer-package-api.contract.dry-test.ts
npx tsx tests/server/unit/contracts/customer-packages/customer-package-api.merge.dry-test.ts
npx tsx tests/server/unit/shared/repositories/sheet.repository.audit.dry-test.ts
```

## Out of Scope

- `contracts/customer-packages/customer-package-api.schema.ts`
- `POST /api/customer-packages`, `POST /api/package-transactions`
- `customer-package-purchase.service.ts`, `package-transaction.service.ts`, `package-transaction.module.ts`
- `customer-package.mapping.ts`
- `PATCH /api/customer-packages/:id` behaviour
- `server/api/route-registry.ts`
- `server/sheets/CustomerPackageView/` files
- `server/shared/utils/bangkok-timestamp.ts`
- `server/modules/price-list/price-list.module.ts`
- `server/shared/services/base-crud.service.ts`, `read-query.dto.ts`, `gviz-query.builder.ts`, `gviz-reader.ts`
- `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`
- `src/` and `tests/web/`
- the `CustomerPackageView` sheet formulas and any refresh trigger
- caching or memoization of source-sheet reads

## Status

FINAL
