# APPOINTMENT_MODULE_NEW_FLOW_REFACTOR_PLAN

**Status:** Step 2 plan drafted — awaiting Claude review
**Related Module:** appointments / engine-migration (legacy sheet-crud -> repositories + BaseCrudService)
**Created by:** CLAUDE
**Last cleaned by:** CODEX
**Date:** 2026-06-24

> Process & gates: see the collaborative-workflow `SKILL.md`.
> This file was intentionally cleaned on 2026-06-27 by Human request. Old activity-log detail is preserved in git history; this file is now the current working source of truth.

---

## Problem & Objective

### Problem Statement

`appointments` is the last module still using the legacy `server/shared/sheet-crud/` flow:

- `server/modules/appointments/appointment.module.ts` still imports `createGoogleSheetRepository` and `createSheetService`.
- `customers` already uses the new stack: `GSheetRepository` + `BaseCrudService` + `ModuleContract`.
- Keeping appointments on legacy flow blocks removal of `sheet-crud`, `google-sheets`, and `base-sheet.repository.ts`.

The earlier capability-gap direction changed. We will **not** extend the Base read pipeline in this migration. Appointment list filters were re-scoped to fields the current Base read flow supports.

### Goal / Success Criteria

- `appointments` runs on the new stack:
  - `GSheetRepository`
  - `BaseCrudService`
  - `appointmentContract = { api, db }`
- No production appointment module imports `server/shared/sheet-crud/`.
- GET route uses `okPaged`, not `okPaginated`.
- `npm run typecheck:api` passes after module migration.
- Transformer stays wired and covered by dry tests.

### Scope

**In Scope**

- Use existing `contracts/appointments/appointment-api.schema.ts` nested `appointmentApiContract`.
- Use existing `server/modules/appointments/appointment.contract.ts` `appointmentContract`.
- Wire `server/modules/appointments/appointment.module.ts` to:
  - `new GSheetRepository({ contract: appointmentContract, ..., transformer: createAppointmentTransformer() })`
  - `new BaseCrudService({ repository, api: appointmentContract.api, searchFields })`
- Use shared `APPSCRIPT_URL`.
- Update `api/appointments/index.ts` from `okPaginated` to `okPaged`.
- Keep `server/modules/appointments/appointment.transformer.ts` and its dry tests.
- Remove legacy engine after appointments has no remaining legacy consumer:
  - `server/shared/sheet-crud/`
  - `server/shared/google-sheets/`
  - `server/shared/repositories/base-sheet.repository.ts`

**Out of Scope**

- Extending `ReadQueryDTO`, `GVizQueryBuilder`, or Base read pipeline for range/OR filters.
- DELETE / soft-delete API.
- Frontend appointment feature migration.
- Real Apps Script deployment changes.
- Runtime validation of `db.request.*` / `db.response.*` schemas. This is future engine work and is also noted in `.user/memory/MEMORY.md`.

---

## Current Contract Decisions

### List Query

`appointmentListQuerySchema` is scoped to Base-supported fields only:

- `keyword`
- `customerId`
- `appointmentDate`
- `status`
- `page`
- `perPage`
- `sortBy`
- `sortOrder`

Removed from list query for this migration:

- `dateFrom`
- `dateTo`
- `orderId`
- `includePending`
- `appointmentType`
- `timeSlot`
- `serviceTier`

Sort fields:

- `appointmentDate`
- `timeSlot`
- `status`

### API Create

Create request must include flat customer snapshot fields from the customer page:

- `customerName`
- `customerCode`
- `phone`
- `address`
- `location`

These are required with `.trim().min(1)`.

The request transformer packs them into DB `Address` JSON before Apps Script receives the payload, then removes helper fields.

### API Update

API update does **not** expose `address` or `serviceTier`.

Current mutable API update fields:

- `appointmentType`
- `appointmentDate`
- `timeSlot`
- `status`
- `pickupOrderId`
- `deliveryOrderId`
- `notes`
- `updatedBy`

### API Response

List response includes flattened customer snapshot fields:

- `customerName`
- `customerCode`
- `phone`
- `address`
- `location`

Detail/create/update response extends list response with:

- `pickupOrderId`
- `deliveryOrderId`
- `serviceTier`

### DB Contract

`appointment.contract.ts` DB side remains a DB/AppScript contract, not an intermediate transformer contract.

- DB `Address` is the real sheet column.
- DB `Address` stores a customer snapshot JSON string.
- `appointmentDbCreateRequestSchema` requires final DB `Address`.
- DB update schema may still include `Address` because it describes DB capabilities/standard, even though API update does not expose `address`.

---

## Transformer Status

Implemented and pushed in commit:

- `d655ca4 Prepare appointment transformer`

Files:

- `server/modules/appointments/appointment.transformer.ts`
- `server/modules/appointments/appointment.transformer.dry-test.ts`

Verified:

```text
npx tsx server/modules/appointments/appointment.transformer.dry-test.ts
26 appointment transformer dry tests passed
```

