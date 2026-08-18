# CLAUDE.md - Vercel Serverless API

Serverless backend for the Vue webapp. Data lives in Google Sheets — reads use GViz
(unauthenticated) and writes use the authenticated Google Sheets API. There is one
write transport, not two: the Apps Script/SheetLib `doPost` write path was removed
from every sheet. The only Apps Script URL left is `APPSCRIPT_INVOICE_VIEW_SYNC_URL`,
which recomputes InvoicesView after a write — it is not a row-write path.

## Tech Stack

- TypeScript (strict), Vercel serverless — no HTTP framework, file-based routing
- Zod v3 — runtime validation and type inference
- Google Sheets — GViz reads; writes via the Google Sheets API (one transport,
  no SheetLib path remains)
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
}) // key order = physical column order; never reorder: deriveGVizColumns maps by index

export const fooDbContract = {
  row: fooRowSchema,
  primaryKey: 'FooID', // physical DB column, not the API field name
  sheetName: 'Foos',
  spreadsheetId: 'FOOS_SPREADSHEET_ID',
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
- **No sheet barrel:** `server/sheets/` has no `index.ts`, registry object, or re-export hub. Every consumer deep-imports the single repository getter it needs, so a cold start never constructs an unrelated sheet's repository or demands its environment variables.
- **SheetRepository is DB-only:** it owns GViz queries, column-letter derivation, and Google Sheets API write transport using DB column names. The entire `server/sheets/` tree imports neither `contracts/` nor `server/modules/`; repositories do not import or understand an API contract.
- **Module mapping is load-bearing:** each DB-shaped service declares `fieldMap` (DB column → API field) and, when needed, `jsonColumns` on `BaseCrudService`. Mapping applies to queries, payloads, and response rows; JSON decoding applies only to the listed text columns.
- **Primary keys are physical:** `SheetContract.primaryKey` is the real DB column name. The service maps the API id to that column before the repository reads, updates, or deletes.
- **Type import direction:** feature API schemas in `contracts/` do not import from `server/`, and API contracts never depend on DB shapes. `ModuleApiContract` is the shared API-side structural type.
- **What may live in `contracts/`:** per-feature camelCase request/response schemas and enums, the generic request/response envelope (`contracts/shared/api.schema.ts`), and the API contract-shape types (`contracts/shared/module-api-contract.ts`). Never put DB row schemas, repository types, sheet contracts, services, or handler runtime objects there.
- Use a dedicated service and explicit route only for genuinely complex flows
  (multi-sheet writes, joins, or nonstandard result states); document why.
- A single-sheet module may use a `BaseCrudService` instance directly as its
  service, with no named class required. Give a module a named service class
  only when its workflow spans multiple sheets; for example, invoices uses
  an `InvoiceService` that orchestrates its sheet repositories.

### Key Engine Rules

- **Repository contract:** `BaseCrudService` can consume a DB-shaped `SheetRepositoryContract`; `SheetRepository` implements it with GViz reads and Google Sheets API writes. Storage and transport details stay in the repository; API mapping stays in the module service.
- **Read pipeline:** `BaseCrudService` validates `api.query.list`, builds `ReadQueryDTO.fromQuery(query, searchFields)` (keyword→search; page/perPage/sort reserved; every other field→`where`), maps API fields to DB fields, and calls the sheet repository. `getById` and `update` address the service id through the physical `primaryKey`.
- Add a custom query path only for different semantics, with tests.
- **Row schema key order is load-bearing for reads:** `deriveGVizColumns` (`server/shared/utils/gviz-query.builder.ts`) maps a schema key to its GViz column by index, so swapping two keys makes every read silently pull the wrong column. Reordering is never cosmetic.
- **Contracts are machine-checked:** API bundles use `satisfies ModuleApiContract`, sheet bundles use `satisfies SheetContract`, and field maps use `satisfies Record<keyof row & string, string>`. Runtime tests must pin field-map values because `satisfies` checks keys and types, not semantic string values.
- **Cell values are not runtime-validated on reads:** legacy dirty rows must flow through reads and write responses without 500. Response schemas drive projection through their `.shape` key set. A GViz column that resolves to no DB field throws because that is contract drift, not dirty data.
- **Never send `null` for a column you are not writing — send `''`:** the Values API skips `null`, which shifts every later column one cell to the left. Append always builds an array the full width of the header map, padding unsent fields with `''`.
- **`SheetContract.valueInput` is a guard, not the wire value:** the write path always sends `USER_ENTERED` for the whole request; `resolveValueInputOption` exists only to reject a column that declares anything else, so a value can never silently fall back to `RAW`. A column that declares no `valueInput` still goes out as `USER_ENTERED`. Adding a column to `valueInput` therefore fixes no wire-level bug — this has already produced one wrong diagnosis.
- **`USER_ENTERED` cuts both ways:** `Appointments.AppointmentDate` is deliberately stored as a real Sheets date so GViz date functions can filter it — `RAW` would make it text and break the filter instantly. The opposite risk is equally real: a phone number starting `0` loses its zero, and a value starting `=`/`+`/`-` becomes a formula. That is what per-column `valueInput` declarations exist to flag.
- **Sheets API contract:** UPDATE looks up the row's line number by primary key (`findRowNumberByKey`, an accepted lookup-to-write race — see that file's doc comment), patches only the changed columns via `values:batchUpdate` under `USER_ENTERED`, then reads the row back and verifies its primary key still matches before returning it. `WriteRejectedError`/`WriteTransportError`/`WriteCommittedUnreadableError`/`DuplicateRowKeyError`/`WriteRowIdentityMismatchError` classify every write outcome into a `rejected`/`unknown` certainty taxonomy. A confirmed write with an unusable response shape (`WriteCommittedUnreadableError`) is a transport-unknown outcome and must not be classified as a rejection, because retrying could duplicate persisted rows. Never auto-retry a write that was already sent: 429/401 are observable only after the request goes out, so a retry risks duplicate rows; retry is allowed for token acquisition only.
- APPEND and batch APPEND write whole rows.
- A sheet declares what it may do in `writes`; a capability left false is refused before any request is built.
- **Which write path a sheet uses:** every sheet uses the Google Sheets API — `SheetContract` has no `writeTransport`/`scriptUrl` field. Any operation a sheet's `writes` flags leave enabled must have a Sheets API implementation; there is no SheetLib fallback to catch it.
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

