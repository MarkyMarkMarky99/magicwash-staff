// Compile-time coverage for the contract-driven GSheetRepository.
// Type-only: no runtime assertions. Enforced by `npm run typecheck:api`
// (api/tsconfig.json includes ../server/**/*.ts). `@ts-expect-error` lines are
// double-enforced — they fail if the offending line ever compiles AND fail as an
// unused directive if it stops erroring.

import type { z } from 'zod'
import { z as zod } from 'zod'
import { GSheetRepository } from '../../../../../server/shared/repositories/gsheet.repository.js'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import type { ModuleContract, ModuleDbContract } from '../../../../../server/shared/contracts/module-db-contract.js'
import type { ModuleApiContract } from '../../../../../contracts/shared/module-api-contract.js'
import { customerContract } from '../../../../../server/modules/customers/customer.contract.js'

// ── type-level helpers ──
type Expect<T extends true> = T
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

// ── construction needs no explicit generics and preserves the exact contract type ──
const repo = new GSheetRepository({
  contract: customerContract,
  sheetName: 'Customers',
  spreadsheetId: 'x',
  scriptUrl: 'y',
})

type Repo = typeof repo
type _ConstructorPreservesContract = Expect<
  Equal<Repo, GSheetRepository<typeof customerContract>>
>

// ── the literal fieldMap survives inference — load-bearing, because ApiRowFromFieldMap
//    needs the exact map (not a widened Record) to rename `Line` -> `lineId`. primaryKey
//    is a runtime value typed `string` by the contract (no `as const`), so its literalness
//    is intentionally NOT asserted here; the dry test covers its 'customerId' value via
//    id-folding. ──
type _FieldMapLineIsLiteral = Expect<
  Equal<(typeof customerContract.db.fieldMap)['Line'], 'lineId'>
>
// customerContract must stay an exact ModuleContract, not the widened structural type
type _ContractAssignable = Expect<
  Equal<typeof customerContract extends ModuleContract ? true : false, true>
>

// ── create / update inputs come from contract.api.request ──
type CreateInput = Parameters<Repo['create']>[0]
type UpdateInput = Parameters<Repo['update']>[1]
type _CreateInput = Expect<
  Equal<CreateInput, z.infer<typeof customerContract.api.request.create>>
>
type _UpdateInput = Expect<
  Equal<UpdateInput, z.infer<typeof customerContract.api.request.update>>
>

// each required API field is individually required — omit exactly one, keep the rest valid
// @ts-expect-error — customerName is required by the create contract
const _missingCustomerName: CreateInput = { phone: '0', updatedBy: 't' }
// @ts-expect-error — phone is required by the create contract
const _missingPhone: CreateInput = { customerName: 'Alice', updatedBy: 't' }
// @ts-expect-error — updatedBy is required by the create contract
const _missingUpdatedBy: CreateInput = { customerName: 'Alice', phone: '0' }
// a DB column name is rejected as an excess key even with every required API field present
// (single line so the excess-property error stays on the directive's next line)
// @ts-expect-error — `CustomerName` is a DB column, not an API field
const _dbColumnRejected: CreateInput = { customerName: 'Alice', phone: '0', updatedBy: 't', CustomerName: 'Alice' }

// ── outputs expose mapped API fields (lineId), never DB fields (Line) ──
type CreateOutput = Awaited<ReturnType<Repo['create']>>
type _OutputHasLineId = Expect<Equal<CreateOutput['lineId'], string | null>>
// @ts-expect-error — the DB column name `Line` must not survive into the API row
type _OutputHasNoLine = CreateOutput['Line']

// ── read-where is EXACTLY the non-reserved filter fields: keyword/page/perPage/
//    sortBy/sortOrder are excluded, customerType is the only remaining key ──
type ReadWhere = NonNullable<NonNullable<Parameters<Repo['read']>[0]>['where']>
type _ReadWhereExactlyCustomerType = Expect<Equal<keyof ReadWhere, 'customerType'>>

// ── BaseCrudService accepts the inferred repository with no casts or module aliases ──
const service = new BaseCrudService({
  repository: repo,
  api: customerContract.api,
  searchFields: ['customerIndex', 'customerName', 'address'],
})

