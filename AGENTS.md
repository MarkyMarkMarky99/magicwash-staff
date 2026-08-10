# AGENTS.md - Magic Wash Backend

## Overview

TypeScript Vercel serverless API for the Vue portal. Google Sheets is the data
store: GViz reads data. Writes are migrating sheet-by-sheet from Apps
Script/SheetLib to the Google Sheets API (opt-in per sheet via
`SheetContract.writeTransport`); most sheets still write through SheetLib
today, see Google Sheets Rules below for the current split.

## Tech Stack

- TypeScript (strict) + Vercel serverless functions
- Zod v3 for shared API contracts and request validation
- Google Sheets: GViz reads; writes via Apps Script/SheetLib or, per sheet
  opt-in, the Google Sheets API (`SheetContract.writeTransport`)
- Native `fetch`; plain TypeScript dry tests with `node:assert/strict`

## Project Structure

- `api/[...path].ts` - Single Vercel entry point.
- `server/api/` - Lazy module route registry.
- `server/modules/<module>/` - Feature API contracts, services, queries, mapping, and route wiring.
- `server/sheets/<Sheet>/` - One DB contract and one repository per physical sheet. The
  repository is constructed only by its lazy memoized getter.
- `server/shared/http/` - Gateway, handlers, validation, response helpers, and generic CRUD routes.
- `server/shared/repositories/` - Storage abstractions and Google Sheet transport.
- `server/shared/services/` - Shared storage-agnostic services, including `BaseCrudService`.
- `contracts/<feature>/` - Shared camelCase Zod request/response schemas and enums.
- `tests/server/` - Runtime dry tests and type tests, mirroring `server/` paths.

## Commands

- API typecheck: `npm run typecheck:api`
- Backend dry test: `npx tsx tests/server/<path>/<name>.dry-test.ts`
- Web build after contract changes: `npm run build`
- Contract parity check before deploying a contract change:
  `node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts`
- Final diff check: `git diff --check`

## Architecture Rules

- Use `routes -> service -> repository -> queries`. Routes translate HTTP;
  services own business decisions; repositories own storage and transport.
- Use `SheetContract` + `SheetRepository` + `BaseCrudService` +
  `createCrudRoutes` for normal single-sheet CRUD. Do not hand-write CRUD handlers.
- Use a dedicated service and explicit route only for genuinely complex flows
  (multi-sheet writes, joins, or nonstandard result states); document why.
- Every module owns a named service. Do not use `BaseCrudService` as a module's
  service when its workflow spans multiple sheets; for example, invoices uses
  an `InvoiceService` that orchestrates its sheet repositories.
- Construct each repository only in `server/sheets/<Sheet>/<Sheet>.repository.ts`,
  behind a lazy memoized getter. One physical sheet has one `SheetContract` and one
  `SheetRepository`; the getter is the only construction site.
- `SheetContract` and `SheetRepository` use physical DB column names and know nothing
  about API contracts. The owning module declares its DB-to-API `fieldMap` and
  `jsonColumns` on `BaseCrudService`.
- `primaryKey` is the real physical DB column name. It is not an API/domain field name.
- Cross-sheet workflows belong in a module service, which may obtain the relevant
  sheet repositories through their getters.
- Keep the single `api/[...path].ts` function. Registry imports must be literal
  lazy imports, and every backend relative import/export must end in `.js`.

## Contracts and Validation

- Define public Zod contracts first in `contracts/`: camelCase request,
  response, enum, and query shapes shared with the frontend.
- Keep sheet rows, physical column order, write payloads, and primary keys in the
  owning sheet contract. Keep API fields in `contracts/`; never expose DB row shapes
  to the frontend.
- Validate all untrusted HTTP input with `parseOrThrow` at a public service
  boundary. Do not replace validation with `as` casts or duplicate it privately.
- Use `ReadQueryDTO` for normal list filters, sorting, pagination, and id lookup.
  Add a custom query path only for different semantics, with tests.
- Use shared HTTP response helpers. Multi-step writes must distinguish safe
  retries from partial persistence.

## Google Sheets Rules

- `SheetRepository` owns GViz reads and writes via either SheetLib/App Script or
  the Google Sheets API, chosen per sheet by `SheetContract.writeTransport`
  (`'sheetlib'` default, or `'sheets-api'` opt-in). It maps no API fields;
  `BaseCrudService` owns the module's DB-to-API mapping and declared JSON cell
  decoding.
- SheetLib sheets: every write has an explicit SheetLib target; UPDATE is a PATCH.
  Sheets-API sheets: UPDATE looks up the row by primary key, then patches only the
  changed columns (see `sheet-row-lookup.ts` for the accepted lookup-to-write race).
  As of 2026-08-10 only `OrderForm.update()` uses the Sheets API transport; every
  other sheet still writes through SheetLib. OrderForm's own append/delete are
  disabled (`writes: {append:false, delete:false}`), not routed to SheetLib —
  its `scriptUrl` is unset.
- Portal views are Apps Script-owned read models. Decode their JSON text columns only
  through the owning module's `jsonColumns`; fix wrong business data at its source.
- The backend returns GViz's raw date form. Date formatting belongs in the frontend.
- Do not turn dirty legacy cells into 500 responses. DELETE remains unsupported
  until its SheetLib/App Script semantics are designed and verified.
- Server environment variables never use the `VITE_*` prefix.

## Testing

- Put dry tests under `tests/server/`, mirroring the relevant `server/` path.
- Run the relevant dry tests and `npm run typecheck:api` for every backend change.
- Run `npm run build` when a frontend-facing contract changes, then `git diff --check`.
- Run `tests/server/integration/sheet-column-parity.ts` against the live sheets before
  deploying a contract change; parity is checked against the live sheet, not the
  route registry.

## Reference

Read `api/CLAUDE.md` for detailed module skeletons, contract shapes, and edge cases.
