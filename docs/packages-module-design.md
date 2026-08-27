# packages module — design

## Scope

Full CRUD over the existing `Packages` catalog sheet: new shared contract, new server module
(`GET/POST /api/packages`, `GET/PATCH /api/packages/:id`), new `src/features/packages/` feature,
and turning `packageCode` on `CustomerPackageCreatePage.vue` into a `<select>`.

Staged: **Stage 0** (contract, base branch, one commit) → **Stage A** (backend worktree) ‖
**Stage B** (frontend worktree). A and B share zero files.

---

## Verified facts (cited)

- Sheet exists, read-only today: `server/sheets/Packages/Packages.db-contract.ts:20-26` —
  `primaryKey: 'package_code'`, `sheetName: 'Packages'`,
  `spreadsheetId: 'LAUNDRY_PACKAGES_SPREADSHEET_ID'`, `writes: { append: false, update: false, delete: false }`,
  no `audit` key.
- Physical columns A–L = row-schema key order: `package_code, name, eligible_service, included_credit,
  price, notes, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by`
  (`Packages.db-contract.ts:5-18`; pinned `tests/server/unit/sheets/column-order.dry-test.ts:297-304`).
  Identical to registry `G:\My Drive\Magicwash\Database\GoogleSheets\Packages.json` (read-only, unmodified).
- **Writes do not use AppScript `doPost`.** `SheetRepository` writes through `SheetsApiClient`:
  APPEND = `values/{sheet}:append`, UPDATE = `values:batchUpdate`
  (`server/shared/repositories/sheets-api.client.ts:246-277,310-325`;
  `sheet.repository.ts:158-160,555-560`). Credentials: `GOOGLE_SERVICE_ACCOUNT_KEY` (`.env.example:19-20`).
  `APPSCRIPT_INVOICE_VIEW_SYNC_URL` is InvoicesView recompute only and is unrelated.
- Write capability gate: `sheet.repository.ts:738-744` reads `contract.writes[operation]`;
  constructor skips the Sheets client entirely when `append` and `update` are both false
  (`sheet.repository.ts:102-106`).
- `delete()` throws `'delete is not supported yet'` (`sheet.repository.ts:684-687`). Soft-delete is an UPDATE.
- Audit stamping: `contract.audit.onAppend` / `onUpdate` fill named columns with
  `formatBangkokTimestamp` (`yyyy-MM-dd HH:mm:ss`), and reject a caller-supplied value that does not
  match that pattern (`sheet.repository.ts:288-320`, `server/shared/utils/bangkok-timestamp.ts:1`).
  `*_by` columns are never auto-stamped — they come from the payload.
  `.claude/skills/add-sheet/SKILL.md:139-141` forbids stamping the updated-timestamp on append;
  `Appointments` predates that rule and is not a model. `IssueReports` is:
  `audit: { onAppend: ['CreatedAt'], onUpdate: ['UpdatedAt'] }` (`IssueReports.db-contract.ts:28-31`).
- Validation failures are **422**, not 400: `parseOrThrow` throws `ApiError.validation`
  (`server/shared/http/validate.ts:12-18`) and `STATUS_BY_ERROR_CODE.VALIDATION_ERROR === 422`
  (`server/shared/http/api-error.ts:9`).
- Sheets with `writes.append && writes.update`: `Appointments`, `Invoices`, `IssueReports`, `PriceList`.
  `IssueReports` is the closest structural precedent — full CRUD `BaseCrudService` with a
  `response.detail` slot, `audit` on both operations, and a repository `append` wrapper that fills
  server-owned columns (`server/modules/issue-reports/issue-report.module.ts:55-73`). `PriceList` is
  the closest *frontend* catalog precedent (store-cached list, local filter, `FormOverlay` form page)
  and its module additionally wraps `append` to mint keys (`price-list.module.ts:63-77`).
- `BaseCrudService` fills nothing: `prepareCreate`/`prepareUpdate` are identity
  (`server/shared/services/base-crud.service.ts:263-273`). Id/code minting and any field synthesis
  happen in the module's repository wrapper — precedent `server/modules/price-list/price-list.module.ts:63-77`.
- `createCrudRoutes` derives methods from contract slots: `POST` needs `request.create` + `response.create`;
  item `GET` needs `response.detail`; `PATCH` needs `request.update` + `response.update`
  (`server/shared/http/crud-routes.ts:17-37`).
- GViz `where` is equality-only, and `null`/`undefined`/`''` values are skipped
  (`server/shared/repositories/utils/gviz-query.builder.ts:55-71`). `deleted_at IS NULL` is not expressible.
- `ReadQueryDTO.fromQuery` turns **every** non-reserved list-query field into a `where` equality
  (`server/shared/dtos/read-query.dto.ts:95-110`); reserved = `keyword,page,perPage,sortBy,sortOrder`.
  A list-query field with no matching column makes `resolveColumn` throw.
- Duplicate primary key on append raises `DuplicatePrimaryKeyError extends WriteRejectedError`
  (`sheets-api.client.ts:88-95`); it is not an `ApiError`, so unmapped it becomes a 500
  (`server/shared/http/api-handler.ts:60-70`).
- Purchase already rejects a deactivated code:
  `server/modules/customer-packages/customer-package-purchase.service.ts` returns
  `{ kind: 'validation_error', issues: [{ path: 'packageCode', message: 'package is retired from sale' }] }`
  when `deleted_at` is a non-blank string.
