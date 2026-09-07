---
last_audited: 2026-09-07
audit_sources:
  - api/[...path].ts
  - server/api/route-registry.ts
  - server/shared/http
  - server/shared/repositories
  - contracts/shared/api.schema.ts
---

# Backend Operations and API Conventions

## Runtime and imports

Vercel treats every JavaScript or TypeScript file under `api/` as a serverless function. Keep the
single gateway at `api/[...path].ts`; gateway, registry, modules, and helpers live outside `api/`.

Backend code has no path aliases. Every relative import or export specifier, including dynamic
imports in `server/api/route-registry.ts`, uses an explicit `.js` extension. Type checking and
`vercel dev` do not reliably detect a missing extension under the native ESM production runtime;
run a real Vercel build or deployment before accepting a change that affects backend module imports.

## Contracts and validation

- Feature API schemas and enums live in `contracts/<feature>/`; they satisfy
  `ModuleApiContract`. Shared response envelope schemas, error codes, and pagination metadata live
  in `contracts/shared/api.schema.ts`.
- API contracts are camelCase and never import database shapes. Database schemas, repository types,
  services, and handlers never live in `contracts/`.
- Validate every public service boundary with `parseOrThrow`; invalid input returns HTTP 422. Use
  Zod coercion, defaults, and refinements in the public schema rather than casts or duplicated
  private validation. Derive types with `z.input`/`z.infer`.
- Build success and error envelopes only through `ok`, `created`, `okPaged`, and `ApiError`; do not
  create parallel envelope types.

## Modules, mapping, and reads

Routes use `createCrudRoutes(service, api)` unless the flow is genuinely nonstandard. Modules own
`fieldMap` and `jsonColumns`; repositories know only physical database column names and never
import contracts or modules. Complex joins, multi-sheet workflows, and nonstandard outcomes use a
dedicated module service.

`BaseCrudService` validates the list query, reserves keyword/page/perPage/sort fields, maps other
query fields to `where`, maps API fields to database fields, and projects responses through the API
response schema. Keep custom query paths only for different semantics and test them.

Legacy dirty cells must not become 500 responses. JSON view columns listed in `jsonColumns` decode
to their API fields with `[]` for malformed arrays and `null` for malformed objects; correct a
wrong materialized view in its Apps Script source rather than guessing in the API or frontend.

## Sheets writes and certainty

Schema key order is physical column order for GViz reads; never reorder it cosmetically. Append
rows are full header width and use `''` for unspecified values because the Values API skips `null`.
Writes use Google Sheets API with `USER_ENTERED`; `valueInput` declarations guard unsupported column
intent and do not change the wire option. APPEND writes complete rows and UPDATE patches changed
columns, then verifies row identity.

A write response echoes the row as it was serialized for the wire, not as a read would return it.
Unspecified columns come back as `''` where a GViz read of the same row yields `null`, so a create
or update response can carry `''` for a field its API schema types as `boolean | null`. Write
responses are not runtime-validated, so this passes through to the caller. Measured on
`POST /api/laundry-photos` (2026-09-07): `checked` and `isActive` returned `''`, and the same row
read back through `GET` returned `null`. Treat a write response as write confirmation plus the
server-owned fields (id, audit timestamps); re-read when the caller needs read-shaped values.

Write outcomes distinguish rejected from unknown persistence. Never auto-retry a write after a
request was sent: a transport failure can follow a committed write and retry can duplicate data.
Token acquisition may be retried. Unsupported delete must fail rather than report false success.

All sheet row writes use the Google Sheets API; there is no SheetLib or Apps Script row-write
fallback. `APPSCRIPT_INVOICE_VIEW_SYNC_URL` only recomputes `InvoicesView`. Browser photo upload
sends its image binary to Firebase Storage and then writes the row through this API like any other
module; the binary itself never passes through the backend.

## Environment and external state

Repository getters are lazy, memoized module singletons. Each reads its workbook environment key on
first use; writable sheets also need `GOOGLE_SERVICE_ACCOUNT_KEY`. Server environment variables
never use `VITE_` prefixes.

The Google Sheets schema registry at `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` is
read-only. The live sheet is authoritative when it conflicts with a stale registry; never rewrite
the registry to match code. Do not alter the separate Python project's similarly named environment
variables or spreadsheet bindings.

## Backend verification

Run relevant `tests/server/` dry tests with `npx tsx <path>` and run `npm run typecheck:api` for
every backend change. Type-only tests are enforced by `typecheck:api`, not `tsx`. Before deploying a
sheet contract change, run:

```sh
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
```

Also run `git diff --check`. A green typecheck and dry tests do not prove live sheet parity or
production ESM resolution.

## Comments

Comments document durable decisions, invariants, and dangerous constraints. Do not put phase
numbers, plan status, future wiring claims, or other expiring project status in source code. Update
comments that describe changed behavior in the same change; prefer an executable guard or test when
the rule can be enforced.
