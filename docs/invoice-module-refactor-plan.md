# Invoice Module Refactor Plan

Status: **plan prepared; implementation is pending execution approval**.

## Goal

Refactor Invoice into a complex backend module that uses the completed
`GSheetRepository`/SheetLib transport, keeps the public API contract stable,
and makes multi-sheet persistence explicit, testable, and safe to operate.

Reference implementation: `server/modules/appointments/` and
`docs/appointment-gsheet-repository-refactor-plan.md`.

## Non-negotiable Rules

- `server/modules/invoices/invoice.repository.ts` is the only repository file
  owned by the Invoice module.
- One physical sheet has one lazy `GSheetRepository` and one
  `ModuleDbContract`. Invoice owns separate repositories/contracts for:
  `Invoice`, `InvoiceItem`, `Payment`, and `InvoicesView`.
- Invoice uses a dedicated `InvoiceService`. `BaseCrudService` may support a
  read-only helper, but it is not the service for the multi-sheet workflow.
- `OrderForm` belongs to Orders. Its repository and DB contract live under
  `server/modules/orders/`; `InvoiceService` may import its repository getter.
- All SheetLib writes use `APPSCRIPT_URL`, an explicit `target`, and persisted
  `data`/`data[]` responses. Never read back through GViz after a write.
- `InvoicesView` is read-only and may decode JSON cells/GViz dates only.

## Target Architecture

```text
invoice.module/routes
        -> InvoiceService
        -> invoice.repository.ts
           -> Invoice GSheetRepository
           -> InvoiceItem GSheetRepository
           -> Payment GSheetRepository
           -> InvoicesView GSheetRepository (read-only)
        -> Orders getOrderFormRepository()
```

The write sequence remains owned by `InvoiceService`:

```text
InvoiceItem.batchAppend()
  -> Invoice.create()
  -> OrderForm.update()
  -> InvoiceView sync (only if the explicit sync contract remains required)
```

## Module Structure

The target structure is:

```text
contracts/invoices/
├─ invoice-api.schema.ts             # Public Invoice create request/outcomes
├─ invoice-view-api.schema.ts        # Public InvoicesView list/detail DTOs
└─ invoice-calculator.ts             # Shared invoice arithmetic

server/modules/invoices/
├─ invoice.contract.ts               # DB contracts for Invoice, InvoiceItem,
│                                    # Payment, and InvoicesView; one per sheet
├─ invoice.repository.ts             # The only Invoice repository file;
│                                    # four lazy GSheetRepository getters
├─ invoice.service.ts                # Injectable InvoiceService; validation,
│                                    # calculations, orchestration, outcomes
├─ invoice.module.ts                 # Route wiring and HTTP translation only
└─ invoice-view-sync-client.ts       # Separate view-sync integration, only
                                     # if the final sync decision keeps it

server/modules/orders/
├─ order.contract.ts                 # Existing Orders contracts plus OrderForm DB contract
├─ order.repository.ts               # Existing Orders getters plus getOrderFormRepository()
└─ (OrderForm repository is owned here; no separate adapter remains)

tests/server/unit/modules/invoices/
├─ invoice.service.dry-test.ts      # Injected repository fakes and outcome sequence
├─ invoice.repository.dry-test.ts   # Per-sheet targets, mapping, persisted rows/batches
├─ invoice-read.dry-test.ts         # List/detail/date-range behavior
└─ invoice-view-sync-client.dry-test.ts # Keep/update only if sync client remains

tests/server/unit/modules/orders/
└─ orderForm.repository.dry-test.ts # OrderForm UPDATE key and PATCH mapping
```

Legacy Invoice and OrderForm gateway adapters and envelope types were removed
after zero-reference verification. The module now uses the shared repository
transport exclusively for SheetLib writes.

## Contract and Repository Design

1. Verify the authoritative schemas before coding: physical row order, tab,
   spreadsheet env, SheetLib target, primary key, writable fields, and
   persisted response shape for Invoice, InvoiceItem, Payment, and OrderForm.
