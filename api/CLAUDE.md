# CLAUDE.md - Vercel Serverless API

Serverless backend for the Vue webapp. Data lives in Google Sheets — reads go through GViz (unauthenticated), writes go through a Google Apps Script `doPost` endpoint (HTTP POST).

## Tech Stack
- TypeScript (strict), Vercel serverless functions — no HTTP framework, file-based routing
- Zod v3 for runtime validation and type inference
- Google Sheets as data store — GViz for reads, Apps Script for writes
- Native `fetch` for outbound HTTP

## Architecture

### Project Structure

⚠️ **Vercel function budget:** zero-config Vercel turns EVERY `.ts`/`.js` file
under `api/` into its own serverless function; the Hobby plan caps a deployment
at **12**. So `api/` holds **route files only** — all helper code lives OUTSIDE
`api/` and is bundled into the routes that import it (not counted). Root
Directory = `webapp-vue`, so `server/`, `contracts/`, `src/` are all in the build context.

- `api/<feature>/` - Vercel route files only — `index.ts` (list/create) and
  `[id].ts` (get/update). These ARE the serverless functions; one line per
  method. (Legacy `customers.js` / `gviz.js` / `write.js` are also routes.)
- `contracts/<feature>/<m>-api.schema.ts` - the FE↔BE API contract (camelCase
  request/response schemas + enums), **shared**: imported by backend AND frontend
  (`@contracts/*`). Only this crosses to the frontend (see Type import direction).
- `server/modules/<module>/` - business logic per feature (db contract + module
  wiring; complex modules keep their layered folders)
- `server/shared/` - cross-feature infrastructure (http, google-sheets, sheet-crud, repositories, types, utils)
- `server/gviz/` - legacy GViz proxy (`gviz-utils.js`) + per-sheet column maps (`schemas/*.js`), imported by the `.js` routes
- Backend imports are RELATIVE (`../../server/...`, `../../../contracts/...`) — no
  tsconfig path alias, so `@vercel/node`/esbuild resolves them zero-config. The
  `@contracts/*` alias is for the FRONTEND (Vite) only.

### Module Structure (`server/modules/<module>/`)

**Simple modules** (one sheet, CRUD + filters — e.g. appointments) are a
`<m>-db.schema.ts` + a `<m>.module.ts` that is wiring only (both in
`server/modules/<m>/`); the matching `<m>-api.schema.ts` lives in
`contracts/<m>/` (shared with the frontend). Skeleton for a new module:

