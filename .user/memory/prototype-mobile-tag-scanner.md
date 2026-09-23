# prototype/mobile-tag-scanner

## Scanner prototype
- Route `/#/tag-scanner`; reads QR Code and Code 128 from the rear camera.
- Scanned values are session-only and are not sent to the scan API yet.
- Preview phone verification still pending.

## Garment tracking design (settled with the user)
- One garment = one tag code, stored as `LaundryPhotos.item_id` when staff scan the tag and then photograph the garment.
- No `Tags` sheet and no Tagging ticket: the before-photo row is the garment's birth record.
- Only `scope: ITEM` tickets exist so far; Logistics and ORDER-scoped tickets are not built.
- Route per `service_type`: WASH = Washing, Packaging; WSIR = Washing, Ironing, Packaging; DRCL = DryCleaning, Ironing, Packaging; IRON = Ironing, Packaging.
- A department may scan a garment only once every lower `step_no` ticket for that tag is Completed.
- Each department scans twice: Pending to In Progress on arrival, In Progress to Completed when done. Confirmed by the user.
- A ticket carries `service_type` rather than `orderitem_id`, so nothing resolves the order line again.
- Provisioning is idempotent, so a garment tagged after approval gets its tickets on a later approval.
- A failed ticket append never rolls back the approved order status; the response carries a certainty instead.

## Built
- `PATCH /api/work-orders/:id` provisions tickets when it becomes `APPROVED`.
- `job-tickets` module: sheet layer, API contract, CRUD routes, and `POST /api/job-tickets/scan` with the step gate.
- Order editing: `PATCH` takes `status`, `receivedDate`, `dueDate`, `quantity`; swipe-left Edit on `OrderCard`; one form for create and edit; approval result shows as a closeable message on order detail.
- Every module mints ids through `shared/utils/id.ts`, which both runtimes import.
- G Drive `JobTicket.json` and the live JobTickets tab carry the 23 agreed columns; the old malformed `spreadsheetId` is corrected.

## Garment registration screen (built 2026-09-23, phone-tested OK on Preview)
- Spec and behaviour: `docs/features/orders/garment-registration.md`; component `GarmentRegistrationCamera.vue` (old camera components untouched).
- Open decision: phone Back still closes the screen while uploads are pending; user not yet asked to block it.
- Once proven on a phone, the old camera component copy can be removed per the user.
- Codex session for this screen: `01a0cd22-c35b-7bb2-8297-11120a74e806`.

## Department work pages (frontend only, in progress)
- `/departments/:department` loads real tickets (Pending, In Progress, Completed today, cap 2000) via existing APIs; awaiting phone test. CANCELLED tab dropped for now.
- Open: completion ring counts only today's completed tickets, so it understates progress; user to decide label vs backend totals.
- Ticket provisioning now defaults `photoEvidenceUrl` to the LaundryPhotos before-photo; staff evidence photos will overwrite it. Order be2f58f2 backfilled.
- Backend later: a worklist read (not-done + done-today, cap 2000) and cancel timestamps; not started, user deferred.

## Scanner engine
- All scanners use `src/shared/utils/barcode-scanner.ts`: native BarcodeDetector on Android, self-hosted zxing-wasm elsewhere; ZXing JS removed.
- Next: department scan still preview-only; wiring POST /api/job-tickets/scan is the next brief.

## Tag ids
- Web now generates 8-char base62 ids via `shared/utils/id.ts`; print server (MagicwashInvoice `baf0899`) prints QR and accepts any text.
- The running print server must be restarted onto `baf0899` before base62 tags print correctly; real-print QR scan test still pending.

## Next
- Decide the order status sequence before any swipe-to-advance work; six statuses exist and no transition rule is defined anywhere.
- Scanner page needs a department selector and a call to `POST /api/job-tickets/scan`.
- Persist tag ids at print time and add a single-tag reprint flow before real use.
- `JOB_TICKETS_SPREADSHEET_ID` is in `.env.local`; confirm Vercel has it too.
- Codex sessions: job tickets `01a0ca04-64c7-7220-a476-dc5cac69ac99`, id helper `01a0ca64-7623-79f1-95b2-57fdb86ad4ac`.