2. Keep public camelCase aggregate schemas in
   `contracts/invoices/invoice-api.schema.ts` and portal read schemas in
   `contracts/invoices/invoice-view-api.schema.ts`.
3. Keep the DB contract bundles in
   `server/modules/invoices/invoice.contract.ts` separated per physical sheet.
   Each bundle declares its own row schema, field map, primary key, and
   create/update response capabilities.
4. Add `invoice.repository.ts` with lazy memoized getters. `InvoicesView` has
   no write target or write capability; each writable sheet has an explicit
   SheetLib target and the correct spreadsheet environment variable.
5. Move OrderForm's legacy adapter into the Orders repository/contract area.
   Its UPDATE must use the source order id as `key_value` and send only the
   mapped invoice-link patch plus audit actor.

## Service and Route Refactor

1. Convert `createInvoice()` into an injectable `InvoiceService`.
2. Validate the public request once at the service boundary, calculate line
   totals server-side, generate server-owned ids/status/audit fields, and pass
   typed domain commands to repositories.
3. Use exactly one `batchAppend()` call for all InvoiceItem rows.
4. Move Invoice list/detail and date-range filtering into service/query code;
   keep `invoice.module.ts` limited to dependency wiring and HTTP translation.
5. Preserve the current public GET DTOs and POST outcome union unless a
   deliberate frontend/API compatibility change is approved together.
6. Keep raw SheetLib fetch out of the Invoice service; all sheet writes go
   through the module repositories.

## Failure and Retry Semantics

There is no transaction across InvoiceItem, Invoice, OrderForm, and the view.
The service must distinguish:

- **Definite rejection:** the gateway confirmed that nothing was written.
- **Transport unknown:** timeout, invalid response, or network failure may
  have happened after persistence; never offer an automatic duplicate retry.
- **Partial persistence:** earlier stages succeeded and later stages failed;
  report a non-retryable reconciliation outcome.

Do not keep claiming `items_write_failed` is safe to retry for an unknown
transport result. Add typed repository errors or an explicit unknown outcome
to the shared API/Frontend contract before changing the write flow.

Decide explicitly whether `invoice-view-sync-client.ts` remains a separate
materialized-view integration. If Apps Script refreshes the view as part of
the completed write protocol, remove the client and outcome; otherwise retain
it as a documented non-SheetLib integration after the source writes complete.

## Tests

- Per-sheet contract/type tests: row order, field maps, primary keys, targets,
  read-only InvoicesView, and unsupported Payment writes where applicable.
- Repository transport tests: APPEND, UPDATE, `key_value`, batch append,
  persisted row mapping, ordered `data[]`, gateway rejection, and unknown
  transport failure.
- InvoiceService tests with injected fakes: exact write order, one batch only,
  totals, enrichment, every stage outcome, and no duplicate retry semantics.
- Orders tests for the mapped OrderForm PATCH and ownership migration.
- Invoice read tests: list/detail, date filtering before pagination, and DTO
  projection compatibility.

Run relevant `npx tsx` dry tests, `npm run typecheck:api`, `npm run build` when
public contracts change, and `git diff --check`.

## Workflow Test Plan

These tests focus on real user workflows and input-to-output behavior. They
are not a replacement for implementation unit tests; implementation teams may
add unit tests separately.

### Layer 1: API boundary workflow

Suggested path: `tests/server/workflows/invoices/invoice-api.workflow.dry-test.ts`

- Send the public camelCase create payload and assert HTTP status plus the
  exact top-level response body for every existing outcome.
- Assert invalid input, extra fields, and client-supplied system fields cause
  no persistence call.
- Preserve the current six POST outcomes and their status codes unless an
  approved unknown-persistence outcome is added with frontend handling.

### Layer 2: SheetLib transport workflow

Suggested path: `tests/server/workflows/invoices/invoice-sheetlib.workflow.dry-test.ts`

- Assert one `InvoiceItem` APPEND with an ordered `data[]` array.
- Assert one `Invoice` APPEND and one `OrderForm` UPDATE with
  `key_value=sourceOrderId` and only the invoice-link PATCH fields.