type ListItem = Awaited<ReturnType<typeof service.list>>['items'][number]
type Detail = Awaited<ReturnType<typeof service.getById>>
type CreateResponse = Awaited<ReturnType<typeof service.create>>
type UpdateResponse = Awaited<ReturnType<typeof service.update>>
type _ServiceList = Expect<
  Equal<ListItem, z.infer<typeof customerContract.api.response.list>>
>
type _ServiceDetail = Expect<
  Equal<Detail, z.infer<typeof customerContract.api.response.detail>>
>
type _ServiceCreate = Expect<
  Equal<CreateResponse, z.infer<typeof customerContract.api.response.create>>
>
type _ServiceUpdate = Expect<
  Equal<UpdateResponse, z.infer<typeof customerContract.api.response.update>>
>

// ── negative: the removed five-generic constructor no longer exists ──
// The five arguments are all VALID under the old class (TApiRow/TDbRow satisfy
// `extends object`), so this compiles pre-refactor and fails ONLY once the class
// collapses to a single `TContract` generic — proving the arity change itself.
// @ts-expect-error — GSheetRepository takes exactly one type argument now (TContract)
type _LegacyArity = GSheetRepository<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>

// ── negative: the removed rowSchema / primaryKey / fieldMap options no longer exist ──
// A variable (not a fresh literal) isolates the failure to the missing `contract`
// required option, so the @ts-expect-error catches exactly one error on its line.
const legacyOptions = {
  sheetName: 'Customers',
  spreadsheetId: 'x',
  scriptUrl: 'y',
  rowSchema: customerContract.db.row,
  primaryKey: customerContract.db.primaryKey,
  fieldMap: customerContract.db.fieldMap,
}
// @ts-expect-error — `contract` is required; rowSchema/primaryKey/fieldMap are gone
const _legacyOptionsRepo = new GSheetRepository(legacyOptions)

// ── negative: a removed option is rejected even when the required `contract` is present ──
// Fresh literal so excess-property checking fires; the directive sits on the offending
// `rowSchema` line so it catches exactly that excess-property error post-refactor.
const _legacyKeyRejected = new GSheetRepository({
  contract: customerContract,
  sheetName: 'Customers',
  spreadsheetId: 'x',
  scriptUrl: 'y',
  // @ts-expect-error — rowSchema was removed; not accepted even alongside `contract`
  rowSchema: customerContract.db.row,
})

// ── negative: a DB row contract without `.shape` fails type checking (no cast bypass) ──
const goodRowSchema = zod.object({ A: zod.string() })
const _goodRow: ModuleDbContract['row'] = goodRowSchema // a ZodObject is accepted
const badRowSchema = zod.string()
// @ts-expect-error — a DB row schema must be a ZodObject exposing `.shape`; z.string() is not
const _badRow: ModuleDbContract['row'] = badRowSchema

// ── negative: a DB bundle missing a required slot fails the structural guard ──
// Indirection through a well-typed variable keeps the error on the assignment line
// (one error: the missing `response` slot), so the directive catches exactly it.
const incompleteDbBundle = {
  row: goodRowSchema,
  fieldMap: { A: 'a' },
  primaryKey: 'a',
  request: { create: zod.object({}), update: zod.object({}) },
}
// @ts-expect-error — the DB bundle is missing the required `response` slot
const _incompleteDbContract: ModuleDbContract = incompleteDbBundle

const incompleteApiBundle = {
  query: { list: zod.object({}) },
  request: { create: zod.object({}), update: zod.object({}) },
}
// @ts-expect-error — the API bundle is missing the required `response` slot
const _incompleteApiContract: ModuleApiContract = incompleteApiBundle

// ── read-only module: list-only API + empty DB request satisfies the widened guards ──
const readOnlyListQuery = zod.object({
  keyword: zod.string().default(''),
  page: zod.coerce.number().int().positive().default(1),
  perPage: zod.coerce.number().int().positive().default(20),
  sortBy: zod.enum(['id']).default('id'),
  sortOrder: zod.enum(['asc', 'desc']).default('asc'),
  filterId: zod.string().min(1),
})
const readOnlyListResponse = zod.object({
  id: zod.string(),
  label: zod.string().nullable(),
})
const readOnlyRow = zod.object({
  id: zod.string(),
  label: zod.string().nullable(),
})

