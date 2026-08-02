# AGENTS.md - Magic Wash Backend

## Overview

TypeScript Vercel serverless API for the Vue portal. Google Sheets is the data
store: GViz reads data and Apps Script/SheetLib performs writes.

## Tech Stack

- TypeScript (strict) + Vercel serverless functions
- Zod v3 for shared API contracts and request validation
- Google Sheets: GViz reads and Apps Script/SheetLib writes
- Native `fetch`; plain TypeScript dry tests with `node:assert/strict`

## Project Structure

- `api/[...path].ts` - Single Vercel entry point.
- `server/api/` - Lazy module route registry.
- `server/modules/<module>/` - Feature contracts, repositories, services, queries, and route wiring.
- `server/shared/http/` - Gateway, handlers, validation, response helpers, and generic CRUD routes.
- `server/shared/repositories/` - Storage abstractions and Google Sheet transport.
- `server/shared/services/` - Shared storage-agnostic services, including `BaseCrudService`.
- `contracts/<feature>/` - Shared camelCase Zod request/response schemas and enums.
- `tests/server/` - Runtime dry tests and type tests, mirroring `server/` paths.

## Commands

- API typecheck: `npm run typecheck:api`
- Backend dry test: `npx tsx tests/server/<path>/<name>.dry-test.ts`
- Web build after contract changes: `npm run build`
- Final diff check: `git diff --check`

## Architecture Rules

- Use `routes -> service -> repository -> queries`. Routes translate HTTP;
  services own business decisions; repositories own storage and transport.
- Use `ModuleContract` + `GSheetRepository` + `BaseCrudService` +
  `createCrudRoutes` for normal single-sheet CRUD. Do not hand-write CRUD handlers.
- Use a dedicated service and explicit route only for genuinely complex flows
  (multi-sheet writes, joins, or nonstandard result states); document why.
- Every module owns a named service. Do not use `BaseCrudService` as a module's
  service when its workflow spans multiple sheets; for example, invoices uses
  an `InvoiceService` that orchestrates its own repositories.
- Construct each repository only in its `<module>.repository.ts` behind a lazy
  memoized getter. One module has one repository file; it exports one
  `GSheetRepository` getter per sheet it owns. For example, `invoice.repository.ts`
  owns the Invoice, InvoiceItem, Payment, and InvoicesView repositories.
- One physical sheet equals one `GSheetRepository` and one `ModuleDbContract`.
  Do not combine row schemas, field maps, primary keys, or write capabilities
  for multiple sheets into one repository or DB contract.
- Repositories never import another module's repository or module; cross-module
  workflows belong in a service.
- Keep the single `api/[...path].ts` function. Registry imports must be literal
  lazy imports, and every backend relative import/export must end in `.js`.

## Contracts and Validation

- Define public Zod contracts first in `contracts/`: camelCase request,
  response, enum, and query shapes shared with the frontend.
- Keep Sheet rows, physical column order, write payloads, `fieldMap`, and keys
  in the module's backend contract. Never expose DB row shapes to the frontend.
- Validate all untrusted HTTP input with `parseOrThrow` at a public service
  boundary. Do not replace validation with `as` casts or duplicate it privately.
- Use `ReadQueryDTO` for normal list filters, sorting, pagination, and id lookup.
  Add a custom query path only for different semantics, with tests.
- Use shared HTTP response helpers. Multi-step writes must distinguish safe
  retries from partial persistence.

## Google Sheets Rules

- `GSheetRepository` alone owns GViz, SheetLib/App Script writes, and column mapping.
- Every write has an explicit SheetLib target; UPDATE is a PATCH.
- Portal views are Apps Script-owned read models. Transformers may decode JSON
  cells and GViz dates only; fix wrong business data at its source.
- Do not turn dirty legacy cells into 500 responses. DELETE remains unsupported
  until its SheetLib/App Script semantics are designed and verified.
- Server environment variables never use the `VITE_*` prefix.

## Refactor Workflow

- Inspect the module, registry, API contract, sheet columns, and tests first.
- Migrate one vertical slice: contract -> repository -> service -> routes -> registry -> tests.
- Preserve behavior unless the new outcome is explicitly designed and tested.
- Remove legacy code only after no imports or route references remain.

## Testing

- Put dry tests under `tests/server/`, mirroring the relevant `server/` path.
- Run the relevant dry tests and `npm run typecheck:api` for every backend change.
- Run `npm run build` when a frontend-facing contract changes, then `git diff --check`.

## Reference

Read `api/CLAUDE.md` for detailed module skeletons, contract shapes, and edge cases.
