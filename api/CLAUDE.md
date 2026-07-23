# CLAUDE.md - Vercel Serverless API

Serverless backend for the Vue webapp. Data lives in Google Sheets — reads via GViz (unauthenticated), writes via Apps Script `doPost` (HTTP POST).

## Tech Stack
- TypeScript (strict), Vercel serverless — no HTTP framework, file-based routing
- Zod v3 — runtime validation and type inference
- Google Sheets — GViz reads, Apps Script writes
- Native `fetch` for outbound HTTP

## Project Structure

⚠️ **Vercel function budget:** every `.ts`/`.js` under `api/` becomes one serverless function; Hobby plan caps at **12**. The project intentionally has one function: `api/[...path].ts`. All gateway, registry, module, and helper code lives outside `api/`. Root Directory = `webapp-vue`.

- `api/[...path].ts` — the single Vercel catch-all gateway function. It parses the path and delegates to the injected route registry.
- `server/api/route-registry.ts` — lazy dynamic imports for module route definitions. Keep every relative dynamic import specifier on an explicit `.js` extension.
- `contracts/<feature>/<m>-api.schema.ts` — per-feature FE↔BE API contract (camelCase request/response schemas + enums), shared with the frontend via `@contracts/*`.
- `contracts/shared/api.schema.ts` — the generic FE↔BE contract: HTTP/query conventions + the response envelope (`apiSuccessSchema`/`apiPaginatedSchema`/`apiErrorResponseSchema`, error codes, pagination meta, defaults). Pure Zod, no type exports — consumers `z.infer`.
- `server/modules/<module>/` — business logic per feature (db contract + wiring; complex modules keep layered folders).
- `server/modules/<module>/<module>.repository.ts` — owns constructing that module's `GSheetRepository` behind a lazy memoized getter (`get<M>Repository()`). Never imports another module's `.repository.ts`/`.module.ts` (see Architecture Rules).
- `server/modules/<module>/<module>.module.ts` — wires the already-built repository (via the getter) + service AND exports `<m>Routes` (collection/item `ApiHandler`s) via `createCrudRoutes()`. `<m>` follows the module's own file-naming (singular, e.g. `orderRoutes` from `order.module.ts` in the `orders/` folder) — check the registry's `.then((m) => m.xRoutes)` for the exact name, don't assume it from the folder/registry key. Loaded lazily by the registry; not a Vercel entrypoint.
- `server/shared/http/crud-routes.ts` — `createCrudRoutes(service, api)`, the generic CRUD→`ApiHandler` factory every module's routes export is built from (gates GET/POST/item-GET/PATCH off the module's `ModuleApiContract` capability slots).
- `server/shared/` — cross-feature infrastructure (http, repositories, services, DTOs, and utils).
- **Backend imports are RELATIVE** (`../../server/...`, `../../../contracts/...`) — no tsconfig path alias. The `@contracts/*` alias is FRONTEND-only (Vite).
- ⚠️ **Every relative import/export specifier MUST include an explicit `.js` extension** (e.g. `from '../../server/modules/customers/customer.module.js'`, pointing at the `.ts` source — TypeScript maps it correctly). `@vercel/node` does **not** bundle these routes zero-config: it only bundles when `VERCEL_API_FUNCTION_BUNDLING=1` is set, which it isn't here; otherwise it renames `.ts`→`.js` and traces dependencies as separate files run under Node's native ESM loader (`package.json` has `"type": "module"`), which requires extensions and throws `ERR_MODULE_NOT_FOUND` without them. `api/tsconfig.json`'s `moduleResolution: "Bundler"` silently allows missing extensions at typecheck time — `npm run typecheck:api` and `vercel dev` will NOT catch a missing extension; only a real `vercel build`/deploy does. Caused a full production outage on 2026-07-21 (all `/api/*` routes down) — see the fix commit `0111faf` for the full incident writeup.

## Module Structure (`server/modules/<module>/`)

