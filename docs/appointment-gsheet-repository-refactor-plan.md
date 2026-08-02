# Appointment → GSheetRepository / SheetLib Refactor Plan

Status: **plan only — no implementation starts until this plan is approved**.

## Goal

Make the Appointment backend write path use the refactored `GSheetRepository`
and the deployed MagicwashGateway SheetLib protocol. The frontend's existing
direct gateway writes remain unchanged until the backend path is verified.

## Verified Appointment contract

```text
GViz read sheetName: Appointments
SheetLib write target: Appointment
Primary key: AppointmentID
```

The authoritative schema is:

```text
G:\My Drive\Magicwash\Database\GoogleSheets\Appointment.json
```

Required APPEND fields:

```text
AppointmentID, CustomerID, AppointmentType, AppointmentDate, TimeSlot, Status
```

`ServiceTier` is supported by the Drive schema. The static SheetLib registry
does not list it, but it is only a fallback and must not define this module's
live contract.

## Fixed decisions

- Construct the repository with both `sheetName: 'Appointments'` and
  `target: 'Appointment'`; neither is derived from the other.
- The browser never supplies system-owned fields.
- On create, backend enrichment generates and sends:

  ```text
  AppointmentID
  Status = CONFIRMED
  ServiceTier = STANDARD when omitted
  CreatedAt
  UpdatedAt
  ```

- `CreatedAt` and `UpdatedAt` use plain text
  `YYYY-MM-DD HH:mm:ss` in Asia/Bangkok (`+07`). Both are set on create;
  only `UpdatedAt` changes on update.
- The Appointment transformer is a storage-format escape hatch only: serialize
  and decode the `Address` snapshot JSON without validating, trimming,
  defaulting, or repairing GViz data.
- A dedicated Appointment service owns create/update enrichment: IDs, defaults,
  and Bangkok audit timestamps.
- Use SheetLib requests:

  ```ts
  { resource: 'sheet', action: 'APPEND', target: 'Appointment', data }
  { resource: 'sheet', action: 'UPDATE', target: 'Appointment', key_value, data }
  ```

- No DELETE support.
- No Customer, Invoice, InvoiceItem, or OrderForm migration in this plan.
- No frontend direct-write migration in this plan.

## Dependency: persisted write responses

SheetLib currently returns only write acknowledgement metadata. The generic
backend `create()` and `update()` contracts return rows, so Appointment cannot
be migrated to a production backend write route until SheetLib implements the
already-agreed additive success response:

```json
{
  "resource": "sheet",
  "status": "ok",
  "target": "Appointment",
  "data": { "AppointmentID": "...", "...": "persisted row" },
  "write": { "updated_range": "Appointments!A2:Z2" }
}
```

Do not use immediate GViz read-back as a substitute; the read can lag behind a
write.

## TODO checklist after approval

- [x] Verify Appointment target, primary key, Drive schema fields, and enums.
- [x] Add `target` to `GSheetRepository` construction options. It is optional
  for read-only repositories and required before any write operation.
- [x] Replace the shared write transport with the SheetLib request envelope and
  `status`/`message` response handling; retain GViz read behavior unchanged.
- [x] Add tests for APPEND, UPDATE with `key_value`, SheetLib error bodies,
  HTTP errors, and no-resource regression.
- [x] Clean up the Appointment transformer: retain only `Address` JSON storage
  encoding/decoding and remove duplicate request validation plus GViz response
  coercion/defaulting.
- [ ] Add a dedicated Appointment service that generates `AppointmentID`,
  applies `Status`/`ServiceTier` defaults, and owns Bangkok audit timestamps.
- [x] Configure the Appointment repository with
  `sheetName: 'Appointments'` and `target: 'Appointment'`.
- [ ] Add Appointment transport tests: create includes all enriched fields and
  serialized `Address`; update changes only `UpdatedAt` and passes
  `AppointmentID` as `key_value`.
- [ ] Implement and verify the deferred SheetLib persisted-row response in the
  Development Apps Script deployment.
- [ ] Enable and test backend Appointment create/update end-to-end in
  Development.
- [ ] In a later, separately approved scope, migrate frontend direct writes.

## Expected file scope

| Area | Expected files |
|---|---|
| Shared transport | `server/shared/repositories/gsheet.repository.ts`, shared repository tests/types |
| Appointment backend | `appointment.repository.ts`, `appointment.transformer.ts`, `appointment.contract.ts`, Appointment tests |
| Apps Script, later | `MagicwashGateway` / `SheetLib` response implementation and its tests |

## Acceptance criteria

- Appointment reads still query GViz tab `Appointments` exactly as before.
- Backend write requests use target `Appointment`, never a derived target.
- Create never accepts client-controlled ID, status, service tier, or audit
  timestamps.
- The gateway receives all required create fields and update uses `key_value`.
- Stored API responses are mapped back through the existing shared contract.
- Direct frontend Appointment writes remain untouched until backend verification
  completes.