- `src/shared/components/` (listed, verified): `AppHeader.vue`, `BaseSwipeCard.vue`, `CardLeadingIcon.vue`,
  `FormInput.vue`, `FormLabel.vue`, `FormOptionGrid.vue`, `FormSwitch.vue`, `FormTextarea.vue`,
  `GenericTabs.vue`, `ListContainer.vue`, `NavSidebar.vue`. No select/combobox.
- Router aggregator is `src/router/index.js` (flat records, no `children`). There is no `src/app/router`.
- `src/App.vue:17` KeepAlive exclude =
  `['CreateAppointmentPage','RescheduleAppointmentPage','InvoiceCreatePage','CustomerPackageCreatePage','PriceListFormPage','IssueReportFormPage']`.

---

## Decisions

- `package_code` is client-supplied on create (it is a meaningful code, e.g. `PKG-WF-10`); it is
  immutable and absent from the update request.
- Deactivate = UPDATE writing `deleted_at` + `deleted_by`. Reactivate = UPDATE writing both to blank.
  Wire format is a single boolean `active` in the update payload; the server derives the timestamp.
- `GET /api/packages` returns **every** catalog row, deactivated included, carrying `deletedAt`.
  No server-side hide filter, no `includeDeactivated` query param.
- A deactivated code **cannot be purchased** — already enforced, unchanged.
- A deactivated code is never removed, so `package_code`/`name` stay readable for historical rows.
- `eligibleService` is free text (`z.string()`), because the registry declares plain `string` with no enum.
- No `active` boolean in responses; `deletedAt` is the fact, normalized to `null` when blank.

---

## Stage 0 — contract (base branch, one commit, then FROZEN)

New file `contracts/packages/package-api.schema.ts`, verbatim:

```ts
import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

/** Sortable API fields. Each must map to a physical Packages column. */
export const packageSortFieldSchema = z.enum([
  'packageCode',
  'name',
  'eligibleService',
  'includedCredit',
  'price',
])

/**
 * Every non-reserved key here becomes a GViz equality `where` on the mapped
 * column, so no key may exist that the field map cannot resolve.
 */
export const packageListQuerySchema = z.object({
  keyword: z.string().default(''),
  packageCode: z.string().trim().min(1).nullable().optional().default(null),
  eligibleService: z.string().trim().min(1).nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(200).default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: packageSortFieldSchema.default('packageCode'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

/**
 * One response shape for list, detail, create and update. `deletedAt` non-null
 * means the catalog entry is retired from sale; the row is never removed.
 */
export const packageResponseSchema = z.object({
  packageCode: z.string(),
  name: z.string(),
  eligibleService: z.string(),
  includedCredit: z.number(),
  price: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
})

/** `packageCode` is the primary key: supplied here, immutable afterwards. */
export const packageCreateRequestSchema = z.object({
  packageCode: z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1),
  eligibleService: z.string().trim().min(1),
  includedCredit: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  notes: z.string().trim().min(1).nullable().default(null),
  createdBy: z.string().trim().min(1),
}).strict()

/**
 * `active: false` deactivates, `true` reactivates; the server owns the
 * `deletedAt` timestamp. `packageCode` is deliberately absent.
 */
export const packageUpdateRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  eligibleService: z.string().trim().min(1).optional(),
  includedCredit: z.number().int().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional(),
  updatedBy: z.string().trim().min(1),
}).strict()

export const packageApiContract = {
  query: { list: packageListQuerySchema },
  request: { create: packageCreateRequestSchema, update: packageUpdateRequestSchema },
  response: {
    list: packageResponseSchema,
    detail: packageResponseSchema,
    create: packageResponseSchema,
    update: packageResponseSchema,
  },
} satisfies ModuleApiContract
```

Exported schema names: `packageSortFieldSchema`, `packageListQuerySchema`, `packageResponseSchema`,
`packageCreateRequestSchema`, `packageUpdateRequestSchema`, `packageApiContract`.
No `export type` — schema files stay pure runtime contracts.

Type aliases consumers derive with `z.infer` (declared next to the consumer, not in the contract):

```
server/modules/packages/package.module.ts
 L type PackageListQuery      = z.infer<typeof packageApiContract.query.list>
 L type PackageCreate         = z.infer<typeof packageApiContract.request.create>
 L type PackageUpdate         = z.infer<typeof packageApiContract.request.update>
 L type PackageResponse       = z.infer<typeof packageApiContract.response.list>
 L type PackagesDbRow         = z.infer<typeof packagesRowSchema>
 L type PackageApiRow         = ApiRowFromFieldMap<PackagesDbRow, typeof packageFieldMap>

src/features/packages/services/package.service.ts
 L export type PackageDto           = z.infer<typeof packageResponseSchema>
 L export type PackageListQuery     = z.infer<typeof packageListQuerySchema>
 L export type PackageCreatePayload = z.infer<typeof packageCreateRequestSchema>
 L export type PackageUpdatePayload = z.infer<typeof packageUpdateRequestSchema>
```

Frozen after this commit. Neither Stage A nor Stage B edits `contracts/packages/package-api.schema.ts`;
if either finds it inadequate it stops and reports.

---

## Stage A — backend worktree

### Files

