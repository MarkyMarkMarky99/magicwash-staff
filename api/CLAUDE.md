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
export const fooApiSchemas = {
  listQuery: fooListQuerySchema, createRequest: fooCreateSchema, updateRequest: fooUpdateSchema,
  listResponse: fooListResponseSchema, detailResponse: fooDetailResponseSchema,
} as const

// server/modules/<m>/<m>-db.schema.ts — API ↔ DB contract (sheet column keys):
//   ⚠️ row key order = physical column order (1st key = column A); never reorder.
export const fooRowSchema = z.object({ FooID: z.string(), Name: z.string(), Notes: ..., ... })
// Payloads declared PER ACTION, not derived from the row. Omitted columns = DB fills on APPEND.
export const fooAppendPayloadSchema = z.object({ Name: z.string().min(1), Notes: z.string().nullable(), CreatedBy: z.string().min(1) })
export const fooUpdatePayloadSchema = z.object({ Name: z.string().optional(), Notes: ..., UpdatedBy: z.string().min(1) })
export const fooDbSchemas = {
  row: fooRowSchema, idColumn: 'FooID',
  appendPayload: fooAppendPayloadSchema, updatePayload: fooUpdatePayloadSchema,
} as const

// server/modules/<m>/<m>.module.ts — wiring only.
// Schema files export NO z.infer types — derive type aliases next to their consumer:
type FooRow = z.infer<typeof fooRowSchema>
type FooFilter = z.infer<typeof fooListQuerySchema>

const fooRepository = createGoogleSheetRepository<FooRow, FooFilter>({
  sheet: { sheetName: 'Foos', spreadsheetIdEnv: '...', scriptUrlEnv: '...' },
  db: fooDbSchemas,
  clauses: (clause, columns) => [
    clause.eq('status', 'Status'),   // also: contains / dateRange
    (filter) => null,                // cross-field logic: plain fn
  ],
})

export const fooService = createSheetService({
  resourceName: 'Foo',
  repository: fooRepository,
  api: fooApiSchemas,
  db: fooDbSchemas,
  // hooks: { create: { before }, update: { before, after }, ... } — optional
})
```

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
- **What may live in `contracts/`:** the per-feature camelCase request/response schemas + enums, and the generic request/response envelope (`contracts/shared/api.schema.ts`) — pure Zod, no type exports. **Never in `contracts/`:** DB row/payload schemas, repository types, the serverless **handler runtime object** (`ApiHandlerRequest` + raw query — co-located in `server/shared/http/api-handler.ts`), or business services — and a `contracts/` file must never import from `server/` or `api/`.

### Key Engine Rules

- **Repository is a contract:** services depend on `ResourceRepository<TRow, TFilter>` (`findById`/`findByFilter`/`append`/`update`). `createGoogleSheetRepository` is its one implementation and owns all transport detail — column letters, GViz query strings, Apps Script payloads, env wiring. Another storage backend implements the same interface and keeps the generic service.
- **Naming convention is load-bearing:** sheet headers PascalCase with uppercase `ID` suffix ↔ camelCase API twins (`PickupOrderID` ↔ `pickupOrderId`). Projection, payload building, and sort resolution all pair through `server/shared/sheet-crud/sheet-naming.ts`. A sheet that breaks the convention needs an engine extension, not a workaround.
- **Two contracts, machine-checked:** compile errors catch all drift — payload column missing from row or wrong cell type; payload column the request can't fill; request field landing in no payload column (silently dropped); response field with no backing column or a type the cell can't guarantee (nullability must be honest); a `sortBy` value that is no column's camelCase twin.
- **Cell values are NEVER runtime-validated** — legacy data is dirty by decision; dirty rows must flow through reads AND write responses without 500. Response schemas constrain at compile time only. Built write payloads ARE runtime-validated by their action schema, including hook output (violation = 500 config bug, not client error).
- **doPost contract:** APPEND/UPDATE must return the full stored row in `data`; service checks every `db.row` column is present (keys only, values unvalidated), else 500. UPDATE is PATCH — only defined fields sent; id is passed to the repository separately and pinned last in the doPost body (route id wins).
- **Audit columns** (`CreatedAt`/`UpdatedAt`/`CreatedBy`/`UpdatedBy`) appear in no response schema. The actor (`createdBy`/`updatedBy`) is client input.
- **Hooks:** one `before` + one `after` per method, business logic only (presentation stays in frontend mappers). Needing more = module outgrew the engine — give it its own service.

## Singletons, not classes

Repositories and services are module-level object literals (`export const fooService = { ... }`), not classes. Node's module cache makes them true singletons. `sheet-crud` factories run at module scope — env vars read once at first import (safe: `tsc` doesn't execute modules; Vercel cold start has env). No per-module factory files; wiring is through imports; the only factories are the generic ones in `server/shared/sheet-crud/`. Exception: `server/shared/` clients (`GVizClient`, `AppScriptClient`, `BaseSheetRepository`) stay classes — instantiated per feature with different config.

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
- Env vars (e.g. `APPOINTMENTS_SPREADSHEET_ID`, `APPSCRIPT_APPOINTMENT_URL`, `APPOINTMENTS_SHEET_NAME`) are read once at module import; missing ones throw with the variable name.
