---
last_audited: 2026-08-26
audit_sources:
  - server/shared/repositories/sheet.repository.ts
  - server/shared/repositories/sheet-repository.contract.ts
  - server/shared/repositories/utils/gviz-reader.ts
  - server/shared/repositories/utils/gviz-query.builder.ts
  - server/shared/repositories/sheets-api.client.ts
  - server/shared/repositories/google-auth.ts
  - server/shared/contracts/sheet-contract.ts
  - server/sheets/Customers/Customers.db-contract.ts
  - api/CLAUDE.md
  - server/modules/invoices/invoice-view-sync-client.ts
---

# Backend Persistence

The persistence layer reads and writes Google Sheets through two separate transports.

It uses unauthenticated GViz for reads and the authenticated Google Sheets API for writes.

## Structure

Each physical sheet has two files under `server/sheets/<Sheet>/`.

`<Sheet>.db-contract.ts` defines the Zod row schema, `primaryKey`, `sheetName`, spreadsheet ID environment key, and write capability, and satisfies `SheetContract`.

`<Sheet>.repository.ts` exposes a lazily memoized `get<Sheet>Repository(): SheetRepository<TDbRow>`.

`SheetRepository<TDbRow>` in `server/shared/repositories/sheet.repository.ts` implements `SheetRepositoryContract<TDbRow>`.

It is the only concrete implementation of `SheetRepositoryContract` and uses database column names only, with no API-shape knowledge or `fieldMap`.

Mapping belongs to the module; see `service-layer.md`.

## Reads

`SheetRepository.read` calls `fetchGVizRows` in `server/shared/repositories/utils/gviz-reader.ts`.

It reads unauthenticated from `https://docs.google.com/spreadsheets/d/{id}/gviz/tq?...`.

Column letters come from `deriveGVizColumns(contract.row)` in `gviz-query.builder.ts`.

The row schema's key order must match the physical column order of the sheet.

## Writes

`SheetRepository.append`, `batchAppend`, and `update` use `SheetsApiClient` in `server/shared/repositories/sheets-api.client.ts`.

Writes authenticate with a service-account JWT from `google-auth.ts` using `GOOGLE_SERVICE_ACCOUNT_KEY`.

`delete` is gated by write capability: it rejects up front when `writes.delete` is false, and when the capability is enabled it currently always throws `'delete is not supported yet'` — the operation is stubbed, not implemented.

There is no Apps Script row-write path.

The remaining Apps Script call is `invoice-view-sync-client.ts`, which posts `{ invoiceNumber }` to recompute `InvoicesView` after a write rather than writing a row.

## Schema Locations

API contracts use camelCase frontend-to-backend shapes and live at `contracts/<feature>/<m>-api.schema.ts`.

They satisfy `ModuleApiContract`.

Database contracts use physical column names and live at `server/sheets/<Sheet>/<Sheet>.db-contract.ts`.

Database contracts never live under `contracts/`.

The Google Sheets schema registry is `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`.

It is the read-only source of truth for sheet and column shape; code changes to match it, and the registry is never rewritten to match code.

## Related Documentation

- `service-layer.md` — how services map database rows into API DTOs
- `project-structure.md` — where sheet repository files live in the backend tree