### Request Transformer

- Runs only for `operation === 'create'`.
- Input is already mapper-to-DB data.
- Packs helper fields into DB `Address` JSON:
  - `customerName` -> `CustomerName`
  - `customerCode` -> `CustomerLabel`
  - `phone` -> `Phone`
  - `address` -> `Address`
  - `location` -> `Location`
  - `Facebook`, `Line`, `Whatsapp`, `Email` -> empty strings for now
- Removes helper fields before forwarding to Apps Script:
  - `customerName`
  - `customerCode`
  - `phone`
  - `location`
- Leaves non-create requests unchanged.

### Response Transformer

- Runs before `mapper.toApi()`.
- Supports read arrays and create/update/detail objects.
- Parses DB `Address` JSON snapshot and flattens to:
  - `customerName`
  - `customerCode`
  - `phone`
  - `Address` (DB key, later mapped to API `address`)
  - `location`
- Missing/empty snapshot fields become `null`.
- Legacy plain string / invalid / non-object `Address` falls back to address text.
- Does not mutate input rows.

---

## How (Implementation Approach)

> Step 2 review target: this section is the proposed migration plan. Claude should review this plan and the referenced files before Step 3 implementation starts.

### High-Level Steps

1. Keep the already-implemented transformer as-is unless review finds a bug:
   - `server/modules/appointments/appointment.transformer.ts`
   - `server/modules/appointments/appointment.transformer.dry-test.ts`
2. Migrate `server/modules/appointments/appointment.module.ts`:
   - remove legacy `sheet-crud` imports;
   - import `appointmentContract`;
   - import `GSheetRepository`;
   - import `BaseCrudService`;
   - import `requireEnv`;
   - import `createAppointmentTransformer`;
   - instantiate repository with shared `APPSCRIPT_URL`;
   - instantiate service with `appointmentContract.api`.
3. Use keyword `searchFields`:
   - proposed: `['appointmentId', 'customerId', 'address', 'notes']`;
   - review concern: `address` searches raw DB snapshot JSON, not transformed `address`.
4. Update `api/appointments/index.ts`:
   - import `okPaged`;
   - return `okPaged(items, pagination)`.
5. Run verification:
   - `npx tsx server/modules/appointments/appointment.transformer.dry-test.ts`
   - `npm run typecheck:api`
6. Remove legacy engine only after `appointment.module.ts` has no legacy imports and typecheck is green:
   - `server/shared/sheet-crud/`
   - `server/shared/google-sheets/`
   - `server/shared/repositories/base-sheet.repository.ts`
7. Re-run verification after legacy removal:
   - transformer dry test;
   - `npm run typecheck:api`;
   - repository dry tests if imports or shared repository code changed.

### Contracts

**API create request** (`contracts/appointments/appointment-api.schema.ts`)

```ts
appointmentCreateSchema = {
  customerId: string,
  customerName: string, // required trim().min(1)
  customerCode: string, // required trim().min(1)
  phone: string,        // required trim().min(1)
  address: string,      // required trim().min(1)
  location: string,     // required trim().min(1)
  appointmentType: AppointmentType,
  appointmentDate: YYYY-MM-DD,
  timeSlot: AppointmentTimeSlot,
  serviceTier?: ServiceTier,
  pickupOrderId?: string | null,
  deliveryOrderId?: string | null,
  notes?: string | null,
  createdBy: string,
}
```

**API list query**

```ts
appointmentListQuerySchema = {
  keyword: string,
  customerId: string | null,
  appointmentDate: string | null,
  status: AppointmentStatus | null,
  page: number,
  perPage: number,
  sortBy: 'appointmentDate' | 'timeSlot' | 'status',
  sortOrder: 'asc' | 'desc',
}
```

**DB create request** (`server/modules/appointments/appointment.contract.ts`)

```ts
appointmentDbCreateRequestSchema = {
  CustomerID: string,
  AppointmentType: AppointmentType,
  AppointmentDate: string,
  TimeSlot: AppointmentTimeSlot,
  Address: string, // final customer snapshot JSON string
  PickupOrderID?: string | null,
  DeliveryOrderID?: string | null,
  Notes?: string | null,
  CreatedBy: string,
  ServiceTier?: ServiceTier,
}
```

DB create schema intentionally does **not** include `customerName/customerCode/phone/location`; those are API helper fields consumed by the request transformer before Apps Script receives the body.

**Transformer snapshot JSON**

```ts
{
  CustomerName: string,
  CustomerLabel: string,
  Phone: string,
  Address: string,
  Location: string,
  Facebook: '',
  Line: '',
  Whatsapp: '',
  Email: '',
}
```

### Proposed Module Wiring