- Define public Zod contracts first in `contracts/`: camelCase request,
  response, enum, and query shapes shared with the frontend.
- Service entry points call `parseOrThrow(schema, raw)` → 422 with flattened issues. Never cast with `as` in module code.
- Do not replace validation with `as` casts or duplicate it privately.
- List queries validated by Zod (`z.coerce` for numbers, `.default()` for optionals, `.refine` for cross-field) → bad input 422.
- Define `z.enum` exclusively in the feature schema file. Derive input types with `z.input<typeof schema>`; never hand-write mirroring interfaces.

## Response Contract

Success: `{ data, meta }`; paginated: `meta.pagination = { total, page, perPage, totalPages }`; error: `{ error: { code, message, details? } }`. Built only via `ok`/`created`/`okPaged`/`ApiError` from `server/shared/http/`. The envelope shape is the shared Zod contract `contracts/shared/api.schema.ts` (single source for FE + BE); the `server/shared/http/` builders infer their types from it directly (no parallel type declarations).

- Multi-step writes must distinguish safe retries from partial persistence.

## Comments in Source Code

A comment sits closer to the code than any document, so when the two disagree the comment wins —
including for the next agent reading it. A stale comment is therefore not clutter, it is a false
instruction. This has already caused a reviewer to certify a real bug as safe, on the strength of a
comment describing a runtime check that did not exist.

The fix is not "write fewer comments", it is "never write a comment that expires".

**Never put project status in source code.** These all have an expiry date and nothing enforces it:

- Phase or plan numbers — `§2.9`, "belongs to Phase 2", "the §2.6 flow". Plan numbering moves on;
  the code does not follow it. Describe the behaviour, not the ticket that introduced it.
- Wiring status — "not wired in yet", "no caller yet", "still a building block".
- Tense that points at a plan — "will introduce", "must be handled in the next phase",
  "today this still goes through X".

Status belongs in `docs/phase-*.md`, which is maintained as a whole. In source, it rots in place.

**Do write the comment that stops the next change from being wrong.** These do not expire, because
they describe intent rather than state:

- A decision plus its prohibition — "this lookup-then-write race is accepted; do not add a lock,
  CAS, or retry", "a duplicate key must never be retried".
- A non-obvious invariant a reader would otherwise break — "this field declares intent and acts as
  a guard; it is not the value sent on the wire".
- Why something is deliberately absent, where its absence looks like an oversight.

**Do not restate what other files do.** A comment describing another module's behaviour goes stale
the moment that module changes, and nothing links the two. Point at the file and let it speak.

**Prefer a guard over a comment for anything that matters.** A comment cannot fail; a dry test can.
`tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` is the model — it enforces a rule by
discovering every contract itself, so a sheet added later is covered without anyone remembering.
If a rule is important enough to comment, ask whether it is important enough to assert.

