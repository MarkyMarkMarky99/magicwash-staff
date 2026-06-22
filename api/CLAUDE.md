# CLAUDE.md - Vercel Serverless API

Serverless backend for the Vue webapp. Data lives in Google Sheets — reads via GViz (unauthenticated), writes via Apps Script `doPost` (HTTP POST).

## Tech Stack
- TypeScript (strict), Vercel serverless — no HTTP framework, file-based routing
- Zod v3 — runtime validation and type inference
- Google Sheets — GViz reads, Apps Script writes
- Native `fetch` for outbound HTTP

## Project Structure

⚠️ **Vercel function budget:** every `.ts`/`.js` under `api/` becomes one serverless function; Hobby plan caps at **12**. So `api/` holds **route files only** — all helper code lives outside `api/` and is bundled into importing routes (not counted). Root Directory = `webapp-vue`.

- `api/<feature>/` — route files only: `index.ts` (list/create), `[id].ts` (get/update). These are the serverless functions. (Legacy `customers.js`/`gviz.js`/`write.js` are also routes.)
- `contracts/<feature>/<m>-api.schema.ts` — per-feature FE↔BE API contract (camelCase request/response schemas + enums), shared with the frontend via `@contracts/*`.
- `contracts/shared/api.schema.ts` — the generic FE↔BE contract: HTTP/query conventions + the response envelope (`apiSuccessSchema`/`apiPaginatedSchema`/`apiErrorResponseSchema`, error codes, pagination meta, defaults). Pure Zod, no type exports — consumers `z.infer`.
- `server/modules/<module>/` — business logic per feature (db contract + wiring; complex modules keep layered folders).
- `server/shared/` — cross-feature infrastructure (http, google-sheets, sheet-crud, repositories, utils).
- `server/gviz/` — legacy GViz proxy (`gviz-utils.js`) + per-sheet column maps (`schemas/*.js`), used by the `.js` routes.
- **Backend imports are RELATIVE** (`../../server/...`, `../../../contracts/...`) — no tsconfig path alias; `@vercel/node`/esbuild resolves zero-config. The `@contracts/*` alias is FRONTEND-only (Vite).

## Module Structure (`server/modules/<module>/`)

**Simple modules** (one sheet, CRUD + filters) consist of `<m>-db.schema.ts` + `<m>.module.ts` (wiring only) in `server/modules/<m>/`, plus `<m>-api.schema.ts` in `contracts/<m>/`. Skeleton:

```ts
// contracts/<m>/<m>-api.schema.ts — API ↔ frontend contract (all camelCase); shared with FE:
export const fooCreateSchema = z.object({ name: z.string().min(1), createdBy: z.string().min(1), ... })
export const fooUpdateSchema = z.object({ name: z.string().optional(), updatedBy: z.string().min(1) }).refine(...)
export const fooListQuerySchema = z.object({ keyword: ..., page: ..., sortBy: ..., ... })
// Response schemas DRIVE projection: fields (camelCase twins of row columns, key order = DTO key order).
export const fooListResponseSchema = z.object({ fooId: z.string(), name: z.string() })
export const fooDetailResponseSchema = fooListResponseSchema.extend({ notes: z.string().nullable() })
export const fooCreateResponseSchema = fooDetailResponseSchema
export const fooUpdateResponseSchema = fooDetailResponseSchema
// One NESTED API bundle, same shape every module (satisfies ModuleApiContract):
export const fooApiSchemas = {
  query: { list: fooListQuerySchema },
  request: { create: fooCreateSchema, update: fooUpdateSchema },
  response: {
    list: fooListResponseSchema, detail: fooDetailResponseSchema,
    create: fooCreateResponseSchema, update: fooUpdateResponseSchema,
  },
} satisfies ModuleApiContract

// server/modules/<m>/<m>-db.schema.ts — API ↔ DB contract (sheet column keys):
//   ⚠️ row key order = physical column order (1st key = column A); never reorder.
export const fooRowSchema = z.object({ FooID: z.string(), Name: z.string(), Notes: ..., ... })
// DB request payloads declared PER ACTION, not derived from the row. Omitted columns = DB fills on APPEND.
export const fooDbCreateRequestSchema = z.object({ Name: z.string().min(1), Notes: z.string().nullable(), CreatedBy: z.string().min(1) })
export const fooDbUpdateRequestSchema = z.object({ Name: z.string().optional(), Notes: ..., UpdatedBy: z.string().min(1) })
export const fooFieldMap = { FooID: 'fooId', Name: 'name', Notes: 'notes', ... } as const satisfies Record<keyof z.infer<typeof fooRowSchema> & string, string>
// One NESTED DB bundle (satisfies ModuleDbContract). primaryKey is the API/domain
// field name (fooId), NOT the DB column (FooID). request/response describe the DB
// boundary; the repository consumes row/fieldMap/primaryKey today.
export const fooDbContract = {
  row: fooRowSchema, fieldMap: fooFieldMap, primaryKey: 'fooId',
  request: { create: fooDbCreateRequestSchema, update: fooDbUpdateRequestSchema },
  response: { read: fooRowSchema.partial(), create: fooRowSchema, update: fooRowSchema },
} satisfies ModuleDbContract

// server/modules/<m>/<m>.module.ts — wiring only. Compose the module contract, then
// derive type aliases next to their consumer (schema files export NO z.infer types):
const fooContract = { api: fooApiSchemas, db: fooDbContract } satisfies ModuleContract
type FooDbRow = z.infer<typeof fooContract.db.row>
type FooListQuery = z.infer<typeof fooContract.api.query.list>
type FooCreate = z.infer<typeof fooContract.api.request.create>
type FooUpdate = z.infer<typeof fooContract.api.request.update>
type FooApiRow = ApiRowFromFieldMap<FooDbRow, typeof fooContract.db.fieldMap>
type FooReadWhere = OmitReservedQueryFields<FooListQuery>

const fooRepository = new GSheetRepository<FooApiRow, FooDbRow, FooReadWhere, FooCreate, FooUpdate>({
  sheetName: 'Foos', spreadsheetId: requireEnv('FOOS_SPREADSHEET_ID'), scriptUrl: requireEnv('APPSCRIPT_URL'),
  rowSchema: fooContract.db.row, primaryKey: fooContract.db.primaryKey, fieldMap: fooContract.db.fieldMap,
})

export const fooService = new BaseCrudService({
  repository: fooRepository,
  api: fooContract.api,
  searchFields: ['fooId', 'name'],   // API/domain fields the list keyword searches
})
```

