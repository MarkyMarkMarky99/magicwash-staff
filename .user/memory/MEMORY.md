# User Memory

## Future API Engine Work

- DB request/response schemas in `ModuleDbContract` should eventually be enforced at runtime.
- Current repository flow uses `db.row`, `db.fieldMap`, and `db.primaryKey` at runtime, but does not parse/validate:
  - `db.request.create`
  - `db.request.update`
  - `db.response.read`
  - `db.response.create`
  - `db.response.update`
- Intended future behavior: after `mapper.toDb()` and `transformer.request`, validate the final DB/AppScript request body against the matching `db.request.*` schema before `execute/write`.
- Intended future behavior: after storage returns data and `transformer.response` runs, validate DB response shape against the matching `db.response.*` schema before `mapper.toApi()`.
- This is intentionally out of scope for the current appointment migration.

## Appointment Migration Handoff - 2026-06-27

- Current branch: `feature/appointments-module-migration`.
- Last pushed commit: `d655ca4 Prepare appointment transformer`.
- Git status was clean after push.

### Completed

- Appointment transformer implemented:
  - File: `server/modules/appointments/appointment.transformer.ts`
  - Dry tests: `server/modules/appointments/appointment.transformer.dry-test.ts`
- Transformer request flow:
  - API create now sends required flat snapshot fields:
    `customerName`, `customerCode`, `phone`, `address`, `location`.
  - Request transformer packs those fields into DB `Address` JSON snapshot.
  - It removes helper fields before forwarding payload to Apps Script.
  - Non-create requests are returned unchanged.
- Transformer response flow:
  - Parses DB `Address` JSON snapshot.
  - Flattens to `customerName`, `customerCode`, `phone`, `address`, `location`.
  - Supports read arrays and create/update/detail objects.
  - Does not mutate input rows.
  - Missing/empty snapshot fields become `null`.
  - Legacy plain string/invalid/non-object `Address` falls back to address text.
- API create contract updated in `contracts/appointments/appointment-api.schema.ts`:
  - Required `.trim().min(1)` fields: `customerName`, `customerCode`, `phone`, `address`, `location`.
  - `address` removed from API update contract earlier.
- `server/modules/appointments/appointment.contract.ts` DB create schema remains DB/AppScript payload contract:
  - It keeps `Address` as required JSON string.
  - It does not include flat helper fields.

### Verified

- Passed:
  - `npx tsx server/modules/appointments/appointment.transformer.dry-test.ts`
  - Result: `26 appointment transformer dry tests passed`
- Known failing check:
  - `npm run typecheck:api` still fails because `server/modules/appointments/appointment.module.ts`
    remains on legacy `sheet-crud` and still references old filters/contracts.
  - This is expected until the appointment module is migrated.

### Next Steps

1. Return to `.agent-docs/appointment-module-new-flow-refactor/`.
2. Phase 2 plan has been migrated to the new workflow folder, updated with Claude review feedback, and approved by the human on 2026-06-28.
3. Commit and push the Phase 2 docs before starting Phase 3 implementation.
4. Migrate `server/modules/appointments/appointment.module.ts`:
   - Replace legacy `sheet-crud` wiring with `GSheetRepository + BaseCrudService`.
   - Use `appointmentContract`.
   - Pass `transformer: createAppointmentTransformer()` to `GSheetRepository`.
   - Use shared `APPSCRIPT_URL`.
   - Set `searchFields` for keyword intentionally.
5. Update route `api/appointments/index.ts`:
   - Replace `okPaginated` with `okPaged`.
6. After module wiring:
   - Run `npm run typecheck:api`.
   - Run transformer dry test again.
   - Then decide when to remove legacy `server/shared/sheet-crud`, `server/shared/google-sheets`, and `server/shared/repositories/base-sheet.repository.ts`.