```ts
// contracts/<m>/<m>-api.schema.ts — the API ↔ frontend contract (all camelCase), shared with FE:
//   request/query schemas, response schemas, and the API-facing enums.
export const fooCreateSchema = z.object({ name: z.string().min(1), createdBy: z.string().min(1), ... })
export const fooUpdateSchema = z.object({ name: z.string().optional(), updatedBy: z.string().min(1) }).refine(...)
export const fooListQuerySchema = z.object({ keyword: ..., page: ..., sortBy: ..., ... })
// Response schemas DRIVE projection: their fields (camelCase twins of row
// columns, key order = DTO key order) decide what each DTO exposes.
export const fooListResponseSchema = z.object({ fooId: z.string(), name: z.string() })
export const fooDetailResponseSchema = fooListResponseSchema.extend({ notes: z.string().nullable() })
export const fooApiSchemas = {
  listQuery: fooListQuerySchema, createRequest: fooCreateSchema, updateRequest: fooUpdateSchema,
  listResponse: fooListResponseSchema, detailResponse: fooDetailResponseSchema,
} as const

// server/modules/<m>/<m>-db.schema.ts — the API ↔ database contract (sheet column keys):
//   ⚠️ row key order = physical column order (1st key = column A); never reorder.
export const fooRowSchema = z.object({ FooID: z.string(), Name: z.string(), Notes: ..., ... })
// Write payloads are declared PER ACTION, not derived from the row: a row
// column type says what may sit in the cell (legacy mess included); an action
// schema says what that action must send (e.g. CreatedBy nullable in storage
// but required on APPEND). Omitted columns = DB fills on APPEND.
export const fooAppendPayloadSchema = z.object({ Name: z.string().min(1), Notes: z.string().nullable(), CreatedBy: z.string().min(1) })
export const fooUpdatePayloadSchema = z.object({ Name: z.string().optional(), Notes: ..., UpdatedBy: z.string().min(1) })
export const fooDbSchemas = {
  row: fooRowSchema, idColumn: 'FooID',
  appendPayload: fooAppendPayloadSchema, updatePayload: fooUpdatePayloadSchema,
} as const

// <m>.module.ts — wiring only. Schema files export NO z.infer types — derive
// type aliases here (or wherever they are consumed), next to their one user:
type FooRow = z.infer<typeof fooRowSchema>
type FooFilter = z.infer<typeof fooListQuerySchema>

const fooRepository = createGoogleSheetRepository<FooRow, FooFilter>({
  sheet: { sheetName: 'Foos', spreadsheetIdEnv: '...', scriptUrlEnv: '...' },
  db: fooDbSchemas,                                   // uses row (letters) + idColumn
  clauses: (clause, columns) => [
    clause.eq('status', 'Status'),                    // also contains / dateRange
    (filter) => null,                                 // cross-field logic: plain fn
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

- **Repository is a contract, not GViz**: services depend on
  `ResourceRepository<TRow, TFilter>` (`findById` / `findByFilter` / `append` /
  `update`); `createGoogleSheetRepository` is its one implementation and owns
  ALL transport detail — column letters, GViz query strings, Apps Script
  payloads, env wiring. A module needing another storage or custom queries
  implements the same interface and keeps the generic service.
- **Naming convention is load-bearing**: sheet headers are PascalCase with
  uppercase `ID` suffix; API fields are the camelCase twins
  (`PickupOrderID` ↔ `pickupOrderId`). Projection, payload building, and sort
  resolution all pair the two contracts through it
  (`server/shared/sheet-crud/sheet-naming.ts`). A sheet that breaks the convention
  needs an engine extension, not a workaround.
- **Two contracts, machine-checked**: the api and db bundles are independent
  declarations; everything that could drift between them (or against the row)
  is a compile error on the config site — a payload column missing from the
  row or with a type the cell can't store; a payload column the request can't
  fill; a request field landing in no payload column (silently dropped); a
  response field with no backing column or claiming a type the cell can't
  guarantee (nullability must be honest); a sortBy value that is no column's
  camelCase twin.
- **Cell values are NEVER runtime-validated** — legacy sheet data is dirty by
  decision, so dirty rows must flow through reads AND write responses, not
  500. Response schemas constrain the contract at compile time only; built
  write payloads ARE runtime-validated by their action schema — including
  hook output (a violation is a 500 config bug, not client error).
- **doPost contract**: APPEND/UPDATE must respond with the full stored row in
  `data`; the service checks it has every `db.row` column (keys only, values
  unvalidated) and answers 500 otherwise. Update is PATCH — only defined
  fields are sent; the id is passed to the repository separately and pinned
  last in the doPost body (route id wins).
- Audit columns (`CreatedAt`/`UpdatedAt`/`CreatedBy`/`UpdatedBy`) go in neither
  response schema. The actor (`createdBy`/`updatedBy`) is client input.
- **Hooks discipline**: one `before` + one `after` per method, business logic
  only (presentation stays in frontend mappers); needing more means the module
  has outgrown the engine — give it its own service.
- Route files stay one-liners calling `list` / `getById` / `create` / `update`.

**Complex modules** (multi-sheet reads, 1:n assembly, business rules beyond
CRUD+filter — e.g. invoices) keep dedicated layers, composing the underlying
pieces (`BaseSheetRepository`, `createClauseBuilders`, `createSheetQuery`,
naming utils — exported from `server/shared/sheet-crud/` and `server/shared/repositories/`)
where useful:

- `types/` - Declaration layer (schemas, shapes, enums, DTOs)
- `queries/` - Query builders
- `repositories/` - Data access layer
- `mappers/` - Data transform layer
- `services/` - Business layer

### Architecture Rules

- Route files stay one line per method — no logic in routes
- Dependency direction: `routes → service → repository → queries`
- Type import direction: `server/modules/<m>/<m>-db.schema.ts (DB) →
  contracts/<m>/<m>-api.schema.ts (API)` (DB contract may reuse API enums; never
  the reverse). The API contract is SHARED with the frontend (`@contracts/*`);
  the DB contract is not. **May live in `contracts/`:** only API-facing camelCase
  request/response schemas + enums. **Never in `contracts/`:** DB row/payload
  schemas, repository types, the handler envelope
  (`server/shared/types/api-request|response.types`), or business services — and
  a `contracts/` file must never import from `server/` or `api/`.
- `types/` holds static declarations only — if data flows through a file, it belongs in `queries/` or `mappers/`

## Singletons, not classes
- Repositories and services are **module-level object literals**
  (`export const appointmentService = { ... }`), not classes. Node's module cache
  makes them true singletons — no constructor to misuse, no `this` binding.
- All `sheet-crud` factories run at module scope, so env vars are read once at
  first import (safe: `tsc` doesn't execute modules; Vercel cold start has env).
- No per-module factory files. Wiring happens through imports; the only factories
  are the generic ones in `server/shared/sheet-crud/`.
- `server/shared/` clients (`GVizClient`, `AppScriptClient`, `BaseSheetRepository`)
  stay classes — they're instantiated per feature with different config.

### Validation (Strict by Contract)
- **Parsing:** Service entry points call `parseOrThrow(schema, raw)`. Yields 422 with flattened issues on violation. Never cast using `as`.
- **List Queries:** Validated by Zod (`z.coerce` for numbers, `.default()` for optionals, `.refine` for cross-field rules). Bad inputs yield 422.
- **Enums & Types:** Define `z.enum` exclusively in the feature schema file. Derive input types using `z.input<typeof schema>`. Never hand-write mirroring interfaces.

## Response contract
- Success: `{ data, meta }`; paginated: `meta.pagination = { total, page, perPage, totalPages }`;
  error: `{ error: { code, message, details? } }` — built only via `ok` / `created` /
  `noContent` / `okPaginated` / `ApiError` from `server/shared/http/`.

## Gotchas
- Don't add repository/query methods speculatively — expose exactly what the
  service calls today (`getByFilter` covers most ad-hoc reads).
- The "never cast with `as`" rule applies to module code. Inside
  `server/shared/sheet-crud/` factories, commented casts that only erase generics are
  allowed — the config mapped types already verified every field↔column pairing.
- Don't widen `perPage` past its `.max()` — over-limit is a 422, not a clamp.
- ISO `YYYY-MM-DD` strings compare correctly with `<=` — no Date parsing needed.
- Env vars (`APPOINTMENTS_SPREADSHEET_ID`, `APPSCRIPT_APPOINTMENT_URL`,
  `APPOINTMENTS_SHEET_NAME`) are read once at module import; missing ones throw
  with the variable name.