The shared contract-shape types are the standard every module conforms to:
`ResponseSchema` / `ModuleApiContract` / `ModuleApiContractOf` live in
`contracts/shared/module-api-contract.ts` (API side, FE-shareable); `FieldMap` /
`ModuleDbContract` / `ModuleDbContractOf` / `ModuleContract` live in
`server/shared/contracts/module-db-contract.ts` (DB side, backend-only). A module's
bundles are checked with `satisfies`; `BaseCrudService` consumes the parameterized
`ModuleApiContractOf` so each slot keeps its precise DTO type.

**Complex modules** (multi-sheet reads, 1:n assembly, business rules beyond CRUD+filter) keep dedicated layers, composing `BaseSheetRepository`, `createClauseBuilders`, `createSheetQuery`, and naming utils from `server/shared/sheet-crud/` and `server/shared/repositories/`:

- `types/` — static declarations only (schemas, shapes, enums, DTOs); if data flows through a file it belongs in `queries/` or `mappers/`
- `queries/` — query builders
- `repositories/` — data access
- `mappers/` — data transform
- `services/` — business logic

## Architecture Rules

- **Route files stay one line per method** — no logic in routes; call `list`/`getById`/`create`/`update`.
- **Dependency direction:** `routes → service → repository → queries`
- **Type import direction:** `server/modules/<m>/<m>-db.schema.ts` (DB) → `contracts/<m>/<m>-api.schema.ts` (API). DB contract may reuse API enums; never the reverse.
- **What may live in `contracts/`:** the per-feature camelCase request/response schemas + enums, the generic request/response envelope (`contracts/shared/api.schema.ts`) — pure Zod, no type exports — and the API contract-*shape* meta-types (`contracts/shared/module-api-contract.ts`: `ResponseSchema`/`ModuleApiContract`/`ModuleApiContractOf`), which are structural TS types (no DB shape, no `server/` import) shared by FE and BE. **Never in `contracts/`:** DB row/payload schemas, repository types, the DB-side contract shapes (`ModuleDbContract`/`ModuleContract` live in `server/shared/contracts/`), the serverless **handler runtime object** (`ApiHandlerRequest` + raw query — co-located in `server/shared/http/api-handler.ts`), or business services — and a `contracts/` file must never import from `server/` or `api/`.

### Key Engine Rules

Target stack: `BaseCrudService` (storage-agnostic service) + `BaseRepository`/`GSheetRepository` (`server/shared/repositories/`) + the `ModuleContract` bundles. This is the source of truth for new and migrated modules.