| File | Action |
|---|---|
| `server/sheets/Packages/Packages.db-contract.ts` | edit — enable writes, add audit |
| `server/modules/packages/package.module.ts` | new |
| `server/api/route-registry.ts` | edit — add `packages` key |
| `tests/server/unit/sheets/audit-declarations.dry-test.ts` | edit |
| `tests/server/unit/sheets/module-laziness.dry-test.ts` | edit |
| `tests/server/unit/contracts/packages/package-api.contract.dry-test.ts` | new |
| `tests/server/unit/modules/packages/package.module.dry-test.ts` | new |

Not edited: `server/sheets/Packages/Packages.repository.ts` (already correct),
`server/modules/customer-packages/**`, `.env.example` (`LAUNDRY_PACKAGES_SPREADSHEET_ID` already documented
at `.env.example:13-14`), `tests/server/unit/sheets/sheet-binding.dry-test.ts`,
`tests/server/unit/sheets/column-order.dry-test.ts`,
`tests/server/unit/sheets/repository-getters.dry-test.ts`,
`tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` (auto-discovers; `LAUNDRY_PACKAGES_SPREADSHEET_ID`
is not `PORTAL_SPREADSHEET_ID`, so it passes), `tests/server/unit/sheets/service-wiring.dry-test.ts`.

### A1. `Packages.db-contract.ts` — only these two keys change

```
packagesDbContract
 L audit: { onAppend: ['created_at'], onUpdate: ['updated_at'] }   # new key, placed before `writes`; updated_at is NEVER stamped on append
 L writes: { append: true, update: true, delete: false }           # was all false
```

Row schema, `primaryKey`, `sheetName`, `spreadsheetId`, key order: unchanged.

### A2. `server/modules/packages/package.module.ts`

```
packageFieldMap                                   # const, DB column -> API field
 L package_code: 'packageCode', name: 'name', eligible_service: 'eligibleService',
   included_credit: 'includedCredit', price: 'price', notes: 'notes',
   created_at: 'createdAt', created_by: 'createdBy', updated_at: 'updatedAt',
   updated_by: 'updatedBy', deleted_at: 'deletedAt', deleted_by: 'deletedBy'
 L as const satisfies Record<keyof PackagesDbRow & string, string>

packageSearchFields = ['packageCode', 'name', 'eligibleService'] as const

packageRepository: SheetRepositoryContract<PackagesDbRow>     # wrapper over getPackagesRepository()
 L read: (query) => getPackagesRepository().read(query)
 L append: (row) => appendPackage(row)
 L batchAppend: (rows) => getPackagesRepository().batchAppend(rows)
 L update: (keyValue, patch) => updatePackage(keyValue, patch)
 L delete: (keyValue, deletedBy) => getPackagesRepository().delete(keyValue, deletedBy)

private appendPackage(row: Partial<PackagesDbRow>) -> Promise<PackagesDbRow>
 L try
    L return await getPackagesRepository().append({ notes: null, ...row })   # notes default so a missing key is a blank cell
   catch (error)
    L if error instanceof DuplicatePrimaryKeyError
       L throw ApiError.conflict(`Package code '${row.package_code}' already exists`)
    L throw error

private updatePackage(keyValue: string, patch: Partial<PackagesDbRow>) -> Promise<PackagesDbRow>
 L const raw = { ...patch } as Record<string, unknown>
 L const active = raw.active                       # `active` is not a column; BaseCrudService's Mapper passes unknown keys through unrenamed
 L delete raw.active
 L if active === false
    L raw.deleted_at = formatBangkokTimestamp(new Date())
    L raw.deleted_by = raw.updated_by ?? ''
   else if active === true
    L raw.deleted_at = null
    L raw.deleted_by = null
 L return getPackagesRepository().update(keyValue, raw as Partial<PackagesDbRow>)

private createPackageTransformer() -> RepositoryTransformer
 L response(response, _context)
    L if !isRecord(response) -> return response
    L const row = { ...response }
    L for column of ['notes','updated_at','updated_by','deleted_at','deleted_by']
       L if row[column] === '' -> row[column] = null       # blank cell -> null, all operations
    L return row

packageService: BaseCrudService<...>
 L new BaseCrudService({
     repository: packageRepository,
     api: packageApiContract,
     searchFields: packageSearchFields,
     fieldMap: packageFieldMap,
     transformer: createPackageTransformer(),
   })

packageRoutes = createCrudRoutes(packageService, packageApiContract)
```

Imports: `formatBangkokTimestamp` from `../../shared/utils/bangkok-timestamp.js`;
`DuplicatePrimaryKeyError` from `../../shared/repositories/sheets-api.client.js`;
`ApiError` from `../../shared/http/api-error.js`; `getPackagesRepository` from
`../../sheets/Packages/Packages.repository.js`; `packagesRowSchema` from
`../../sheets/Packages/Packages.db-contract.js`. All relative imports end in `.js`.
Module-level code must not call `getPackagesRepository()` — the getter stays lazy.

Structure mirrors `server/modules/issue-reports/issue-report.module.ts`. Its repository `update` is a
plain pass-through and **must not** be copied verbatim here: `active` is not a physical column, so
letting it reach `getPackagesRepository().update` throws
`Column 'active' is not present in the sheet header map`. `updatePackage` above must strip it.

### A3. `server/api/route-registry.ts`

```
routeRegistry
 L packages: (): ReturnType<RouteLoader> =>
     import('../modules/packages/package.module.js').then((module) => module.packageRoutes)
```

Resulting endpoints:

