# GSheetRepository → SheetLib Write Refactor Plan

Status: **plan only — no implementation may start until approved**.

## Purpose

This first refactor makes `GSheetRepository` the backend write path for the
**Appointment** module only. Reads remain unchanged: they continue to use GViz
and `sheetName`.

Customer is explicitly deferred: its create/update flow spans two sheets and
requires separate design work.

The deployed `MagicwashGateway` is the authoritative write protocol. It accepts
the SheetLib envelope below, at the same Apps Script deployment configured as
`APPSCRIPT_URL`.

```json
{ "resource": "sheet", "action": "APPEND", "target": "<target>", "data": {} }
{ "resource": "sheet", "action": "UPDATE", "target": "<target>", "key_value": "<id>", "data": {} }
```

## Facts verified before this plan

- `APPSCRIPT_URL` has the same Development/Preview/Production deployment URL.
- `APPSCRIPT_GATEWAY_URL` is the same URL in Development, but Production currently pulls as empty. New backend code will use only `APPSCRIPT_URL`.
- `MagicwashGateway/Code.js` has no default resource. A request without
  `resource: 'sheet'` returns `Unknown resource: (none)`.
- Current `GSheetRepository` write code sends `{ action, sheet, data }` and
  expects `{ success, data }`; that does not match the deployed gateway.
- Some UI flows still work because `src/utils/gateway.js` already sends the
  valid SheetLib envelope directly from the frontend. This does not prove that
  `GSheetRepository.create()` or `.update()` works.

## Approved design decisions

### 1. Keep read and write names separate

`sheetName` stays the GViz tab name used for reads.

`target` is added to `GSheetRepository` construction options beside
`sheetName`. Each module repository passes it explicitly; `GSheetRepository`
never looks it up or derives it. It is the SheetLib/Drive-schema key supplied
to the gateway. It may happen to equal a tab name, but is not assumed to do
so: the schema behind a target chooses the spreadsheet, tab, primary key, and
allowed fields.

Every writable module repository must pass its target explicitly. Read-only
Portal repositories need no write target.

### 2. Use one Apps Script URL

`GSheetRepository` write operations use `APPSCRIPT_URL` only. No new code uses
`APPSCRIPT_GATEWAY_URL`.

The Production value of `APPSCRIPT_GATEWAY_URL` must be fixed or removed during
deployment cleanup, but it is not a dependency of the refactored repository.

### 3. Match the SheetLib request and error contract

For write operations, `GSheetRepository` sends:

```ts
{ resource: 'sheet', action: 'APPEND', target, data }
{ resource: 'sheet', action: 'UPDATE', target, key_value: id, data }
```

It treats `{ status: 'error', message }` as a repository error and
`{ status: 'ok', ... }` as success. It does not expect `success: true`.

### 4. Add `batchAppend()`

Add a clearly named repository method:

```ts
repository.batchAppend(rows)
```

It sends one SheetLib `APPEND` request with `data: rows`. It is required for
invoice items so the gateway can validate the entire batch before writing it.

### 5. Define the future Apps Script write-response contract now

Today SheetLib returns acknowledgement metadata, for example:

```json
{ "resource": "sheet", "status": "ok", "target": "InvoiceItem", "appended_rows": 2 }
```

It does **not** return the written row(s). `BaseCrudService` currently expects
`create()` and `update()` to return rows. The shared write contract is defined
now so that the later Apps Script change has one unambiguous target.

The later Apps Script implementation must return persisted data:

```json
{
  "resource": "sheet",
  "status": "ok",
  "target": "Customer",
  "data": { "customer_id": "C001", "...": "persisted row" },
  "write": { "updated_range": "Customers!A42:Z42" }
}
```

For `batchAppend()`, `data` is an array of persisted rows. Do not substitute an
immediate GViz read-back: GViz propagation can lag after a write.

The repository refactor may define and test this contract now, but no module
write migration may rely on it until Apps Script implements it.

### 6. Keep DELETE and frontend write migration out of scope

`DELETE` remains unsupported by `GSheetRepository` in this refactor.

