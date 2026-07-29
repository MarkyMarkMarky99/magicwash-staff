# Bug: New Booking fails for `DELIVERY` and `PICKUP_DELIVERY` (Round)

**Date:** 2026-07-23
**Status:** Identified only — **no code changed yet**
**Scope:** `/new-booking` appointment creation flow
**Method:** Manual import/export trace across `webapp-vue/` + the sibling `appscript/` repos, independently re-verified with `codex exec -s read-only`

## Symptom

On the booking form, `Type: PICKUP` books successfully. `Type: DELIVERY` and `Type: ROUND`
(internal enum `PICKUP_DELIVERY`) always fail.

## Root cause

Full-stack gap, not a single-file bug:

- The Apps Script backend hard-requires a non-empty `deliveryOrderId` when
  `appointmentType` is `DELIVERY` or `PICKUP_DELIVERY`:

  ```js
  // appscript/MagicwashAppointment/API.js:66-74
  function validateOrderIds(data) {
      const type = data.appointmentType;
      if (type === 'DELIVERY' && !data.deliveryOrderId) {
          throw new Error('deliveryOrderId is required when appointmentType is DELIVERY.');
      }
      if (type === 'PICKUP_DELIVERY' && !data.deliveryOrderId) {
          throw new Error('deliveryOrderId is required when appointmentType is PICKUP_DELIVERY.');
      }
  }
  ```
  Called from `doPost` at `API.js:369`. `deliveryOrderId` is normalized to
  `body.deliveryOrderId || ''` just above, at `API.js:352-362`.

- The frontend booking form never collects or sends `deliveryOrderId` (or `pickupOrderId`)
  at all — a repo-wide scan of `webapp-vue/src` (99 files) found **zero** occurrences of
  either field. `PICKUP` has no such server-side requirement, so it always succeeds; the
  other two always fail with the same "missing deliveryOrderId" error.

## Confirmed live flow (file:line)

1. `src/features/customers/components/CustomerCard.vue:38-43` and
   `OrderHistoryCustomerCard.vue:19-22` → `router.push('/new-booking')`
2. `src/router/index.js:56-65` → `/new-booking` renders `BookingFormPage.vue` with
   `mode: 'new-booking'`
3. `src/pages/BookingFormPage.vue:7-9,49-80` → renders `AppointmentScheduleForm.vue`,
   reads its exposed `.data`, calls
   `createAppointment(customerId, date, time, serviceType, notes)` — 5 args, no order id
4. `src/components/forms/AppointmentScheduleForm.vue:20-24,95-115` — the `new-booking`
   `data` object only ever has `customerId, date, time, serviceType, notes`; there is no
   UI field anywhere in this form to pick/enter a pickup or delivery order
5. `src/composables/useAppointmentStore.js:148-167` — `createAppointment()` builds the
   POST body from exactly those 5 fields; no `deliveryOrderId`/`pickupOrderId` key exists
   in the payload, so nothing upstream could supply one even if it wanted to
6. Posts to `APP_CONFIG.APPOINTMENTS_SCRIPT_URL`
   (`src/utils/constants.js:1-5`, from `VITE_APPOINTMENTS_SCRIPT_URL` in `.env.local`) →
   the `appscript/MagicwashAppointment` Apps Script project → rejected by
   `validateOrderIds` (see above)

`deliveryOrderId`/`pickupOrderId` do exist elsewhere, but on paths that don't feed this
flow:
- `contracts/appointments/appointment-api.schema.ts:34-50` (optional, in the newer API
  contract)
- `server/modules/appointments/appointment.contract.ts:67-85` (server module mapping)
- `appscript/MagicwashAppointment/API.js:162-180,225-274` (sheet read/write columns)

That newer backend module is server-wired (`server/api/route-registry.ts:3-10`,
`server/shared/http/crud-routes.ts:15-40`), but its only current frontend consumer is the
read-only `GET /api/appointments` waiting-pickup list
(`src/features/customers/services/waiting-pickup.service.ts:11-20`) — it plays no role in
appointment creation today.

## Caveats

- **Live deployment identity unverified.** `appscript/MagicwashAppointment/.clasp.json`
  only records a `scriptId`, not a deployment ID or version. The source in this folder is
  a very strong match (only project with `PICKUP_DELIVERY`, `deliveryOrderId`, matching
  sheet columns), but confirming the *exact* code behind the live `/exec` URL needs
  `clasp deployments` or the Apps Script console.
- **Unrelated second bug found in a dead code path.** `src/pages/FormOverlayPage.vue:49-73`
  is an alternate, currently-unreachable booking path (no button links to
  `/forms/appointment-schedule-form` today) that posts through `src/utils/gateway.js` to a
  different Apps Script project ("MagicwashGateway"). That path is independently broken —
  it sends target `Appointments` (plural) while the gateway's schema registry key is
  singular `Appointment`, with different (PascalCase) field names
  (`appscript/SheetLib/Schema.js:215-240`, `Handler.js:19-30`). Not the cause of the
  reported bug; noted here in case that path is ever revived.

## Not done in this pass

No fix has been applied. Fixing this needs a product decision first — the form has no
concept of "which order is this delivery for" today, so it needs either:
- a pickup/delivery order picker added to `AppointmentScheduleForm.vue` and wired through
  `useAppointmentStore.js`, or
- relaxing `validateOrderIds` in `appscript/MagicwashAppointment/API.js` so the order id
  can be attached later via reschedule/update instead of required at creation.