| Method | Path | Handler |
|---|---|---|
| GET | `/api/packages` | `packageService.list` → `okPaged(items, { page, perPage })` |
| POST | `/api/packages` | `packageService.create` → 201, `{ success, data }` |
| GET | `/api/packages/:id` | `packageService.getById` → `{ success, data }` |
| PATCH | `/api/packages/:id` | `packageService.update` → `{ success, data }` |

`:id` is the `package_code`.

### A4. Test edits

```
tests/server/unit/sheets/audit-declarations.dry-test.ts
 L add to declaredAudits:
   { name: 'Packages', contract: packagesDbContract,
     expected: { onAppend: ['created_at'], onUpdate: ['updated_at'] } }
 L delete the line: assert.equal('audit' in packagesDbContract, false, 'Packages catalog must omit audit declarations')

tests/server/unit/sheets/module-laziness.dry-test.ts
 L append to modulePaths: '../../../../server/modules/packages/package.module.js'
 L change console.log('8 module laziness checks passed') -> '9 module laziness checks passed'
```

### A5. New tests

```
tests/server/unit/contracts/packages/package-api.contract.dry-test.ts
 L assert.deepEqual(Object.keys(packageResponseSchema.shape), [<the 12 field names in contract order>])
 L assert list-query defaults: packageListQuerySchema.parse({}) -> { keyword:'', packageCode:null, eligibleService:null, page:1, perPage:20, sortBy:'packageCode', sortOrder:'asc' }
 L assert packageCreateRequestSchema rejects an unknown key (strict)
 L assert packageCreateRequestSchema rejects packageCode '' and includedCredit -1
 L assert packageUpdateRequestSchema rejects { packageCode: 'X', updatedBy: 'a' }   # PK immutable
 L assert packageUpdateRequestSchema rejects {} (updatedBy required)
 L assert packageUpdateRequestSchema.parse({ active:false, updatedBy:'a' }) succeeds
 L console.log('package api contract dry test passed')

tests/server/unit/modules/packages/package.module.dry-test.ts
 L assert.deepEqual(packageFieldMap, <the 12-pair literal, pinned>)
 L assert.deepEqual(packageFieldMap, packagesFieldMap)     # drift guard vs server/modules/customer-packages/customer-package.mapping.js
 L assert packageRoutes.collection !== undefined and packageRoutes.item !== undefined
 L stub packageService.list/getById/create/update, then assert:
    L collection GET -> 200, body.success === true, body.data is the items array
    L collection POST -> 201
    L item GET -> 200
    L item PATCH -> 200
    L item DELETE -> 405 with Allow header
 L restore every stubbed method in a finally block
 L console.log('package module dry test passed')
```

Both new tests use `node:assert/strict` and relative `.js` imports.

### A6. Verification (Stage A)

```bash
npm run typecheck:api
npx tsx tests/server/unit/contracts/packages/package-api.contract.dry-test.ts
npx tsx tests/server/unit/modules/packages/package.module.dry-test.ts
npx tsx tests/server/unit/sheets/audit-declarations.dry-test.ts
npx tsx tests/server/unit/sheets/module-laziness.dry-test.ts
npx tsx tests/server/unit/sheets/sheet-binding.dry-test.ts
npx tsx tests/server/unit/sheets/column-order.dry-test.ts
npx tsx tests/server/unit/sheets/writing-workbook-binding.dry-test.ts
npx tsx tests/server/unit/sheets/repository-getters.dry-test.ts
npx tsx tests/server/unit/sheets/service-wiring.dry-test.ts
```

The last five must pass **untouched**. `service-wiring.dry-test.ts` pins `packagesFieldMap` from
`customer-package.mapping.ts` — that file is not edited, so its assertion stands.

---

## Stage B — frontend worktree

### Files

| File | Action |
|---|---|
| `src/features/packages/services/package.service.ts` | new |
| `src/features/packages/stores/package.store.ts` | new |
| `src/features/packages/components/PackageCard.vue` | new |
| `src/features/packages/pages/PackageListPage.vue` | new |
| `src/features/packages/pages/PackageFormPage.vue` | new |
| `src/features/packages/routes.ts` | new |
| `src/router/index.js` | edit — import + spread `packageRoutes` |
| `src/App.vue` | edit — add `'PackageFormPage'` to the KeepAlive `exclude` array |
| `src/features/customer-packages/pages/CustomerPackageCreatePage.vue` | edit — `packageCode` becomes `<select>` |
| `tests/web/unit/features/packages/stores/package.store.dry-test.ts` | new |
| `tests/web/unit/features/packages/pages/package-pages.dry-test.ts` | new |

Nothing under `src/shared/` is created or modified.

Notation for B2–B9: every `ref` / `computed` / `storeToRefs` binding is read and written with
`.value` inside `<script setup>` and without it inside `<template>`. The blocks below use `.value`
throughout; copy them as written.

### B1. `package.service.ts`

```
listPackages(query: Partial<PackageListQuery> = {}) -> Promise<PackageDto[]>
 L apiGetList<PackageDto>('/api/packages', { query, querySchema: packageListQuerySchema })
 L return items

createPackage(payload: PackageCreatePayload) -> Promise<PackageDto>
 L apiPost<PackageDto>('/api/packages', { data: payload, requestSchema: packageCreateRequestSchema })

updatePackage(packageCode: string, payload: PackageUpdatePayload) -> Promise<PackageDto>
 L apiPatch<PackageDto>(`/api/packages/${encodeURIComponent(packageCode)}`, { data: payload, requestSchema: packageUpdateRequestSchema })
```

