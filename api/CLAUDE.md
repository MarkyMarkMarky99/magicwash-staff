# CLAUDE.md - Vercel Serverless API

Serverless backend for the Vue webapp. Data lives in Google Sheets — reads use GViz
(unauthenticated). Writes are migrating sheet-by-sheet from Apps Script/SheetLib
`doPost` to the authenticated Google Sheets API, opt-in per sheet via
`SheetContract.writeTransport`. Read that field in the sheet's own `db-contract.ts`
to know which transport it uses — do not assume, and do not rely on a count of
migrated sheets written down anywhere, including here.

## Tech Stack

- TypeScript (strict), Vercel serverless — no HTTP framework, file-based routing
- Zod v3 — runtime validation and type inference
- Google Sheets — GViz reads; writes via Apps Script/SheetLib or, per sheet
  opt-in, the Google Sheets API (`SheetContract.writeTransport`)
- Native `fetch` for outbound HTTP

## Project Structure

⚠️ **Vercel function budget:** every `.ts`/`.js` under `api/` becomes one serverless function; Hobby plan caps at **12**. The project intentionally has one function: `api/[...path].ts`. All gateway, registry, module, and helper code lives outside `api/`. Root Directory = `webapp-vue`.

- `api/[...path].ts` — the single Vercel catch-all gateway function. It parses the path and delegates to the injected route registry.
- `server/api/route-registry.ts` — lazy dynamic imports for module route definitions. Keep every relative dynamic import specifier on an explicit `.js` extension.
- `contracts/<feature>/<m>-api.schema.ts` — per-feature FE↔BE API contract (camelCase request/response schemas + enums), shared with the frontend via `@contracts/*`.
- `contracts/shared/api.schema.ts` — the generic FE↔BE contract: HTTP/query conventions + the response envelope (`apiSuccessSchema`/`apiPaginatedSchema`/`apiErrorResponseSchema`, error codes, pagination meta, defaults). Pure Zod, no type exports — consumers `z.infer`.
- `server/sheets/<Sheet>/` — one `SheetContract` and one `SheetRepository` per physical sheet. `<Sheet>.repository.ts` is the only construction site and exposes a lazy memoized getter.
- `server/modules/<module>/` — feature services, queries, route wiring, and the module-owned DB-to-API mapping. Complex modules may orchestrate several sheet getters.
- `server/shared/` — cross-feature infrastructure (HTTP, sheet repositories, services, DTOs, and utils).
- **Backend imports are RELATIVE** (`../../server/...`, `../../../contracts/...`) — no tsconfig path alias. The `@contracts/*` alias is FRONTEND-only (Vite).
- ⚠️ **Every relative import/export specifier MUST include an explicit `.js` extension** (e.g. `from '../../server/modules/customers/customer.module.js'`, pointing at the `.ts` source — TypeScript maps it correctly). `@vercel/node` does **not** bundle these routes zero-config: it only bundles when `VERCEL_API_FUNCTION_BUNDLING=1` is set, which it isn't here; otherwise it renames `.ts`→`.js` and traces dependencies as separate files run under Node's native ESM loader (`package.json` has `"type": "module"`), which requires extensions and throws `ERR_MODULE_NOT_FOUND` without them. `api/tsconfig.json`'s `moduleResolution: "Bundler"` silently allows missing extensions at typecheck time — `npm run typecheck:api` and `vercel dev` will NOT catch a missing extension; only a real `vercel build`/deploy does. Caused a full production outage on 2026-07-21 (all `/api/*` routes down) — see the fix commit `0111faf` for the full incident writeup.

## Module Structure (`server/modules/<module>/`)

API contracts are public and camelCase. Physical sheet contracts are backend-only
and use the exact DB column names in physical order; `primaryKey` is also the real
DB column name.

```ts
// contracts/<m>/<m>-api.schema.ts — API ↔ frontend contract:
export const fooApiContract = {
  query: { list: fooListQuerySchema },
  request: { create: fooCreateSchema, update: fooUpdateSchema },
  response: {
    list: fooListResponseSchema,
    detail: fooDetailResponseSchema,
    create: fooCreateResponseSchema,
    update: fooUpdateResponseSchema,
  },
} satisfies ModuleApiContract
```

