# Problem Discovery

**Status:** Phase 1 Confirmed
**Related Module:** appointments / engine-migration (legacy sheet-crud -> repositories + BaseCrudService)
**Created by:** CLAUDE
**Date:** 2026-06-24

> Process & gates: see the collaborative-workflow `SKILL.md`.
> Gate: Human confirmed the problem, goal, scope, and requirements (2026-06-24, re-scoped 2026-06-26).

## Problem Statement

`appointments` is the last module still using the legacy `server/shared/sheet-crud/` flow. Keeping it on the legacy flow blocks removal of `sheet-crud`, `google-sheets`, and `base-sheet.repository.ts`, and leaves two divergent engines in the codebase.

The earlier capability-gap direction changed. This migration will **not** extend the Base read pipeline. Appointment list filters were re-scoped to fields the current Base read flow already supports.

## Current Behavior

- `server/modules/appointments/appointment.module.ts` still imports `createGoogleSheetRepository` and `createSheetService`.
- `customers` already runs on the new stack: `GSheetRepository` + `BaseCrudService` + `ModuleContract`.
- `api/appointments/index.ts` returns `okPaginated`.
- The appointment transformer is already implemented and pushed (`d655ca4`), but the module is not yet wired to it through the new stack.

## Goal / Success Criteria

- `appointments` runs on the new stack:
  - `GSheetRepository`
  - `BaseCrudService`
  - `appointmentContract = { api, db }`
- No production appointment module imports `server/shared/sheet-crud/`.
- GET route uses `okPaged`, not `okPaginated`.
- `npm run typecheck:api` passes after module migration.
- Transformer stays wired and covered by dry tests.

## Scope

**In Scope**

- Use existing `contracts/appointments/appointment-api.schema.ts` nested `appointmentApiContract`.
- Use existing `server/modules/appointments/appointment.contract.ts` `appointmentContract`.
- Wire `server/modules/appointments/appointment.module.ts` to:
  - `new GSheetRepository({ contract: appointmentContract, ..., transformer: createAppointmentTransformer() })`
  - `new BaseCrudService({ repository, api: appointmentContract.api, searchFields })`
- Use shared `APPSCRIPT_URL`.
- Update `api/appointments/index.ts` from `okPaginated` to `okPaged`.
- Exercise `api/appointments/[id].ts` through the migrated service. No code change is expected because `BaseCrudService` already exposes `getById` and `update`.
- Keep `server/modules/appointments/appointment.transformer.ts` and its dry tests.
- Remove duplicate/legacy appointment schema surfaces after the module switch:
  - `server/modules/appointments/appointment-db.schema.ts`
  - legacy flat `appointmentApiSchemas` bundle in `contracts/appointments/appointment-api.schema.ts`
- Remove legacy engine after appointments has no remaining legacy consumer:
  - `server/shared/sheet-crud/`
  - `server/shared/google-sheets/`
  - `server/shared/repositories/base-sheet.repository.ts`

**Out of Scope**

- Extending `ReadQueryDTO`, `GVizQueryBuilder`, or Base read pipeline for range/OR filters.
- DELETE / soft-delete API.
- Frontend appointment feature migration.
- Real Apps Script deployment changes.
- Runtime validation of `db.request.*` / `db.response.*` schemas. This is future engine work and is also noted in `MEMORY.md`.

## Requirements / Constraints

**Functional**

- Migrated appointment module produces the same API behavior through the new stack (list / detail / create / update).
- GET route returns the `okPaged` envelope (`meta = { page, perPage }`).
- Keyword search is limited to real queryable columns; the `Address` snapshot JSON must not be searched.

**Non-Functional**

- `npm run typecheck:api` passes after each migration step.
- Module wiring mirrors the migrated `customers` reference.
- No new sources of truth: duplicate/legacy schema surfaces are removed, not left orphaned.