**When you change behaviour, hunt the comments that describe it in the same commit.** A behaviour
change that leaves its old description standing has created the exact failure above.

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
- Run the relevant dry tests and `npm run typecheck:api` for every backend change.
- Run `npm run build` when a frontend-facing contract changes, then `git diff --check`.
- Contract parity check before deploying a contract change:
  `node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts`
- Final diff check: `git diff --check`
- **A green typecheck plus dry-tests does not prove behaviour.** Swapped schema key order stays
  type-correct; a transformer tested as a standalone function is not tested as wired into its
  service. Worse, fixtures have been edited to match the code instead of the sheet — a
  characterization test that pins a bug as correct is worse than no test. Run
  `tests/server/integration/sheet-column-parity.ts` against the live sheets before deploying a
  contract change; it verifies contracts against live sheet headers, not the route registry, and
  is the only check that catches this class.

## Gotchas

- Don't add repository/query methods speculatively — the existing read/query pipeline covers most ad-hoc reads.
- Don't widen `perPage` past its `.max()` — over-limit is 422, not a clamp.
- GViz date strings are returned raw; do not parse or format them in the backend. ISO `YYYY-MM-DD` strings compare correctly with `<=` when a service needs a date range.
- "One write transport, not two" above covers server-side sheet *row* writes only (append/update through the Sheets API). It does not cover two other Apps Script call sites that still exist: `invoice-view-sync-client.ts` POSTs to Apps Script to recompute `InvoicesView` after an invoice write, and the browser frontend's photo upload (`src/api/photos.js`) POSTs directly to Apps Script, bypassing the API. Neither writes sheet rows through SheetLib, but neither is "one transport" either.
- Do not turn dirty legacy cells into 500 responses. DELETE is unsupported: the repository throws rather than pretending to delete, because a delete that reports success without deleting is data loss disguised as a pass. Design and verify its semantics before implementing it.
- Server environment variables never use the `VITE_*` prefix.
- **The Appointments workbook locale is `en_US`.** A timestamp not written as `yyyy-MM-dd HH:mm:ss` either stays text or parses with day and month transposed; 373 cells had to be repaired because of this. `SheetRepository` rejects a caller-supplied audit timestamp that does not match that format — keep it that way.
- **Only three workbooks have service-account Editor access:** `1tfgJvj` (OrderForm), `1CvVl6a` (Appointments), `1zfhguJ` (Invoices/InvoiceItems). The portal workbook `1ucqeUq` is GViz-read + Apps-Script-written only and must never be granted write access or bound to a writable contract — `tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` enforces this by walking every contract rather than listing sheet names.
- **The Python project at the repo root has its own `ORDERS_SPREADSHEET_ID` pointing at a different workbook.** Don't touch it, and don't assume a same-named variable means the same spreadsheet.
- **`G:\My Drive\Magicwash\Database\GoogleSheets\*.json` is read-only.** It is the schema registry shared with that Python project. When registry and code disagree, change the code or report it — never edit the registry to match, because "make them match" always has two solutions and the wrong one rewrites the business's source of truth. The registry can also be stale: the sheet is the truth (`Appointment.json` once declared 15 columns against a live sheet of 17, and believing it took production down).
- Environment variables are read when each `get<Sheet>Repository()` first initializes its module-scoped cache. A repository needs its workbook id (`CUSTOMERS_SPREADSHEET_ID`, `ORDERS_SPREADSHEET_ID`, …) and, for a sheet it writes, the service-account credentials in `GOOGLE_SERVICE_ACCOUNT_KEY`. There is no shared Apps Script endpoint any more: writes go through the Sheets API, and `APPSCRIPT_INVOICE_VIEW_SYNC_URL` is the only Apps Script URL left — it recomputes InvoicesView and is not a sheet-row write.

## Known Environment Issue: Windows Sandbox Process Spawn Flake

Shell/exec commands in this environment intermittently fail with:

```
windows sandbox: runner failed during SpawnChild: CreateProcessAsUserW failed: 1312
(A specified logon session does not exist. It may already have been terminated.)
```

This is a known intermittent crash in the Windows sandbox runner, unrelated to the command or
code being run — it is not a signal that the command or code being run is wrong. It has
recurred across plain shell commands and across coder/tester/reviewer sessions alike.

When it appears:

- Retry the exact same command once.
- If the retry also fails the same way, report it as an infrastructure blocker, separate from any
  finding about the work under test — do not reinterpret it as a code or test failure.
- Do not change sandbox settings, escalate privileges, or fall back to a bypass to work around it.