const readOnlyApiContract = {
  query: { list: readOnlyListQuery },
  response: { list: readOnlyListResponse },
} satisfies ModuleApiContract

const readOnlyDbContract = {
  row: readOnlyRow,
  fieldMap: { id: 'id', label: 'label' },
  primaryKey: 'id',
  request: {},
  response: { read: readOnlyRow.partial() },
} satisfies ModuleDbContract

const readOnlyContract = {
  api: readOnlyApiContract,
  db: readOnlyDbContract,
} satisfies ModuleContract

const readOnlyRepo = new GSheetRepository({
  contract: readOnlyContract,
  sheetName: 'ReadOnly',
  spreadsheetId: 'x',
  scriptUrl: 'y',
})

const readOnlyService = new BaseCrudService({
  repository: readOnlyRepo,
  api: readOnlyContract.api,
  searchFields: [],
})

// list remains callable and returns the list response DTO
type ReadOnlyListItem = Awaited<ReturnType<typeof readOnlyService.list>>['items'][number]
type _ReadOnlyList = Expect<
  Equal<ReadOnlyListItem, z.infer<typeof readOnlyListResponse>>
>

// repository create/update are uncallable with a real argument (ModuleCreate/Update = never)
// @ts-expect-error — create is not supported; data must be never
readOnlyRepo.create({ id: 'x' })
// @ts-expect-error — update is not supported; data must be never
readOnlyRepo.update('x', { label: 'y' })

// service create/update/getById are uncallable with a real argument
// @ts-expect-error — getById is not supported; id must be never
readOnlyService.getById('x')
// @ts-expect-error — create is not supported; payload must be never
readOnlyService.create({ id: 'x' })
// @ts-expect-error — update is not supported; id/payload must be never
readOnlyService.update('x', { label: 'y' })

// ── request present, response write slots absent: service still uncallable ──
// Codex finding: create/update must key off BOTH request and response generics.
// A contract with request.create/update but no response.create/update must not
// leave .create()/.update() compile-time callable (runtime already rejects them).
const requestWithoutWriteResponseApi = {
  query: { list: readOnlyListQuery },
  request: {
    create: zod.object({ label: zod.string() }),
    update: zod.object({ label: zod.string().optional() }),
  },
  response: {
    list: readOnlyListResponse,
    // intentionally no detail / create / update response schemas
  },
} satisfies ModuleApiContract

const requestWithoutWriteResponseDb = {
  row: readOnlyRow,
  fieldMap: { id: 'id', label: 'label' },
  primaryKey: 'id',
  request: {
    create: zod.object({ label: zod.string() }),
    update: zod.object({ label: zod.string().optional() }),
  },
  response: { read: readOnlyRow.partial() },
} satisfies ModuleDbContract

const requestWithoutWriteResponseContract = {
  api: requestWithoutWriteResponseApi,
  db: requestWithoutWriteResponseDb,
} satisfies ModuleContract

const requestWithoutWriteResponseRepo = new GSheetRepository({
  contract: requestWithoutWriteResponseContract,
  sheetName: 'PartialWrite',
  spreadsheetId: 'x',
  scriptUrl: 'y',
})

const requestWithoutWriteResponseService = new BaseCrudService({
  repository: requestWithoutWriteResponseRepo,
  api: requestWithoutWriteResponseContract.api,
  searchFields: [],
})

// @ts-expect-error — request.create present but response.create absent → uncallable
requestWithoutWriteResponseService.create({ label: 'x' })
// @ts-expect-error — request.update present but response.update absent → uncallable
requestWithoutWriteResponseService.update('x', { label: 'y' })
// getById still keys only on response.detail (absent here)
// @ts-expect-error — response.detail absent → getById uncallable
requestWithoutWriteResponseService.getById('x')
