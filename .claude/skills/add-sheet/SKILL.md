---
name: add-sheet
description: Register an existing Google Sheet in the backend, with optional API routes and writes.
---

# Add a sheet

## 1. Inspect the sheet

- Read `G:\My Drive\Magicwash\Database\GoogleSheets\<Sheet>.json` for the tab name, workbook ID, physical headers, column types, and primary key.
- Check the live header row and workbook binding against the registry. The registry is the single source of truth, shared by other projects.
- On any registry/live mismatch, stop and tell the user to update the registry. Do not write a contract from the live sheet, and do not edit either source.
- Choose an existing sheet with a similar shape and capability as the template.

## 2. Add the database contract

- Copy `server/sheets/<Existing>/<Existing>.db-contract.ts` to `server/sheets/<Sheet>/<Sheet>.db-contract.ts`.
- Declare a strict Zod row with the exact physical column names in physical column order. Set `primaryKey` to the physical column name and `sheetName` to the exact tab name.
- Set `spreadsheetId` to the environment variable name for the verified workbook. Reuse an existing key when the workbook already has one.
- Set `writes: { append: false, update: false, delete: false }` unless writes were requested.
- For requested writes, enable only the requested operations. Declare `audit` only for enabled timestamp stamping: created timestamp in `onAppend`, updated timestamp in `onUpdate`. Keep actor columns in the payload. Declare `valueInput` only for measured native Sheets cells used by enabled writes.

## 3. Add the repository getter

- Copy `server/sheets/<Existing>/<Existing>.repository.ts` to `server/sheets/<Sheet>/<Sheet>.repository.ts`; keep the memoized `get<Sheet>Repository()` getter.
- Use `SheetRepository` for `read`, `append`, `batchAppend`, `update`, `updateMany`, and `delete` as allowed by the contract. `updateMany` is also exposed through `SheetBatchUpdateContract` in `server/shared/repositories/sheet-repository.contract.ts`.
- Stop here when the requested scope is read-only registration without an API. Add API files later when requested.

## 4. Add the API, when requested

- Copy `contracts/orders/order-api.schema.ts` for a list-only API or a matching writable sibling to `contracts/<feature>/<m>-api.schema.ts`. Use camelCase API fields and satisfy `ModuleApiContract`; include `keyword` in `query.list`.
- Copy a matching sibling under `server/modules/<module>/` to `server/modules/<module>/<m>.module.ts`. Map every physical column to its API field in `fieldMap`. Add `jsonColumns` only for JSON-in-cell fields. Use a dedicated service for multi-sheet or non-CRUD behavior.
- Register the route in `server/api/route-registry.ts` with a literal lazy `.js` import.

## 5. Configure the workbook

- Add a new workbook key to `.env.example` and `.env.local` only when no existing key binds that workbook. Configure the same key in Vercel Preview and Production when deploying.
- For enabled writes, configure `GOOGLE_SERVICE_ACCOUNT_KEY` and workbook Editor access.

## 6. Update tests

- Add every new sheet to `tests/server/unit/sheets/sheet-binding.dry-test.ts`, `column-order.dry-test.ts`, `repository-getters.dry-test.ts`, and `tests/server/integration/sheet-column-parity.ts`.
- Add an audit declaration to `tests/server/unit/sheets/audit-declarations.dry-test.ts` when `audit` is declared.
- Add an API module to `tests/server/unit/sheets/module-laziness.dry-test.ts` and `service-wiring.dry-test.ts` when applicable.
- Add or update the feature's `tests/server/unit/api/route-registry-<feature>.dry-test.ts` when exposing a route. Add focused feature contract/module tests for new behavior.
- Run `tests/server/unit/sheets/writing-workbook-binding.dry-test.ts`; it discovers contracts automatically.

## 7. Verify

- Run the changed dry tests with `npx tsx <test-path>`.
- Run `npm run typecheck:api` and `npm run build`.
- Run `node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts` with access to the target workbook.
- Run `git diff --check`.

## Hard rules

- Treat `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` as read-only. Never edit the registry.
- Never rename or reorder physical sheet columns. Keep row-schema key order equal to physical column order.
- Keep writes disabled unless requested. Keep `delete: false`; deletion is unsupported.
- Use explicit `.js` extensions on relative backend imports and exports.
- Keep exactly the DB contract and repository getter under each `server/sheets/<Sheet>/`; add no barrel or index files.