Imports `apiGetList`, `apiPost`, `apiPatch` from `@/shared/api/api-client`; schemas from
`@contracts/packages/package-api.schema`. No mapping, no reshaping.

### B2. `package.store.ts` — `defineStore('packages', ...)`

```
const items = ref<PackageDto[]>([]); const loading = ref(false); const error = ref<string|null>(null); const loaded = ref(false)
let loadPromise: Promise<void> | null = null

function errorMessage(e: unknown, fallback: string) -> string
 L return e instanceof Error ? e.message : fallback

async function load() -> Promise<void>
 L if (loaded.value) return
 L if (loadPromise) return loadPromise
 L loadPromise = (async () => {
    L loading.value = true; error.value = null
    L try { items.value = await listPackages({ perPage: 200 }); loaded.value = true }
      catch (e) { error.value = errorMessage(e, 'Unable to load packages') }
      finally { loading.value = false; loadPromise = null } })()
 L return loadPromise

async function create(payload: PackageCreatePayload) -> Promise<PackageDto>
 L loading.value = true; error.value = null
 L try { const created = await createPackage(payload); items.value = [...items.value, created]; return created }
   catch (e) { error.value = errorMessage(e, 'Unable to create package'); throw e }
   finally { loading.value = false }

async function update(packageCode: string, payload: PackageUpdatePayload) -> Promise<PackageDto>
 L loading.value = true; error.value = null
 L try { const updated = await updatePackage(packageCode, payload); items.value = items.value.map(i => i.packageCode === packageCode ? updated : i); return updated }
   catch (e) { error.value = errorMessage(e, 'Unable to update package'); throw e }
   finally { loading.value = false }

const activePackages = computed(() => items.value.filter(item => item.deletedAt === null))

returns { items, loading, error, loaded, activePackages, load, create, update }
```

### B3. `routes.ts`

```
packageRoutes: RouteRecordRaw[]
 L { path: '/packages', name: 'package-list', component: () => import('./pages/PackageListPage.vue') }
 L { path: '/packages/new', name: 'package-create', component: () => import('./pages/PackageFormPage.vue'), meta: { parent: 'package-list' } }
 L { path: '/packages/:packageCode/edit', name: 'package-edit', component: () => import('./pages/PackageFormPage.vue'), meta: { parent: 'package-list' }, props: true }
```

Flat records only. No `children`.

### B4. `src/router/index.js`

```
 L import { packageRoutes } from '@/features/packages/routes'
 L spread ...packageRoutes into the routes array, after ...priceListRoutes
```

### B5. `src/App.vue`

```
 L KeepAlive :exclude -> ['CreateAppointmentPage','RescheduleAppointmentPage','InvoiceCreatePage','CustomerPackageCreatePage','PriceListFormPage','IssueReportFormPage','PackageFormPage']
```

Nothing else in that file changes.

### B6. `PackageListPage.vue`

```
defineOptions({ name: 'PackageListPage' })
setup
 L const router = useRouter()
 L const packageStore = usePackageStore(); const { items, loading, error, loaded } = storeToRefs(packageStore)
 L const listLoading = computed(() => loading.value && !loaded.value)
 L const listError    = computed(() => loaded.value ? null : error.value)
 L const search = ref(''); const keywordInput = ref('')   # debounced 250ms into `search`, cleared in onBeforeUnmount
 L const statusTab = ref<'active'|'retired'|'all'>('active')      # local ref, NOT a route query
 L const statusTabs = computed(() => [
    L { key:'active',  label:'ใช้งาน',  count: items.value.filter(p => p.deletedAt === null).length },
    L { key:'retired', label:'เลิกขาย', count: items.value.filter(p => p.deletedAt !== null).length },
    L { key:'all',     label:'ทั้งหมด', count: items.value.length } ])
 L const filteredPackages = computed(() => {
    L const query = search.value.trim().toLocaleLowerCase('th-TH')
    L return items.value
       L .filter(p => statusTab.value === 'active' ? p.deletedAt === null : statusTab.value === 'retired' ? p.deletedAt !== null : true)
       L .filter(p => !query || [p.packageCode, p.name, p.eligibleService].map(v => String(v ?? '').toLocaleLowerCase('th-TH')).join(' ').includes(query))
   })
 L openCreate() -> router.push({ name: 'package-create' })
 L openEdit(packageCode) -> router.push({ name: 'package-edit', params: { packageCode } })
 L onMounted(() => void packageStore.load())
template
 L AppLayout
    L GenericTabs :tabs="statusTabs" :active-key="statusTab" @select="statusTab = $event"
    L inline search input                                # own markup; AppHeader search does not cover /packages
    L ListContainer title="แพ็กเกจ" icon="inventory_2" count-label="แพ็กเกจ" :loading="listLoading" :error="listError" :empty="filteredPackages.length === 0" empty-text="ไม่พบแพ็กเกจ" :skeleton-rows="4"
       L #actions -> button @click="openCreate"
       L PackageCard v-for="item in filteredPackages" :key="item.packageCode" :package-item="item" @edit="openEdit"
```

`useHeaderSearch` is not used here.

### B7. `PackageCard.vue`

```
props: { packageItem: PackageDto }
emits: { edit: [packageCode: string] }
 L BaseSwipeCard @tap="emit('edit', packageItem.packageCode)"
    L packageCode, name, eligibleService, includedCredit, price
    L badge "เลิกขาย" rendered when packageItem.deletedAt !== null
```