```ts
// server/sheets/Foos/Foos.db-contract.ts — one physical sheet:
export const fooRowSchema = z.object({
  FooID: z.string(),
  Name: z.string(),
  Notes: z.string().nullable(),
}) // key order = physical column order; never reorder

export const fooDbContract = {
  row: fooRowSchema,
  primaryKey: 'FooID', // physical DB column, not the API field name
  sheetName: 'Foos',
  spreadsheetId: 'FOOS_SPREADSHEET_ID',
  target: 'Foo',
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
```

```ts
// server/sheets/Foos/Foos.repository.ts — the only construction site:
let repository: SheetRepository<FooRow> | undefined

export function getFooRepository(): SheetRepository<FooRow> {
  return repository ??= new SheetRepository({ contract: fooDbContract })
}
```

```ts
// server/modules/foos/foo.module.ts — module mapping and service wiring:
const fooFieldMap = {
  FooID: 'fooId',
  Name: 'name',
  Notes: 'notes',
} as const satisfies Record<keyof FooRow & string, string>

const fooJsonColumns = {
  Notes: { field: 'notes', kind: 'object' },
} as const satisfies JsonColumnMap

export const fooService = new BaseCrudService({
  repository: getFooRepository,
  api: fooApiContract,
  searchFields: ['fooId', 'name'],
  fieldMap: fooFieldMap,
  jsonColumns: fooJsonColumns,
})

export const fooRoutes = createCrudRoutes(fooService, fooApiContract)
```

`fieldMap` maps DB column names to API/domain names. `jsonColumns` identifies DB
text columns whose JSON storage must be decoded into API fields. Both belong to the
owning module and are passed to `BaseCrudService`; `SheetRepository` speaks only DB
column names and knows nothing about the API contract. `createCrudRoutes` derives
POST, item GET, and PATCH from the paired capability slots in the API contract.

Complex modules (multi-sheet reads, 1:n assembly, business rules beyond CRUD+filter)
keep dedicated query, mapper, and service layers inside `server/modules/<module>/`.
Their service obtains the needed `get<Sheet>Repository()` functions directly and
owns the cross-sheet workflow; there is no central repository registry.

## Architecture Rules

- **Module route wiring is generic, not hand-written** — `createCrudRoutes(service, api)` (`server/shared/http/crud-routes.ts`) builds every module's collection/item `ApiHandler`s from the API contract capability slots; a module never writes its own `ApiHandler`/`ok`/`created`/`okPaged` wiring. Business logic beyond CRUD+filter belongs in the service.
- **Dependency direction:** `routes → service → sheet repository → queries`.
- **Sheet ownership is physical:** `server/sheets/<Sheet>/<Sheet>.repository.ts` is the only file that constructs that sheet's `SheetRepository`, behind a lazy memoized `get<Sheet>Repository()` getter. A physical sheet has one row schema, one `SheetContract`, one primary key, and one write-capability declaration.
- **SheetRepository is DB-only:** it owns GViz queries, column-letter derivation, and write transport (Apps Script/SheetLib, or the Google Sheets API for sheets that opt in via `writeTransport`) using DB column names. It does not import or understand an API contract.
- **Module mapping is load-bearing:** each DB-shaped service declares `fieldMap` (DB column → API field) and, when needed, `jsonColumns` on `BaseCrudService`. Mapping applies to queries, payloads, and response rows; JSON decoding applies only to the listed text columns.
- **Primary keys are physical:** `SheetContract.primaryKey` is the real DB column name. The service maps the API id to that column before the repository reads, updates, or deletes.
- **Type import direction:** feature API schemas in `contracts/` do not import from `server/`; sheet DB contracts may reuse API enums, but API contracts never depend on DB shapes. `ModuleApiContract` is the shared API-side structural type.
- **What may live in `contracts/`:** per-feature camelCase request/response schemas and enums, the generic request/response envelope (`contracts/shared/api.schema.ts`), and the API contract-shape types (`contracts/shared/module-api-contract.ts`). Never put DB row schemas, repository types, sheet contracts, services, or handler runtime objects there.

