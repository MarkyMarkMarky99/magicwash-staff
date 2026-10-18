# Brief — shared shop device + staff card operator

Do NOT spawn subagents or delegate. Do the work yourself in this worktree. Do not commit.
Implement exactly the spec below. Do not invent mechanisms that are not described. If something in
the code contradicts the spec, stop and report it instead of improvising.

## Goal
A shared shop device signs in with one Google account whose Staff row has Role `device`. Each
employee scans a personal staff card (barcode gun) to become the "operator". The server records the
operator — never a client-sent name — as the actor of every write.

## Server

1. `server/shared/auth/staff-list.ts`
   - `StaffMember.role`: `'admin' | 'staff' | 'device'`. Add optional `cardCode?: string`.
   - `parseStaffList` accepts role `device`. Read optional header `CardCode` (missing column = no
     cards, not an error). Store `cardCode` trimmed; empty → undefined.
   - Read range `A:J` instead of `A:I`.
   - Export `findStaffById(staffId)` and `findStaffByCardCode(code)` (case-insensitive, trimmed),
     both over `getStaffList()` values, returning `StaffMember | undefined`.
2. Gateway operator resolution in `server/shared/http/api-gateway.ts`, after authentication, only
   when the authenticated staff has role `device` and the module is not `auth` or `staff`:
   - Read header `x-operator-id`. If present, `findStaffById` it; unknown/inactive → throw
     `ApiError.forbidden('Operator is not an active staff member')`.
   - Valid operator → `req.staff` becomes `{ ...operator, role: 'staff', cardCode: undefined }`
     (an admin operator never gets admin rights on the device).
   - No header: `GET` passes with the device row as `req.staff`; any other method throws
     `ApiError.forbidden('Scan a staff card first')`.
3. `contracts/auth/auth-api.schema.ts`: role enum adds `device`. `/api/auth/me` must never return
   `cardCode` (strip it).
4. New route `GET /api/auth/card?code=<code>` in `server/modules/auth/auth.module.ts`: allowed only
   when `req.staff.role` is `device` or `admin` (else forbidden); returns `{ staffId, name }` of the
   matching card or `ApiError.notFound('Card not found')`. Add its response schema to the auth
   contract.
5. Staff module (`server/modules/staff/`, `contracts/staff/`):
   - Role values accept `device` wherever an approved role is parsed/validated.
   - `CardCode` must never appear in any `/api/staff` response.
   - New admin-only action that issues a card: sets the row's `CardCode` to `MWS-` +
     `generateShortId()`, overwriting any old code (old card stops working), calls
     `invalidateStaffListCache()`, returns `{ staffId, cardCode }`. Follow the module's existing
     route/action style for where it lives.
6. Actor from session everywhere: in every server module handler that writes an actor taken from
   the request body (`scannedBy`, `createdBy`, `updatedBy`, `deletedBy`, and similar `*By`),
   replace the body value with `req.staff.staffId` before calling the service (unauthenticated →
   `ApiError.unauthorized()`). Keep API request schemas unchanged — clients still send the field,
   it is just ignored. Cover at least: job-tickets advance + start-order, packaging-bags,
   laundry-photos, after-photos, order-images, work-orders, order-items, bag-items, customers,
   payments, packages, issue-reports. WashQueue and complete-order already use `req.staff`; keep
   them. Report the full list you changed and any write you found that you left alone and why.

## Client

7. `src/shared/config/actor.ts`: add operator state alongside the signed-in id:
   `setOperator(op: { staffId: string; name: string } | null)`, `currentOperatorId()`.
   `currentActor()` returns the operator's staffId when set, else the signed-in id.
8. `src/shared/api/firebase-auth.ts` `authFetch`: when `currentOperatorId()` is set, add header
   `X-Operator-Id`.
9. Operator store `src/data/operator/operator.store.ts` (Pinia):
   - State `{ staffId, name, scannedAt }`, persisted in `localStorage` (wrap in try/catch).
   - Expires exactly 1 hour after `scannedAt`; a new card scan replaces it immediately. Check
     expiry on a 30-second timer and on load; expired → cleared.
   - Mirror into `setOperator(...)` synchronously. Cleared on sign-out.
   - `scanCard(code)` calls `GET /api/auth/card`; not found → error notice in Thai
     `ไม่พบบัตรพนักงานนี้`.
10. `src/shared/utils/staff-card.ts`: `isStaffCardCode(code)` = trimmed, case-insensitive prefix
    `MWS-`.
11. Move `src/features/job-tickets/composables/useScannerGunInput.ts` to
    `src/shared/composables/useScannerGunInput.ts` (update imports). Add optional third param
    `{ staffCards?: 'skip' | 'only' }`, default `'skip'`: `'skip'` never passes staff-card codes to
    `onScan`; `'only'` passes only staff-card codes.
12. In `src/App.vue` (or the existing signed-in layout), when the auth store role is `device`:
    mount `useScannerGunInput(operatorStore.scanCard, true, { staffCards: 'only' })` and show a
    fixed, prominent banner `ผู้ใช้งาน: <name>` or, with no operator, `ยิงบัตรพนักงานก่อนทำงาน`.
    Plain styling with existing color tokens; no new design work.
13. `src/data/auth/auth.store.ts`: accept role `device`; `isAdmin` stays false for it.

## Tests and docs
- Add dry-tests mirroring existing ones (look at `tests/` layout) for: `parseStaffList` with
  device + CardCode + missing CardCode column; gateway operator resolution (valid, unknown, missing
  on POST, missing on GET, admin operator capped to staff, auth module bypass); one module
  handler proving a body `scannedBy` is replaced by `req.staff.staffId`; operator store 1-hour
  expiry and replace-on-scan; `isStaffCardCode`; `useScannerGunInput` skip/only.
- Update the canonical docs: `docs/features/staff/registration.md` (device role, cards),
  backend operations doc for actor-from-session, and add `docs/features/staff/shared-device.md`
  describing the operator flow. Prose only, no test data in docs.

## Gates (run all, report output)
`npm run typecheck:api`, `npm run typecheck:web`, the repo's dry-test command, `npx vite build`.

## Report
Files changed, the actor-replacement list (item 6), anything skipped, gate results.