### B8. `PackageFormPage.vue`

```
defineOptions({ name: 'PackageFormPage' })
props: { packageCode?: string }
setup
 L const router = useRouter()
 L const packageStore = usePackageStore(); const { items, error: storeError } = storeToRefs(packageStore)
 L const isEdit = computed(() => Boolean(props.packageCode))
 L const form = reactive({ packageCode:'', name:'', eligibleService:'', includedCredit:'', price:'', notes:'' })
 L const isActive = ref(true)
 L const actorInput = ref('')                            # createdBy / updatedBy, required
 L const formError = ref<string|null>(null); const initializing = ref(true); const submitting = ref(false)
 L const valid = computed(() =>
    L (isEdit.value || form.packageCode.trim() !== '')
    L && form.name.trim() !== '' && form.eligibleService.trim() !== ''
    L && Number.isInteger(Number(form.includedCredit)) && Number(form.includedCredit) >= 0 && form.includedCredit !== ''
    L && Number.isFinite(Number(form.price)) && Number(form.price) >= 0 && form.price !== ''
    L && actorInput.value.trim() !== '')
 L onMounted(async () => {
    L await packageStore.load()
    L if (props.packageCode) {
       L const source = items.value.find(p => p.packageCode === props.packageCode)
       L if (source) fillForm(source); else formError.value = storeError.value ?? 'ไม่พบแพ็กเกจนี้' }
    L initializing.value = false })
 L function fillForm(source: PackageDto)
    L form.packageCode = source.packageCode; form.name = source.name; form.eligibleService = source.eligibleService
    L form.includedCredit = String(source.includedCredit); form.price = String(source.price)
    L form.notes = source.notes ?? ''
    L isActive.value = source.deletedAt === null
 L function businessFields()
    L return { name: form.name.trim(), eligibleService: form.eligibleService.trim(),
       L includedCredit: Number(form.includedCredit), price: Number(form.price),
       L notes: form.notes.trim() === '' ? null : form.notes.trim() }
 L async function submitForm()
    L formError.value = null; submitting.value = true
    L try
       L if (isEdit.value) await packageStore.update(props.packageCode!, { ...businessFields(), active: isActive.value, updatedBy: actorInput.value.trim() })
         else             await packageStore.create({ packageCode: form.packageCode.trim(), ...businessFields(), createdBy: actorInput.value.trim() })
       L await router.push('/packages')
      catch (reason) -> formError.value = reason instanceof Error ? reason.message : 'Unable to save package'
      finally -> submitting.value = false
template
 L FormOverlay :open="true" :title="isEdit ? 'แก้ไขแพ็กเกจ' : 'เพิ่มแพ็กเกจ'" submit-label="บันทึกแพ็กเกจ" :is-submitting="submitting" :is-submit-disabled="initializing || !valid" :close-on-backdrop="false" @close="router.push('/packages')" @submit="submitForm"
    L FormInput id="package-code" v-model="form.packageCode" label="รหัสแพ็กเกจ *"      # rendered only when !isEdit
    L FormInput id="package-name" ... ; FormInput id="package-eligible-service" ...
    L FormInput id="package-included-credit" ... ; FormInput id="package-price" ...
    L FormTextarea id="package-notes" ...
    L FormSwitch v-model="isActive" label="เปิดขายแพ็กเกจนี้" description="ปิดสวิตช์เพื่อเลิกขาย — ไม่มีการลบข้อมูล"   # rendered only when isEdit
    L FormInput id="package-actor" v-model="actorInput" label="ผู้บันทึก *"
    L <p v-if="formError">
```

`onMounted` only — never `onActivated`/`onDeactivated`.

### B9. `CustomerPackageCreatePage.vue` — the only edit

```
script changes
 L import { storeToRefs } from 'pinia'
 L import { usePackageStore } from '@/features/packages/stores/package.store'
 L const packageStore = usePackageStore()
 L const { activePackages, loading: packagesLoading, error: packagesError } = storeToRefs(packageStore)
 L extend the existing onMounted body with: void packageStore.load()
template change
 L replace <FormInput id="customer-package-code" v-model="packageCode" label="Package code" />
   with a native <select id="customer-package-code" v-model="packageCode"> matching the existing serviceDay/timeSlot select markup
    L <option value="" disabled>เลือกแพ็กเกจ</option>
    L <option v-for="p in activePackages" :key="p.packageCode" :value="p.packageCode">{{ p.packageCode }} — {{ p.name }} ({{ p.includedCredit }})</option>
 L show packagesError text beneath the select when packagesError is non-null
```

Everything else on this page is untouched: `createCustomerPackage` is still called directly, the
result union rendering, `serviceDay`/`timeSlot` selects, `defineOptions({ name: 'CustomerPackageCreatePage' })`,
the `?customerId` / `?by` prefill. A separate task lands a customer typeahead in this same file —
expect a merge conflict in this template and resolve by keeping both changes.

### B10. New frontend tests