### Key Engine Rules

- **Repository contract:** `BaseCrudService` can consume a DB-shaped `SheetRepositoryContract`; `SheetRepository` implements it with GViz reads and, per sheet, either SheetLib/App Script or Google Sheets API writes (`SheetContract.writeTransport`). Storage and transport details stay in the repository; API mapping stays in the module service.
- **Read pipeline:** `BaseCrudService` validates `api.query.list`, builds `ReadQueryDTO.fromQuery(query, searchFields)` (keyword→search; page/perPage/sort reserved; every other field→`where`), maps API fields to DB fields, and calls the sheet repository. `getById` and `update` address the service id through the physical `primaryKey`.
- **Contracts are machine-checked:** API bundles use `satisfies ModuleApiContract`, sheet bundles use `satisfies SheetContract`, and field maps use `satisfies Record<keyof row & string, string>`. Runtime tests must pin field-map values because `satisfies` checks keys and types, not semantic string values.
- **Cell values are not runtime-validated on reads:** legacy dirty rows must flow through reads and write responses without 500. Response schemas drive projection through their `.shape` key set. A GViz column that resolves to no DB field throws because that is contract drift, not dirty data.
- **SheetLib contract:** APPEND/UPDATE return the stored row in `data`; UPDATE is PATCH and sends only changed fields. Every write has an explicit target. A confirmed write with an unusable response shape is a transport-unknown outcome and must not be classified as a rejection, because retrying could duplicate persisted rows.
- **Sheets API contract:** for a sheet with `writeTransport: 'sheets-api'`, UPDATE looks up the row's line number by primary key (`findRowNumberByKey`, an accepted lookup-to-write race — see that file's doc comment), patches only the changed columns via `values:batchUpdate` under `USER_ENTERED`, then reads the row back and verifies its primary key still matches before returning it. `WriteRejectedError`/`WriteTransportError`/`WriteCommittedUnreadableError`/`DuplicateRowKeyError`/`WriteRowIdentityMismatchError` classify into the same `rejected`/`unknown` certainty taxonomy as SheetLib errors.
- **Which write path a sheet uses:** read `writeTransport` in that sheet's `db-contract.ts`. Absent means SheetLib. A sheet on `'sheets-api'` has no `scriptUrl` at all, so any operation its `writes` flags leave enabled must have a Sheets API implementation — there is no SheetLib fallback to catch it. Never assume from a migration count written in prose; it will be out of date.
- **Date values:** the backend returns GViz's raw date form (`Date(Y,M,D)` or the raw text returned by GViz). Date formatting belongs to the frontend.
- **Audit columns** (`updated_at`/`updated_by`/`deleted_at`/…) normally appear in no response schema. The actor is client input only where the feature contract explicitly permits it.
- **No business hooks in the generic engine:** the normal flow is validate → read/write → module mapping/decoding → project. Multi-sheet or nonstandard business decisions belong in a dedicated service.

## Portal view sheets (InvoicesView, OrdersView, …)

A portal view sheet is Apps Script's pre-processed, joined, and totaled read model,
materialized in a sheet because GViz is the backend's read mechanism. If business data
is wrong, fix the Apps Script source rather than adding guesses to the API or frontend.

- A sheet cell cannot hold a nested array/object, so Apps Script stores those values as
  JSON text. The owning module declares each such DB column in `jsonColumns`; the
  service decodes it into the named API field and applies the deliberate malformed-cell
  fallback (`[]` for arrays, `null` for objects). Nested DB keys are converted to API
  camelCase during that module-owned mapping.
- JSON decoding is storage-format handling, not data-quality repair. Do not add
  coercion or defaults for fields the view is supposed to populate.
- A legitimately `null` value is a real business state, not missing data to replace.
- GViz dates remain raw in the backend; the frontend owns display formatting.

## Singletons via the module cache