**Simple modules** (one sheet, CRUD + filters) consist of `<m>.contract.ts` + `<m>.repository.ts` + `<m>.module.ts` (wiring + routes export) in `server/modules/<m>/`, plus `<m>-api.schema.ts` in `contracts/<m>/`. Skeleton:

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
export const fooApiContract = {
  query: { list: fooListQuerySchema },
  request: { create: fooCreateSchema, update: fooUpdateSchema },
  response: {
    list: fooListResponseSchema, detail: fooDetailResponseSchema,
    create: fooCreateResponseSchema, update: fooUpdateResponseSchema,
  },
} satisfies ModuleApiContract

// server/modules/<m>/<m>.contract.ts — DB contract (sheet column keys) + composed module contract:
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

// The composed module contract lives in this file too — one server-side source of truth:
export const fooContract = { api: fooApiContract, db: fooDbContract } satisfies ModuleContract
```

```ts
// server/modules/<m>/<m>.repository.ts — data access. Lazily constructed and
// memoized behind a getter so importing this file never triggers env reads or
// repository construction until a caller actually asks for it. The whole
// contract drives every inferred type, so this file declares NO
// repository-derived aliases:
let fooRepository: GSheetRepository<typeof fooContract> | undefined

export function getFooRepository(): GSheetRepository<typeof fooContract> {
  return fooRepository ??= new GSheetRepository({
    contract: fooContract,
    sheetName: 'Foos', spreadsheetId: requireEnv('FOOS_SPREADSHEET_ID'), scriptUrl: requireEnv('APPSCRIPT_URL'),
  })
}
```

```ts
// server/modules/<m>/<m>.module.ts — wiring + routes. Builds the service from
// the already-constructed repository (via the getter) and exports routes:
export const fooService = new BaseCrudService({
  repository: getFooRepository(),
  api: fooContract.api,
  searchFields: ['fooId', 'name'],   // API/domain fields the list keyword searches
})