```
tests/web/unit/features/packages/stores/package.store.dry-test.ts
 L createPinia/setActivePinia, stub the service module functions
 L assert load() is idempotent (second call issues no second request) and populates items
 L assert activePackages excludes rows with a non-null deletedAt
 L assert create() appends and update() replaces by packageCode
 L assert a thrown service error sets `error` and re-throws for create/update, and is swallowed into `error` for load

tests/web/unit/features/packages/pages/package-pages.dry-test.ts     # source-text assertions, following customer-package-pages.dry-test.ts
 L readFileSync src/App.vue -> assert.match(/'PackageFormPage'/)
 L readFileSync PackageFormPage.vue -> assert.match(/defineOptions\(\{ name: 'PackageFormPage' \}\)/); assert.match(/onMounted/); assert.doesNotMatch(/onActivated|onDeactivated/)
 L readFileSync CustomerPackageCreatePage.vue -> assert.doesNotMatch(/FormInput[^>]*customer-package-code/); assert.match(/select[^>]*customer-package-code/); assert.match(/usePackageStore/)
 L readFileSync src/router/index.js -> assert.match(/packageRoutes/)
```

### B11. Verification (Stage B)

```bash
npm run build
npx tsx --tsconfig jsconfig.json tests/web/unit/features/packages/stores/package.store.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/packages/pages/package-pages.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/customer-packages/pages/customer-package-pages.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/customer-packages/services/customer-package.service.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/customer-packages/stores/customer-package.store.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/customer-packages/routes.dry-test.ts
```

`npm run build` is Vite/esbuild and performs **no type-check**: a wrong prop name, a wrong DTO field,
or a stale import ships green. Stage B therefore needs line-by-line human review of every prop name
against `src/shared/components/*.vue` and every DTO field against `packageResponseSchema`; the build
result proves only that the bundle parses.

The four `customer-packages` dry-tests must pass untouched except for the one page assertion that
Stage B intentionally changes in B10.

---

## Stage boundaries

Stage A and Stage B share **zero** files.

| File | Owner | The other side must not touch it |
|---|---|---|
| `src/features/customer-packages/pages/CustomerPackageCreatePage.vue` | Stage B | Stage A |
| `src/App.vue`, `src/router/index.js` | Stage B | Stage A |
| `server/api/route-registry.ts` | Stage A | Stage B |
| `server/sheets/Packages/Packages.db-contract.ts` | Stage A | Stage B |
| `tests/server/unit/**` | Stage A | Stage B |
| `tests/web/unit/**` | Stage B | Stage A |
| `contracts/packages/package-api.schema.ts` | Stage 0 | both |

---

## Edge cases

`POST /api/packages`
- `packageCode` already in the sheet -> `ApiError.conflict` -> 409
- `packageCode` fails `/^[A-Za-z0-9_-]+$/` -> 422 VALIDATION_ERROR before any sheet read
- unknown key in body -> 422 (`.strict()`)
- `notes` omitted -> `null` -> blank cell
- `created_at` -> stamped by `audit.onAppend`, never accepted from the client
- `updated_at` / `updated_by` / `deleted_at` / `deleted_by` -> written blank; `updatedAt` is `null`
  in the response until the first PATCH
- Sheets API rejects the write -> `WriteRejectedError` -> 500 INTERNAL_ERROR
- write commits but read-back fails -> `WriteCommittedUnreadableError` -> 500; do not retry

`PATCH /api/packages/:id`
- `:id` not in the sheet -> 404 (`requireSingleRow`)
- `:id` resolves to two rows -> 409
- body contains `packageCode` -> 422 (`.strict()`); the key is immutable
- body omits `updatedBy` -> 422
- `active: false` -> `deleted_at` = Bangkok now, `deleted_by` = `updatedBy`
- `active: true` -> `deleted_at` and `deleted_by` written blank
- `active` omitted -> neither column is sent
- `updated_at` -> always stamped by `audit.onUpdate`
- body is `{ updatedBy }` only -> valid; stamps `updated_at` and `updated_by`, nothing else

`GET /api/packages`
- deactivated rows are **included**; `deletedAt` is non-null
- `keyword` -> GViz `contains` over `package_code`, `name`, `eligible_service`
- `packageCode` / `eligibleService` -> GViz equality on the mapped column
- `perPage` > 200 -> 422
- response `meta.pagination` carries `page` and `perPage` only, never `total`
- blank cell in `notes`/`updatedAt`/`updatedBy`/`deletedAt`/`deletedBy` -> `null` via the transformer
- dirty non-numeric `included_credit` / `price` cell -> passed through unvalidated; the frontend renders it as-is

`GET /api/packages/:id`
- not found -> 404; duplicate `package_code` -> 409

purchase (`customer-package-purchase.service.ts`, unchanged)
- `packageCode` with non-blank `deleted_at` -> `validation_error` `'package is retired from sale'`
- `packageCode` absent from the catalog -> `validation_error` `'unknown package code'`

frontend
- store `load()` called twice concurrently -> one request (`loadPromise` guard)
- list request fails -> `ListContainer :error`; `items` stays `[]`
- catalog empty -> the `packageCode` select shows only the disabled placeholder; submit stays disabled
- edit page deep-linked / refreshed -> `load()` runs first, then the row is found; missing row -> `formError`
- `PackageFormPage` renamed -> it silently drops off the KeepAlive `exclude` list; the name in `defineOptions` and the string in `src/App.vue` must be changed together

---

## SHARED GAPS

- **No shared select/combobox component.** `src/shared/components/` has `FormInput`, `FormTextarea`,
  `FormSwitch`, `FormOptionGrid`, `FormLabel` — nothing for a single-choice dropdown over a dynamic
  list. `CustomerPackageCreatePage.vue` hand-rolls native `<select>` markup for `packageCode`,
  matching the existing `serviceDay`/`timeSlot` selects on that page. `PackageFormPage.vue` needs no
  select: `eligibleService` is free text and uses `FormInput`. A `FormSelect.vue` would suit at least
  four call sites; creating it belongs to a dedicated shared refactor pass.
