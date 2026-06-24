# APPOINTMENTS_MODULE_MIGRATION_PLAN

**Status:** Step 1 - Awaiting Human Confirmation  
**Related Module:** appointments  
**Created by:** CODEX  
**Date:** 2026-06-24

> Process and gates: `.claude/skills/collaborative-workflow/SKILL.md`.
> Do not write the implementation approach until the Step 1 Human gate passes.

---

## Problem & Objective

### Problem Statement

`server/modules/appointments/appointment.module.ts` still uses the legacy
`createGoogleSheetRepository` and `createSheetService` factories. It therefore
does not use the contract-driven `GSheetRepository`, `BaseCrudService`, and
`ModuleContract` flow already established by customers.

The migration cannot be a direct wiring replacement because the current
appointment list contract contains behavior the new `ReadQueryDTO` explicitly
does not support:

- `dateFrom` / `dateTo` build a date range.
- `includePending` widens that range with an OR condition.
- `orderId` matches either `pickupOrderId` or `deliveryOrderId`.

The appointment route also returns the legacy paginated response through
`okPaginated`, while the new service flow returns only `page` and `perPage`
through `okPaged`.

### Goal / Success Criteria

- Appointments use the same contract bundle, repository, service, and route flow
  as the migrated customers module.
- Existing appointment create, update, get-by-id, list projection, search,
  filtering, sorting, and pagination behavior remains explicit and tested.
- DB field names remain inside the repository boundary; service and routes use
  API/domain field names only.
- Appointment runtime wiring no longer imports from `shared/sheet-crud` or
  `shared/google-sheets`.
- `npm run typecheck:api`, repository/service tests, appointment migration tests,
  and `npm run build` pass.

### Scope

**In Scope**

- Convert the appointment API schemas into `appointmentApiContract`.
- Move the appointment DB schemas and composed contract into
  `server/modules/appointments/appointment.contract.ts`.
- Define `appointmentDbContract` and `appointmentContract` using the shared
  module contract types.
- Replace legacy appointment repository/service factories with
  `GSheetRepository` and `BaseCrudService`.
- Preserve and test current appointment list-query semantics, including range
  and OR behavior.
- Change the appointment list route to the current paged response helper.
- Use the shared `APPSCRIPT_URL` runtime configuration.
- Add compile-time, dry, and module smoke coverage required by the migration.

**Out of Scope**

- Implement repository delete or appointment DELETE routes.
- Change Google Sheets or Apps Script behavior outside the existing contract.
- Change appointment business fields, enum values, or response projections.
- Delete the legacy `shared/sheet-crud` and `shared/google-sheets` directories;
  cleanup happens only after a separate usage audit.
- Migrate any module other than appointments.

### Requirements

**Functional**

- `list(query)` validates the appointment list query and returns
  `{ items, pagination: { page, perPage } }`.
- Keyword search continues to target `appointmentId`, `customerId`, `address`,
  and `notes`.
- Equality filters continue to support `customerId`, `status`,
  `appointmentType`, `timeSlot`, and `serviceTier`.
- `dateFrom` and `dateTo` continue to filter `appointmentDate` inclusively.
- `includePending: true` continues to include `PENDING` rows outside the date
  range; when no range exists it filters to `PENDING` rows.
- `orderId` continues to match either `pickupOrderId` or `deliveryOrderId`.
- `getById`, `create`, and `update` keep the existing API request and response
  schemas and use semantic appointment IDs.
- Omitted optional write fields remain omitted; explicit `null` remains an
  explicit clear operation where the schema permits it.
- Appointment DB responses are mapped to API/domain field names before service
  projection.
- No appointment flow calls `repository.delete()`.

**Non-Functional**

- The complete `appointmentContract` is the module's contract source of truth.
- `appointment.module.ts` contains runtime wiring only.
- Transport details remain inside `GSheetRepository`.
- New query behavior must be generic at the shared DTO/repository boundary; no
  appointment-specific column names may be added to shared infrastructure.
- Tests are written and reviewed before production implementation.
- No backward-compatible constructor or legacy factory adapter is added.

---

## How (Implementation Approach)

> Pending Step 1 Human confirmation.

---

## Activity Log

================================================================================

- [CODEX] [2026-06-24]
**Created Problem Definition (Step 1)**  
Reviewed the current appointment API/DB schemas, legacy module wiring, routes,
`ReadQueryDTO`, `BaseCrudService`, `GSheetRepository`, and the migrated customer
module. Recorded the migration problem, scope, and behavior that must be retained.

**Handoff -> @user**  
Confirm Problem, Scope, and Requirements before solution design begins.

================================================================================