- **Repository is a contract:** the service depends on `BaseRepository<TApiRow, TReadWhere, TCreate, TUpdate>` (`read`/`create`/`update`/`delete`, all API/domain-shaped). `GSheetRepository` is its Google Sheets implementation and owns every transport detail — GViz query strings + reads, Apps Script writes, column-letter derivation from the row schema. Swap storage by implementing the same contract; `BaseCrudService` stays unchanged.
- **Field map is load-bearing:** each `<m>-db.schema.ts` declares an explicit `fieldMap` (DB column → API/domain field) checked with `satisfies Record<keyof row & string, string>`. The mapper renames keys both ways for queries, payloads, and responses; irregular pairs the old PascalCase↔camelCase convention can't express (`Line → lineId`) ride on the map. Omit a column to keep its name (identity).
- **Reads flow through `ReadQueryDTO`:** `BaseCrudService` validates the list query (`api.query.list`), builds an immutable `ReadQueryDTO.fromQuery(query, searchFields)` (keyword→search; page/perPage/sort reserved; every other field→`where`), and passes it to `repository.read()`, which maps API fields → DB columns before the GViz query. `getById`/`update` address one row by the API `primaryKey`, folded into `where[primaryKey]`. The read-where type is DERIVED — `OmitReservedQueryFields<TListQuery>`, no separate filter generic.
- **Contracts are machine-checked:** `<m>ApiSchemas satisfies ModuleApiContract`, `<m>DbContract satisfies ModuleDbContract`, `<m>Contract satisfies ModuleContract`, plus `fieldMap satisfies Record<keyof row & string, string>`. A missing/stray column, a wrong DTO type, or a bundle slot left out is a compile error.
- **Cell values are NEVER runtime-validated** — legacy data is dirty by decision; dirty rows must flow through reads AND write responses without 500. Response schemas drive projection (their `.shape` key set) at compile time only — `BaseCrudService` never `.parse()`s a row. A GViz column that resolves to no DB field throws (contract drift, not dirty data).
- **doPost contract:** APPEND/UPDATE return the stored row in `data`. UPDATE is PATCH — only changed fields sent; the id is passed to the repository separately and pinned last in the doPost body (route id wins). DB-side request/response escape hatches use the repository `transformer` (`RepositoryTransformer`), not a service hook.
- **Audit columns** (`UpdatedAt`/`UpdatedBy`/`DeletedAt`/…) appear in no response schema. The actor (`updatedBy`) is client input.
- **No hooks in `BaseCrudService`:** the flow is fixed (validate → read/write → project). Business logic beyond CRUD+filter belongs in a dedicated service for that module, not in the generic engine.
- **Legacy/transition:** `server/shared/sheet-crud/` (the `createSheetService` / `createGoogleSheetRepository` factories, `ResourceRepository`, `sheet-naming`) still backs not-yet-migrated paths and is being removed. Do **not** treat the factory flow as the source of truth for new work.

## Singletons via the module cache

Repositories and services are class instances created once at module scope (`const fooRepository = new GSheetRepository(...)`, `export const fooService = new BaseCrudService(...)`). Node's module cache makes them true singletons; constructors read env once at first import (safe: `tsc` doesn't execute modules; Vercel cold start has env). Wiring is through imports — no per-module factory files. (Legacy `sheet-crud` modules still expose object-literal services from generic factories; those are being migrated to the class-instance form above.)

## Validation

- Service entry points call `parseOrThrow(schema, raw)` → 422 with flattened issues. Never cast with `as` in module code.
- List queries validated by Zod (`z.coerce` for numbers, `.default()` for optionals, `.refine` for cross-field) → bad input 422.
- Define `z.enum` exclusively in the feature schema file. Derive input types with `z.input<typeof schema>`; never hand-write mirroring interfaces.

## Response Contract

Success: `{ data, meta }`; paginated: `meta.pagination = { total, page, perPage, totalPages }`; error: `{ error: { code, message, details? } }`. Built only via `ok`/`created`/`noContent`/`okPaginated`/`ApiError` from `server/shared/http/`. The envelope shape is the shared Zod contract `contracts/shared/api.schema.ts` (single source for FE + BE); the `server/shared/http/` builders infer their types from it directly (no parallel type declarations).

## Gotchas

- Don't add repository/query methods speculatively — `getByFilter` covers most ad-hoc reads.
- Inside `server/shared/sheet-crud/` factories, commented casts that only erase generics are allowed — the config mapped types already verified every field↔column pairing.
- Don't widen `perPage` past its `.max()` — over-limit is 422, not a clamp.
- ISO `YYYY-MM-DD` strings compare correctly with `<=` — no Date parsing needed.
- Env vars are read once at module import; every backend module must use the shared Apps Script endpoint `APPSCRIPT_URL` plus module-specific sheet vars such as `CUSTOMERS_SPREADSHEET_ID` and `CUSTOMERS_SHEET_NAME`.