- **`NavSidebar.vue` has hardcoded nav destinations** (`/`, `/customers`, `/customer-packages`,
  `/invoices`, `/price-list`, `/issue-reports`). It is import-only, so `/packages` gets **no sidebar
  entry** and is reachable only by URL or from a future link inside a feature page.
- **`AppHeader.vue` has a hardcoded `SEARCHABLE_ROUTES = ['/customers','/invoices','/price-list']`.**
  It is import-only, so `useHeaderSearch` cannot open on `/packages`; `PackageListPage.vue` renders
  its own inline search input instead.

---

## USER ACTION ITEMS

1. **Grant the service account edit rights.** Writes to `Packages` are being enabled for the first
   time. The identity in `GOOGLE_SERVICE_ACCOUNT_KEY` must have editor access to spreadsheet
   `1JEsergLhrLY02srmzPi5W6NJ6G7Why4UKN5RwRynNas` (`LAUNDRY_PACKAGES_SPREADSHEET_ID`). Reads use
   unauthenticated GViz, so read-only access today proves nothing about write access.
2. **Confirm the physical `Packages` header row.** `buildSheetHeaderMap` rejects a write when the
   sheet header does not cover every contract column. Header cells must read exactly
   `package_code, name, eligible_service, included_credit, price, notes, created_at, created_by,
   updated_at, updated_by, deleted_at, deleted_by`.
3. **`eligible_service` has no controlled vocabulary.** The registry declares plain `string`. Observed
   values are inconsistent (`WASH_FOLD`, `SHOE_CLEANING`, `PRESSING`, `wash_iron`). This design ships
   free text. To make it an enum, add it to `G:\My Drive\Magicwash\Database\GoogleSheets\Packages.json`
   first and clean the existing rows; the contract then follows the registry.
4. **No Apps Script change is required.** See the contradictions below.

---

## Contradictions against the brief

1. **"writes go through an AppScript `doPost` endpoint whose URL comes from an env var … supports only
   APPEND and UPDATE."** No longer true. The SheetLib/`doPost` write path was removed
   (`api/CLAUDE.md:3-6,142-143,277`; `docs/phase-2-handoff.md:509-513`). Server row writes go through
   `SheetsApiClient` against the Google Sheets REST API. There is **no AppScript write URL for the
   `LAUNDRY_PACKAGES_SPREADSHEET_ID` workbook and none is needed**; the only surviving Apps Script
   POST is `APPSCRIPT_INVOICE_VIEW_SYNC_URL`, which recomputes InvoicesView. UPDATE is fully supported
   via `values:batchUpdate`, so `PATCH` needs no Apps Script work.
2. **"the established rule … a package name still resolves even when `Packages.deleted_at` is set …
   whether a deactivated code may still be purchased is a decision the design must make."** Already
   decided in shipped code: `customer-package-purchase.service.ts` rejects a purchase against a
   non-blank `deleted_at` with `'package is retired from sale'`. This design changes nothing there.
   Name resolution is unaffected because a deactivated row is never removed.
3. **"which existing tests will break — at minimum the sheet-binding and service-wiring dry-tests."**
   Neither. `sheet-binding`, `column-order`, `repository-getters` and `writing-workbook-binding`
   already cover `Packages` and pass untouched. `service-wiring.dry-test.ts` is a characterization
   suite for orders/appointments/invoices/customer-packages only — `price-list` and `customers` have
   no entry, and neither does `packages`. The tests that must change are
   `audit-declarations.dry-test.ts` and `module-laziness.dry-test.ts`.
4. **"follow the existing `customer-packages` and `customers` modules."** Neither is a write precedent:
   `Customers` declares `writes: { append: false, update: false, delete: false }`
   (`Customers.db-contract.ts:43`) and `CustomerPackages` is append-only
   (`CustomerPackages.db-contract.ts:32`). Append+update exists on `Appointments`, `Invoices`,
   `IssueReports` and `PriceList`. This design follows **`issue-reports`** for module structure
   (full-CRUD `BaseCrudService`, `response.detail` slot, audit on both operations, repository
   `append` wrapper filling server-owned columns) and **`price-list`** for the frontend catalog
   list/form shape.
5. **"`src/app/`."** There is no `src/app/router`; `src/app/` contains only `dev/FormOverlayPreviewPage.vue`.
   Feature routes are aggregated in `src/router/index.js`.
6. **`GET /api/price-list` pagination.** `okPaged` emits `{ page, perPage }` only, but
   `src/shared/api/api-client.ts` types `meta.pagination` as the full `apiPaginationMetaSchema`
   (`total`, `totalPages`). Pre-existing mismatch, not fixed here; the packages store reads `items` only.

---

## Out of scope

- `CustomerPackageView` and the customer-package read path
- `docs/customer-package-view-service-assembly.md`
- The customer typeahead on `CustomerPackageCreatePage.vue`
- `server/modules/customer-packages/**`, including `customer-package.mapping.ts`
- Any new or modified component under `src/shared/`
- `NavSidebar` entry and `AppHeader` search coverage for `/packages`
- Row deletion (`SheetRepository.delete` stays unimplemented; `writes.delete` stays `false`)
- Any edit to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`

---

## Status

FINAL