// createCrudRoutes derives collection/item ApiHandlers from fooContract.api's
// capability slots (request.create+response.create → POST, response.detail →
// item GET, request.update+response.update → item PATCH). This IS the module's
// routes export — no separate <m>.routes.ts file.
export const fooRoutes = createCrudRoutes(fooService, fooContract.api)
```

The shared contract-shape types are the standard every module conforms to:
`ResponseSchema` / `ModuleApiContract` / `ModuleApiContractOf` live in
`contracts/shared/module-api-contract.ts` (API side, FE-shareable); `FieldMap` /
`ModuleDbContract` / `ModuleDbContractOf` / `ModuleContract` live in
`server/shared/contracts/module-db-contract.ts` (DB side, backend-only). A module's
bundles are checked with `satisfies`; `BaseCrudService` consumes the parameterized
`ModuleApiContractOf` so each slot keeps its precise DTO type.

**Complex modules** (multi-sheet reads, 1:n assembly, business rules beyond CRUD+filter) keep dedicated layers around repositories, query builders, mappers, and services inside `server/modules/<module>/`:

- `types/` — static declarations only (schemas, shapes, enums, DTOs); if data flows through a file it belongs in `queries/` or `mappers/`
- `queries/` — query builders
- `repositories/` — data access
- `mappers/` — data transform
- `services/` — business logic

A complex module composes existing simple modules by importing their `get<M>Repository()` getters directly from those modules' `.repository.ts` files (e.g. a future `invoices` module importing `getCustomerRepository()` and `getOrderRepository()` to hand-write its own service) — never by introducing a new central repository registry, and never by importing another module's `.module.ts` (that would drag in that module's `BaseCrudService`/routes as an ESM side effect just to reuse its repository).

## Architecture Rules

- **Module route wiring is generic, not hand-written** — `createCrudRoutes(service, api)` (`server/shared/http/crud-routes.ts`) builds every module's collection/item `ApiHandler`s from its contract's capability slots; a module never writes its own `ApiHandler`/`ok`/`created`/`okPaged` wiring. Business logic beyond CRUD+filter belongs in the service, never in this factory or in `<m>.module.ts`.
- **Dependency direction:** `routes → service → repository → queries`
- **Repository ownership stays with its module:** `<m>.repository.ts` is the only file that constructs `<m>`'s `GSheetRepository`, behind a lazy memoized `get<M>Repository()` getter (not a module-scope `const`), so importing it has no construction side effect until a caller actually asks for the repository. A `.repository.ts` file must never import another module's `.repository.ts` or `.module.ts` — that would either create a circular import or drag in an unrelated module's service/routes as an ESM side effect. Cross-module joins belong in a higher-level hand-written service, not in a repository file.
- **Type import direction:** `server/modules/<m>/<m>.contract.ts` (DB + composed contract) → `contracts/<m>/<m>-api.schema.ts` (API). DB contract may reuse API enums; never the reverse. (Legacy not-yet-migrated modules may still use `<m>-db.schema.ts`.)
- **What may live in `contracts/`:** the per-feature camelCase request/response schemas + enums, the generic request/response envelope (`contracts/shared/api.schema.ts`) — pure Zod, no type exports — and the API contract-*shape* meta-types (`contracts/shared/module-api-contract.ts`: `ResponseSchema`/`ModuleApiContract`/`ModuleApiContractOf`), which are structural TS types (no DB shape, no `server/` import) shared by FE and BE. **Never in `contracts/`:** DB row/payload schemas, repository types, the DB-side contract shapes (`ModuleDbContract`/`ModuleContract` live in `server/shared/contracts/`), the serverless **handler runtime object** (`ApiHandlerRequest` + raw query — co-located in `server/shared/http/api-handler.ts`), or business services — and a `contracts/` file must never import from `server/` or `api/`.

### Key Engine Rules

Target stack: `BaseCrudService` (storage-agnostic service) + `BaseRepository`/`GSheetRepository` (`server/shared/repositories/`) + the `ModuleContract` bundles. This is the source of truth for new and migrated modules.

- **Repository is a contract:** the service depends on `BaseRepository<TApiRow, TReadWhere, TCreate, TUpdate>` (`read`/`create`/`update`/`delete`, all API/domain-shaped). `GSheetRepository` is its Google Sheets implementation and owns every transport detail — GViz query strings + reads, Apps Script writes, column-letter derivation from the row schema. Swap storage by implementing the same contract; `BaseCrudService` stays unchanged.
- **Field map is load-bearing:** each `<m>.contract.ts` declares an explicit `fieldMap` (DB column → API/domain field) checked with `satisfies Record<keyof row & string, string>`. The mapper renames keys both ways for queries, payloads, and responses; irregular pairs the old PascalCase↔camelCase convention can't express (`Line → lineId`) ride on the map. Omit a column to keep its name (identity).
- **Reads flow through `ReadQueryDTO`:** `BaseCrudService` validates the list query (`api.query.list`), builds an immutable `ReadQueryDTO.fromQuery(query, searchFields)` (keyword→search; page/perPage/sort reserved; every other field→`where`), and passes it to `repository.read()`, which maps API fields → DB columns before the GViz query. `getById`/`update` address one row by the API `primaryKey`, folded into `where[primaryKey]`. The read-where type is DERIVED — `OmitReservedQueryFields<TListQuery>`, no separate filter generic.
- **Contracts are machine-checked:** `<m>ApiContract satisfies ModuleApiContract`, `<m>DbContract satisfies ModuleDbContract`, `<m>Contract satisfies ModuleContract`, plus `fieldMap satisfies Record<keyof row & string, string>`. A missing/stray column, a wrong DTO type, or a bundle slot left out is a compile error.
- **Cell values are NEVER runtime-validated** — legacy data is dirty by decision; dirty rows must flow through reads AND write responses without 500. Response schemas drive projection (their `.shape` key set) at compile time only — `BaseCrudService` never `.parse()`s a row. A GViz column that resolves to no DB field throws (contract drift, not dirty data).
- **doPost contract:** APPEND/UPDATE return the stored row in `data`. UPDATE is PATCH — only changed fields sent; the id is passed to the repository separately and pinned last in the doPost body (route id wins). DB-side request/response escape hatches use the repository `transformer` (`RepositoryTransformer`), not a service hook.
- **Audit columns** (`UpdatedAt`/`UpdatedBy`/`DeletedAt`/…) appear in no response schema. The actor (`updatedBy`) is client input.
- **No hooks in `BaseCrudService`:** the flow is fixed (validate → read/write → project). Business logic beyond CRUD+filter belongs in a dedicated service for that module, not in the generic engine.

## Singletons via the module cache

Repository construction lives behind a lazy memoized getter in `<m>.repository.ts` (`getFooRepository()` caches into a module-scoped `let` on first call). `<m>.module.ts` calls that getter once at module scope to build the service and routes (`export const fooService = new BaseCrudService({ repository: getFooRepository(), ... })`, `export const fooRoutes = createCrudRoutes(...)`). Node's module cache makes the repository (after first `get`), service, and routes true singletons per cold start; env is read on the getter's first call (safe: `tsc` doesn't execute modules; Vercel cold start has env). `server/api/route-registry.ts` loads each `<m>.module.ts` lazily via a per-module literal `import()` (never computed from a request-time value — Vercel's file tracer only bundles statically-resolvable import specifiers, so a dynamic one silently ships an empty function), so an unrelated module's repository never constructs (and its env vars are never required) just because a different module's route was hit.

## Validation

- Service entry points call `parseOrThrow(schema, raw)` → 422 with flattened issues. Never cast with `as` in module code.
- List queries validated by Zod (`z.coerce` for numbers, `.default()` for optionals, `.refine` for cross-field) → bad input 422.
- Define `z.enum` exclusively in the feature schema file. Derive input types with `z.input<typeof schema>`; never hand-write mirroring interfaces.

## Response Contract

Success: `{ data, meta }`; paginated: `meta.pagination = { total, page, perPage, totalPages }`; error: `{ error: { code, message, details? } }`. Built only via `ok`/`created`/`noContent`/`okPaginated`/`ApiError` from `server/shared/http/`. The envelope shape is the shared Zod contract `contracts/shared/api.schema.ts` (single source for FE + BE); the `server/shared/http/` builders infer their types from it directly (no parallel type declarations).

## Testing

No test runner is installed (no jest/vitest/mocha) — tests are plain TypeScript files run
directly with `npx tsx <path>`, asserting via `node:assert/strict`. They live under
`tests/server/`, not colocated with the source they cover; the subpath mirrors the module's path
under `server/` (e.g. `server/modules/orders/orders.transformer.ts` →
`tests/server/unit/modules/orders/orders.transformer.dry-test.ts`).

- `tests/server/unit/<mirrored-path>/<name>.dry-test.ts` — runtime tests (hand-rolled `test()`
  collector + `assert`, run via `npx tsx`). Reserve "integration" for a future test that hits a
  real external system (live Google Sheets); a test that only uses fakes/mocked `fetch` is still
  `unit`, not `integration`.
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

## Gotchas

- Don't add repository/query methods speculatively — `getByFilter` covers most ad-hoc reads.
- Don't widen `perPage` past its `.max()` — over-limit is 422, not a clamp.
- ISO `YYYY-MM-DD` strings compare correctly with `<=` — no Date parsing needed.
- Env vars are read when `get<M>Repository()` first initializes its module-scoped cache; today's simple modules happen to invoke that getter during module import (so the observable timing is unchanged for them), but the rule is about the getter's first call, not "module import" per se. Every backend module must use the shared Apps Script endpoint `APPSCRIPT_URL` plus module-specific sheet vars such as `CUSTOMERS_SPREADSHEET_ID` and `CUSTOMERS_SHEET_NAME`.

