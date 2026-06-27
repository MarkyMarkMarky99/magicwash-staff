# Plan Design & Review

**Status:** Phase 2 Approved

> Gate: Human approves the final plan and the Phase 2 commit is pushed. Detailed reviewer feedback belongs in `reviews/`.
> Phase 2 review target: the implementation approach below. Reviewers should read this plan and the referenced files before Phase 3 implementation starts.

## Considered Directions

- **Option A — Extend the Base read pipeline** so appointments keep their richer list filters (range/OR: `dateFrom`/`dateTo`, `orderId`, `includePending`, `appointmentType`, `timeSlot`, `serviceTier`) while migrating onto the new stack.
  - Cons: expands `ReadQueryDTO` / `GVizQueryBuilder` scope; larger, riskier change coupled to the migration.
- **Option B — Re-scope the list query to Base-supported fields** and migrate onto the existing new stack without touching the read pipeline.
  - Pros: smaller, safer migration; unblocks legacy-engine removal now; pipeline expansion can be revisited later as standalone work.

**Recommended / Agreed Direction:** Option B. Human re-scoped the appointment list query to Base-supported filters only (2026-06-26).

## High-Level Steps

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
   - final: `['appointmentId', 'customerId', 'notes']`;
   - do not search `Address` snapshot JSON. Raw snapshot keyword search can match constant JSON keys such as `Phone`, `Line`, `Email`, `Address`, `Location`, and `Customer`.
   - customer-name keyword search requires a real queryable column or read-pipeline extension and is out of scope.
4. Update `api/appointments/index.ts`:
   - import `okPaged`;
   - return `okPaged(items, pagination)`.
5. Confirm physical Appointments sheet column order:
   - A-O must match the contract key order used by `deriveGVizColumns`;
   - `DeletedAt` and `DeletedBy` are appended at P/Q.
6. Run verification:
   - `npx tsx server/modules/appointments/appointment.transformer.dry-test.ts`
   - `npm run typecheck:api`
7. Remove duplicate appointment schema surfaces after the new module path is green:
   - `server/modules/appointments/appointment-db.schema.ts`
   - legacy flat `appointmentApiSchemas` bundle in `contracts/appointments/appointment-api.schema.ts`
8. Remove legacy engine only after `appointment.module.ts` has no legacy imports and typecheck is green:
   - `server/shared/sheet-crud/`
   - `server/shared/google-sheets/`
   - `server/shared/repositories/base-sheet.repository.ts`
9. Re-run verification after legacy removal:
   - transformer dry test;
   - `npm run typecheck:api`;
   - repository dry tests if imports or shared repository code changed.

## Contracts

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

**Proposed module wiring**

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
  searchFields: ['appointmentId', 'customerId', 'notes'],
})
```

`Address` must stay out of `searchFields`. At query time it is still raw serialized DB snapshot JSON, not the transformed flat API `address`.

### Contract Decisions

- **List query** is scoped to Base-supported fields only (`keyword`, `customerId`, `appointmentDate`, `status`, `page`, `perPage`, `sortBy`, `sortOrder`). Removed for this migration: `dateFrom`, `dateTo`, `orderId`, `includePending`, `appointmentType`, `timeSlot`, `serviceTier`. Sort fields: `appointmentDate`, `timeSlot`, `status`.
- **API create** must include flat customer snapshot fields (`customerName`, `customerCode`, `phone`, `address`, `location`), all `.trim().min(1)`. The request transformer packs them into DB `Address` JSON, then removes helper fields before Apps Script receives the payload.
- **API update** does **not** expose `address` or `serviceTier`. Mutable fields: `appointmentType`, `appointmentDate`, `timeSlot`, `status`, `pickupOrderId`, `deliveryOrderId`, `notes`, `updatedBy`.
- **API response (list)** includes flattened snapshot fields `customerName`, `customerCode`, `phone`, `address`, `location`. Detail/create/update extend list with `pickupOrderId`, `deliveryOrderId`, `serviceTier`.
- **DB contract** stays a DB/AppScript contract, not an intermediate transformer contract. DB `Address` is the real sheet column storing a customer snapshot JSON string. `appointmentDbCreateRequestSchema` requires final DB `Address`. The DB update schema may still include `Address` because it describes DB capability/standard, even though API update does not expose `address`.

## Functional Flow

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

**Detail**

```text
GET /api/appointments/[id]
-> appointmentApiContract.params.detail parse
-> GSheetRepository.getById
-> transformer.response flattens Address snapshot
-> mapper.toApi
-> BaseCrudService.project(detail response)
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

## Data Flow

```text
Create:
API payload (flat snapshot fields)
-> Mapper.toDb (rename API keys -> DB keys)
-> transformer.request (pack helper fields -> DB Address JSON, drop helpers)
-> Apps Script APPEND payload

Read/Detail/Create/Update response:
DB row (Address = snapshot JSON string)
-> transformer.response (parse Address JSON -> flat customerName/customerCode/phone/Address/location)
-> Mapper.toApi (map DB keys -> API keys; unmapped keys pass through via map[key] ?? key)
-> BaseCrudService.project (list vs detail shape)
```

