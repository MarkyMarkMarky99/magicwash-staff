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

## Agreed changes not yet made
- Tag codes move from 8 decimal digits to 8 base62 characters. This cannot ship from this repo alone: the print server strips non-digits (`C:/MagicwashInvoice/server.js:274-276`) and validates 8 digits, so the generator, `laundry-tag-print.schema.ts` and that repo must change together, most likely when the label becomes a QR code.

## Next
- Decide the order status sequence before any swipe-to-advance work; six statuses exist and no transition rule is defined anywhere.
- The tagging flow must write the scanned tag into `LaundryPhotos.item_id`. Until it does, approving an order provisions no tickets at all.
- Scanner page needs a department selector and a call to `POST /api/job-tickets/scan`.
- Persist tag ids at print time and add a single-tag reprint flow before real use.
- `JOB_TICKETS_SPREADSHEET_ID` is in `.env.local`; confirm Vercel has it too.
- Codex sessions: job tickets `01a0ca04-64c7-7220-a476-dc5cac69ac99`, id helper `01a0ca64-7623-79f1-95b2-57fdb86ad4ac`.