Each physical-sheet repository is constructed behind a lazy memoized getter in
`server/sheets/<Sheet>/<Sheet>.repository.ts` (`get<Sheet>Repository()` caches into a
module-scoped `let`). The module passes that getter to `BaseCrudService`, so importing
the module does not construct an unrelated sheet repository. Node's module cache makes
each repository, service, and route a singleton per cold start; environment variables
are read when the getter first initializes. `server/api/route-registry.ts` loads each
module lazily via a literal `import()` (never computed from a request-time value), so
Vercel's file tracer can bundle every route and an unrelated route does not require
another sheet's environment variables.

## Validation

- Service entry points call `parseOrThrow(schema, raw)` → 422 with flattened issues. Never cast with `as` in module code.
- List queries validated by Zod (`z.coerce` for numbers, `.default()` for optionals, `.refine` for cross-field) → bad input 422.
- Define `z.enum` exclusively in the feature schema file. Derive input types with `z.input<typeof schema>`; never hand-write mirroring interfaces.

## Response Contract

Success: `{ data, meta }`; paginated: `meta.pagination = { total, page, perPage, totalPages }`; error: `{ error: { code, message, details? } }`. Built only via `ok`/`created`/`okPaged`/`ApiError` from `server/shared/http/`. The envelope shape is the shared Zod contract `contracts/shared/api.schema.ts` (single source for FE + BE); the `server/shared/http/` builders infer their types from it directly (no parallel type declarations).

## Testing

No test runner is installed (no jest/vitest/mocha) — tests are plain TypeScript files run
directly with `npx tsx <path>`, asserting via `node:assert/strict`. They live under
`tests/server/`, not colocated with the source they cover; the subpath mirrors the module's path
under `server/` (e.g. `server/modules/orders/orders.transformer.ts` →
`tests/server/unit/modules/orders/orders.transformer.dry-test.ts`).

- `tests/server/unit/<mirrored-path>/<name>.dry-test.ts` — runtime tests (hand-rolled `test()`
  collector + `assert`, run via `npx tsx`). Reserve "integration" for a test that hits a
  real external system (live Google Sheets); a test that only uses fakes/mocked `fetch` is
  still `unit`, not `integration`.
- `tests/server/types/<mirrored-path>/<name>.type-test.ts` — compile-time-only tests (`Expect`/
  `Equal`/`@ts-expect-error` type assertions, zero runtime code). Enforced exclusively by
  `npm run typecheck:api` — never run with `tsx`.
- Every test file imports the real module(s) it covers via relative paths back into `server/`/
  `contracts/` — no mocking framework, no colocated fixtures — and keeps the explicit `.js`
  extension on backend imports per the rule above.
- `api/tsconfig.json`'s `include` has `../tests/server/**/*.ts` alongside `../server/**/*.ts` so
  these stay covered by `typecheck:api`. Frontend tests (`tests/web/`) are deliberately NOT in
  this include — don't widen it to `../tests/**/*.ts`, that would pull frontend code into a
  command named `typecheck:api`.
- Run `tests/server/integration/sheet-column-parity.ts` against the live sheets before deploying
  a contract change. It verifies contracts against live sheet headers, not the route registry.

## Gotchas

- Don't add repository/query methods speculatively — the existing read/query pipeline covers most ad-hoc reads.
- Don't widen `perPage` past its `.max()` — over-limit is 422, not a clamp.
- GViz date strings are returned raw; do not parse or format them in the backend. ISO `YYYY-MM-DD` strings compare correctly with `<=` when a service needs a date range.
- Environment variables are read when each `get<Sheet>Repository()` first initializes its module-scoped cache. A repository needs its workbook id (`CUSTOMERS_SPREADSHEET_ID`, `ORDERS_SPREADSHEET_ID`, …) and, for a sheet it writes, the service-account credentials in `GOOGLE_SERVICE_ACCOUNT_KEY`. There is no shared Apps Script endpoint any more: writes go through the Sheets API, and `APPSCRIPT_INVOICE_VIEW_SYNC_URL` is the only Apps Script URL left — it recomputes InvoicesView and is not a sheet-row write.