```ts
const appointmentRepository = new GSheetRepository({
  contract: appointmentContract,
  sheetName: 'Appointments',
  spreadsheetId: requireEnv('APPOINTMENTS_SPREADSHEET_ID'),
  scriptUrl: requireEnv('APPSCRIPT_URL'),
  transformer: createAppointmentTransformer(),
})

export const appointmentService = new BaseCrudService({
  repository: appointmentRepository,
  api: appointmentContract.api,
  searchFields: ['appointmentId', 'customerId', 'address', 'notes'],
})
```

Review should confirm whether `address` belongs in `searchFields`. Because `address` is a raw DB snapshot string at query time, keyword search over `address` searches the serialized snapshot, not transformed fields.

### Functional Flow

**List**

```text
GET query
-> appointmentApiContract.query.list parse
-> ReadQueryDTO.fromQuery
-> GSheetRepository.read
-> transformer.response
-> mapper.toApi
-> BaseCrudService.project(list response)
-> okPaged(items, pagination)
```

**Create**

```text
POST payload with flat customer snapshot fields
-> appointmentApiContract.request.create parse
-> mapper.toDb
-> transformer.request packs Address JSON and removes helper fields
-> Apps Script APPEND
-> transformer.response flattens Address snapshot
-> mapper.toApi
-> BaseCrudService.project(create response)
```

**Update**

```text
PATCH payload
-> appointmentApiContract.request.update parse
-> read existing row by id for 404/409 behavior
-> mapper.toDb
-> transformer.request returns unchanged
-> Apps Script UPDATE
-> transformer.response flattens Address snapshot from returned row
-> mapper.toApi
-> BaseCrudService.project(update response)
```

---

## Edge Cases To Preserve

### Transformer Request

- Create packs flat snapshot fields into DB `Address` JSON.
- Create removes helper fields before Apps Script payload.
- Create does not mutate input request data.
- Create rejects missing/blank required snapshot fields.
- Non-create requests return unchanged.
- Mapper integration is covered: API payload -> `Mapper.toDb()` -> transformer.

### Transformer Response

- Read `[]` returns `[]`.
- Multi-row arrays transform each row independently.
- Valid snapshot JSON flattens customer fields.
- Missing `Address` returns all derived fields as `null`.
- Empty/whitespace `Address` returns all derived fields as `null`.
- Missing/empty/non-string snapshot field values normalize to `null`.
- Legacy plain string/invalid/non-object `Address` falls back to address text.
- Input row is not mutated.
- Mapper integration is covered: transformed DB row -> `Mapper.toApi()`.

### Module Migration

- `getById` not found -> 404 through `BaseCrudService`.
- duplicate id rows -> 409 through `BaseCrudService`.
- `okPaged` response meta is `{ page, perPage }`.
- `okPaginated` must not remain in appointments index route.
- `APPSCRIPT_APPOINTMENT_URL` must not be used by new appointment module.
- `appointment.module.ts` must not import `sheet-crud`.

---

## Decisions & Rejected Alternatives

- **Rejected:** extend Base read pipeline for range/OR filters in this migration.
  - Reason: Human re-scoped appointment list query to Base-supported filters only.
- **Rejected:** request transformer looks up customer by `customerService.getById`.
  - Reason: appointment creation happens from the customer page, so frontend can send the snapshot fields directly.
- **Rejected:** adding flat helper fields to DB create schema.
  - Reason: DB schema must represent final DB/AppScript payload, not transformer intermediate data.
- **Rejected:** removing `Address` from DB update schema only because API update does not expose address.
  - Reason: DB schema describes DB capability/standard, not API projection.

---

## Compact Activity Log

================================================================================

- [CLAUDE] [2026-06-24]
Created Step 1 problem/scope. Confirmed appointments is the last legacy `sheet-crud` consumer.

================================================================================

- [USER] [2026-06-24]
Confirmed scope decisions: use shared `APPSCRIPT_URL`; remove legacy engine in this migration; route must use `okPaged`; frontend impact is a real API envelope change; write null semantics must be explicit.

================================================================================

- [USER] [2026-06-26]
Re-scoped list query to Base-supported filters only. Decided not to expand Base read pipeline in this migration.

================================================================================

- [USER/CODEX] [2026-06-27]
Implemented appointment transformer before module migration. Commit pushed:
`d655ca4 Prepare appointment transformer`.

================================================================================

- [USER] [2026-06-27]
Requested plan cleanup before continuing. Old detailed activity log removed from the working plan; git history remains the durable record.

================================================================================

- [CODEX] [2026-06-27 13:29]
Drafted Step 2 migration plan after cleanup. The plan now reflects the current scoped direction:
no Base read-pipeline expansion, transformer already implemented, appointment module migration next,
route switch to `okPaged`, and legacy engine removal only after appointments no longer imports it.

**Handoff -> @claude**
Please review this plan before implementation. Focus on:
- whether `appointment.module.ts` wiring is correct for `GSheetRepository + BaseCrudService`;
- whether API/DB contract boundaries are correct, especially transformer helper fields vs final DB payload;
- whether proposed `searchFields` should include raw snapshot `address`;
- whether edge cases are complete enough for Step 3;
- whether legacy engine removal timing is safe.