Existing direct frontend writes remain untouched. They are migrated only as the
last phase, after the backend repository transport and Apps Script response
contract work correctly in Development.

## TODO checklist after approval

- [x] **Confirm the Appointment target against Apps Script.** Verify the
  Drive-schema target, primary key, allowed fields, and enum values for
  Appointment only.
- [x] **Define shared SheetLib write types.** Add the future success/error
  response contract, including persisted `data` and batch `data[]`, without
  changing Apps Script yet.
- [x] **Add explicit `target` construction config.** Extend
  `GSheetRepository` options so each writable module passes `target` beside
  `sheetName`; never derive or look it up.
- [x] **Replace the repository write envelope.** Send `resource: 'sheet'`,
  `target`, and `key_value` for UPDATE; parse `status`/`message` instead of
  `success`/`error`; use `APPSCRIPT_URL`.
- [x] **Add `batchAppend(rows)`.** Send exactly one SheetLib APPEND request
  with an array and expose the agreed response type.
- [x] **Add repository transport tests.** Cover APPEND, UPDATE, gateway error,
  absent-resource regression, and one-request batch append; keep GViz reads
  unchanged.
- [ ] **Implement the deferred Apps Script response contract.** Make SheetLib
  return persisted `data`/`data[]` and verify it in Development before any
  backend caller depends on it.
- [ ] **Migrate invoice writes.** Add target-aware repositories for Invoice,
  InvoiceItem, and OrderForm; preserve items-first sequencing; then remove the
  legacy Invoice and OrderForm gateway adapters.
- [ ] **Defer Customer and other backend writes.** Do not migrate Customer,
  Invoice, InvoiceItem, or OrderForm in this refactor; plan each separately
  after Appointment is verified.
- [ ] **Migrate frontend writes last.** Replace direct frontend gateway calls
  only after the backend write path is verified end-to-end.
- [ ] **Deployment cleanup.** Verify `APPSCRIPT_URL` in every Vercel
  environment, retire `APPSCRIPT_GATEWAY_URL`, and remove obsolete clients and
  stale comments.

## Implementation order after approval

1. **Appointment contract audit first.** Define the shared SheetLib
   write-response shape. Compare Appointment's field schema, explicitly
   configured target, primary key, and enum values against its Drive-backed
   SheetLib schema.
2. **Shared repository transport.** Add optional/required-for-write `target`,
   SheetLib request/response types, `resource: 'sheet'`, `key_value` handling,
   timeout/error mapping, and `batchAppend()` to `GSheetRepository`.
3. **Repository tests.** Cover APPEND, UPDATE, error body, no-resource
   regression, and one-request batch append. Keep GViz read tests unchanged.
4. **Apps Script response work (later).** Implement the already-defined
   persisted `data` response contract, then test it in the Development
   deployment.
5. **Migrate Appointment only.** Add its explicit target and backend-owned
   create enrichment: generate `AppointmentID`, set `Status: 'CONFIRMED'`,
   default `ServiceTier` to `STANDARD`, and generate `CreatedAt`/`UpdatedAt`
   in the required Bangkok text format. Preserve the existing appointment
   request transformer for the address snapshot.
6. **Migrate direct frontend Appointment writes last.** Replace direct gateway
   calls only
   after the backend path is verified end-to-end.
7. **Deployment cleanup.** Ensure `APPSCRIPT_URL` is configured in all Vercel
   environments, retire `APPSCRIPT_GATEWAY_URL`, and delete obsolete clients
   and stale documentation.

## Explicit non-goals for the first approved change

- No change to Portal/GViz read behavior.
- No Apps Script implementation change in the first repository refactor.
- Legacy Invoice and OrderForm gateway adapters are removed only after the
  repository transport and response semantics are verified.
- No Customer migration. Customer's two-sheet create/update flow is deferred.
- No Invoice, InvoiceItem, or OrderForm migration.
- No DELETE support.
- No frontend write migration until the backend path is verified.
- No assumption that a SheetLib target equals a physical sheet tab name.