- Assert explicit targets, `APPSCRIPT_URL`, persisted `data`/`data[]`, and
  field mapping. No GViz read-back is allowed.

### Layer 3: Service orchestration workflow

Suggested path: `tests/server/workflows/invoices/invoice-create.workflow.dry-test.ts`

- Use real-shaped repository fakes that record calls and persisted rows.
- Assert the exact sequence:
  `InvoiceItem.batchAppend -> Invoice.create -> OrderForm.update -> ViewSync`.
- Assert one call per stage, server-side totals/IDs/status/audit fields, and
  no automatic duplicate retry.

### Layer 4: Read API workflow

Suggested path: `tests/server/workflows/invoices/invoice-read.workflow.dry-test.ts`

- Assert list/detail response envelopes remain compatible with the frontend.
- Cover keyword, customer, status, sort, inclusive date ranges, and filtering
  before pagination.
- Assert 404 behavior and the exact DTO consumed by Invoice list/detail pages.

### Layer 5: Frontend compatibility workflow

Suggested path: `tests/frontend/invoices/invoice-api-compat.workflow.dry-test.ts`

- Assert list unwrapping, detail-404 handling, and top-level POST outcomes.
- Assert create UI renders success and each failure outcome correctly.
- Retry is offered only for a definite rejection that proves nothing persisted.

### Layer 6: Dev/Preview end-to-end workflow

Suggested checklist: `docs/invoice-refactor-smoke-checklist.md`

Use an isolated workbook, dedicated Apps Script deployment, and a unique
`E2E-<run-id>` invoice number. Never use shared production-like data because
DELETE is unsupported.

1. Open an actual order and start Create Invoice.
2. Verify customer/order prefill, edit two line items, and add adjustments.
3. Submit and verify the success result and calculated total.
4. Verify InvoiceItem rows, Invoice header, OrderForm invoice link, and the
   selected InvoicesView sync behavior in the isolated workbook.
5. Open list and detail pages and confirm they show the same persisted data.
6. Run the same journey through local Vercel Dev and deployed Preview.

### Required failure workflows

| Scenario | Expected behavior |
|---|---|
| Invalid request | 422; no external write |
| Definite InvoiceItem rejection | Existing retry-safe outcome; no later stage runs |
| InvoiceItem timeout/response lost | Unknown persistence; never suggest resubmission |
| Invoice header failure | Items may exist; stop before OrderForm/ViewSync |
| OrderForm failure | Invoice/items exist; do not create a second Invoice |
| ViewSync failure | Source data exists; report stale-view outcome |

The timeout/response-loss workflow is a release gate. Keeping the old
`items_write_failed` retry behavior is not acceptable unless SheetLib provides
an idempotency or reconciliation guarantee.

### Workflow acceptance

- Existing successful create/list/detail behavior is unchanged.
- All public status codes and response fields remain compatible, or the
  frontend is changed and tested in the same release.
- The four write stages occur once and in the required order.
- No workflow performs a GViz read-back to confirm a write.
- Dev and Preview pass with real environment variables and isolated data.

## Rollout and Cleanup

1. Implement contracts/repositories without changing routes.
2. Implement injected `InvoiceService` and run all unit/type tests.
3. Switch the module routes to the service and verify GET/POST in Development.
4. Smoke-test Vercel Preview with `APPSCRIPT_URL` in every environment.
5. Verify with `rg` that no legacy gateway clients/adapters or imports remain.
6. Keep DELETE unsupported and do not migrate unrelated modules in this work.

## Acceptance Criteria

- One Invoice repository file, one `GSheetRepository` per physical sheet, and
  one `ModuleDbContract` per physical sheet.
- No Invoice SheetLib write uses `APPSCRIPT_GATEWAY_URL`, raw `fetch`, or GViz
  read-back.
- InvoiceService owns the complete multi-sheet workflow and server-side facts.
- Persisted response rows are used directly and failure/retry semantics are
  truthful for every stage.
- Existing frontend list/detail/create behavior remains compatible, or any
  intentional contract change is implemented and tested end-to-end.