## Files / Modules To Change

- `server/modules/appointments/appointment.module.ts` — rewire to `GSheetRepository` + `BaseCrudService` + transformer.
- `api/appointments/index.ts` — `okPaginated` -> `okPaged`.
- `server/modules/appointments/appointment.transformer.ts` + `.dry-test.ts` — keep; change only if review finds a bug.
- `api/appointments/[id].ts` — exercised, no code change expected.

**Removals (after the new path is green):**

- `server/modules/appointments/appointment-db.schema.ts` (duplicate/divergent row schema).
- legacy flat `appointmentApiSchemas` bundle in `contracts/appointments/appointment-api.schema.ts`.

**Removals (after no legacy consumer remains):**

- `server/shared/sheet-crud/`
- `server/shared/google-sheets/`
- `server/shared/repositories/base-sheet.repository.ts`

## Transformer Status

Implemented and pushed in `d655ca4 Prepare appointment transformer`.

Verified:

```text
npx tsx server/modules/appointments/appointment.transformer.dry-test.ts
26 appointment transformer dry tests passed
```

- **Request transformer:** runs only for `operation === 'create'`; input is already mapper-to-DB data; packs helper fields into DB `Address` JSON (`customerName -> CustomerName`, `customerCode -> CustomerLabel`, `phone -> Phone`, `address -> Address`, `location -> Location`; `Facebook`/`Line`/`Whatsapp`/`Email` empty for now); removes helper fields (`customerName`, `customerCode`, `phone`, `location`) before forwarding; leaves non-create requests unchanged.
- **Response transformer:** runs before `mapper.toApi()`; supports read arrays and create/update/detail objects; parses DB `Address` JSON snapshot and flattens to `customerName`, `customerCode`, `phone`, `Address` (DB key, later mapped to API `address`), `location`; missing/empty snapshot fields become `null`; legacy plain string / invalid / non-object `Address` falls back to address text; does not mutate input rows.

## Load-Bearing Mapper Assumption

`customerName`, `customerCode`, `phone`, and `location` reach the API response **only** because they are absent from `fieldMap`, and `Mapper.toApi()` passes unmapped keys through with `map[key] ?? key`.

Keep a mapper-integration dry test for this behavior. If mapper behavior changes later, appointment response projection can silently drop flattened snapshot fields.

## Edge Cases

> Re-check this list every time the plan changes.

**Transformer request**

- Create packs flat snapshot fields into DB `Address` JSON.
- Create removes helper fields before Apps Script payload.
- Create does not mutate input request data.
- Create rejects missing/blank required snapshot fields.
- Non-create requests return unchanged.
- Mapper integration is covered: API payload -> `Mapper.toDb()` -> transformer.

**Transformer response**

- Read `[]` returns `[]`.
- Multi-row arrays transform each row independently.
- Valid snapshot JSON flattens customer fields.
- Missing `Address` returns all derived fields as `null`.
- Empty/whitespace `Address` returns all derived fields as `null`.
- Missing/empty/non-string snapshot field values normalize to `null`.
- Legacy plain string/invalid/non-object `Address` falls back to address text.
- Input row is not mutated.
- Mapper integration is covered: transformed DB row -> `Mapper.toApi()`.
- Mapper pass-through preserves flattened `customerName`, `customerCode`, `phone`, and `location`.

**Module migration**

- `getById` not found -> 404 through `BaseCrudService`.
- duplicate id rows -> 409 through `BaseCrudService`.
- Detail `GET /api/appointments/[id]` response flattens customer snapshot and includes detail-only fields `pickupOrderId`, `deliveryOrderId`, `serviceTier`.
- Detail legacy/plain-string `Address` returns address text while derived `customerName`, `customerCode`, `phone`, and `location` are `null`.
- PATCH response flattens customer snapshot from returned DB row and includes `pickupOrderId`, `deliveryOrderId`, `serviceTier`.
- PATCH legacy/plain-string `Address` returns address text while derived `customerName`, `customerCode`, `phone`, and `location` are `null`.
- `okPaged` response meta is `{ page, perPage }`.
- `okPaginated` must not remain in appointments index route.
- `APPSCRIPT_APPOINTMENT_URL` must not be used by new appointment module.
- `appointment.module.ts` must not import `sheet-crud`.
- Physical Appointments sheet columns A-O match contract order; appended `DeletedAt`/`DeletedBy` are P/Q.

## Decisions & Rejected Alternatives

> Never delete a rejected direction or its reason silently — a silent deletion is how a later agent loops back to a structure the team already ruled out.

- **Rejected:** extend Base read pipeline for range/OR filters in this migration.
  - Reason: Human re-scoped appointment list query to Base-supported filters only.
- **Rejected:** request transformer looks up customer by `customerService.getById`.
  - Reason: appointment creation happens from the customer page, so frontend can send the snapshot fields directly.
- **Rejected:** adding flat helper fields to DB create schema.
  - Reason: DB schema must represent final DB/AppScript payload, not transformer intermediate data.
- **Rejected:** removing `Address` from DB update schema only because API update does not expose address.
  - Reason: DB schema describes DB capability/standard, not API projection.
