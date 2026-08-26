# Appointment schema alias cleanup

## Scope

Remove the duplicate export names `appointmentCreateSchema` / `appointmentUpdateSchema` from
`contracts/appointments/appointment-api.schema.ts` and repoint their 2 importers to the canonical
`createAppointmentRequestSchema` / `updateAppointmentRequestSchema`. Pure rename, zero behavior change.

## Functions

```
editContract(contracts/appointments/appointment-api.schema.ts) -> void
 L delete line 56                          # exact text: export const appointmentCreateSchema = createAppointmentRequestSchema
 L delete line 77                          # exact text: export const appointmentUpdateSchema = updateAppointmentRequestSchema
 L do not touch line 41, 62, 141-155       # canonical defs + appointmentApiContract nest stay byte-identical
 L do not touch appointmentCreateResponseSchema / appointmentUpdateResponseSchema  # different pair, out of scope
```

```
editFrontendService(src/features/appointments/services/appointment.service.ts) -> void
 L in the import block from '@contracts/appointments/appointment-api.schema'
    L replace member `appointmentCreateSchema,` -> `createAppointmentRequestSchema,`
    L replace member `appointmentUpdateSchema,` -> `updateAppointmentRequestSchema,`
    L keep all other members and their order unchanged
 L line 18: type AppointmentCreateRequest = z.input<typeof createAppointmentRequestSchema>
 L line 19: type AppointmentUpdateRequest = z.input<typeof updateAppointmentRequestSchema>
 L line 83: requestSchema: createAppointmentRequestSchema,
 L line 97: requestSchema: updateAppointmentRequestSchema,
 L keep type alias names AppointmentCreateRequest / AppointmentUpdateRequest unchanged
```

```
editWriteFixtures(tests/server/unit/modules/appointments/appointment-write.fixtures.ts) -> void
 L in the import block from '../../../../../contracts/appointments/appointment-api.schema.js'
    L replace member `appointmentCreateSchema,` -> `createAppointmentRequestSchema,`
    L replace member `appointmentUpdateSchema,` -> `updateAppointmentRequestSchema,`
    L keep the `.js` extension on the specifier
 L type AppointmentCreateRequest = z.input<typeof createAppointmentRequestSchema>
 L type AppointmentUpdateRequest = z.input<typeof updateAppointmentRequestSchema>
 L keep exported fixture arrays/types unchanged  # appointment.transport.dry-test.ts consumes those names
```

```
verify() -> void
 L grep -rn "appointmentCreateSchema\|appointmentUpdateSchema" src/ server/ contracts/ tests/ api/
    L expect 0 matches   # excluding .worktrees/
 L npx tsx tests/server/unit/contracts/appointments/appointment-api.schema.dry-test.ts
 L npx tsx tests/server/unit/modules/appointments/appointment.transport.dry-test.ts
 L npm run typecheck:api
 L npm run build
 L git diff --stat
    L expect exactly 3 files changed
```

## Edge Cases

editContract
- deleting more than those 2 lines -> revert, redo
- reformatting/re-sorting the file -> forbidden, diff must be exactly 2 deleted lines
- `Object.entries(appointmentApi)` walk in appointment-api.schema.dry-test.ts loses 2 entries -> no action; both aliases are object schemas, never passed `isWritableTypeExport`, and `writableTypeExports.length === 1` still holds

editFrontendService
- src/ has no type-check (`npm run build` is esbuild only) -> a missed occurrence ships green; the grep in verify() is the gate, not the build
- rename applied to `appointmentCreateResponseSchema` by loose search/replace -> forbidden, match whole identifier only

editWriteFixtures
- alias identifiers appear only in the import and the two `z.input<typeof …>` lines -> no other line in this file changes
- appointment.transport.dry-test.ts -> unchanged, it imports fixture arrays only

verify
- any match in `.worktrees/grok-picker-redesign/` -> ignore, separate tree, not in scope

## Out of Scope

- `.worktrees/grok-picker-redesign/`
- `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`
- `appointmentCreateResponseSchema` / `appointmentUpdateResponseSchema`
- `server/modules/appointments/*` (consumes `appointmentApiContract.request.*`)
- other modules' `*-api.schema.ts` files
- the writable-vs-readable `appointmentType` enum split

## Status

FINAL
