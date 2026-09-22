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
- A ticket carries `service_type` rather than `orderitem_id`, so nothing resolves the order line again.
- Provisioning is idempotent, so a garment tagged after approval gets its tickets on a later approval.
- A failed ticket append never rolls back the approved order status; the response carries a certainty instead.

## Built
- `PATCH /api/work-orders/:id` updates `status` only, and provisions tickets when it becomes `APPROVED`.
- `job-tickets` module: sheet layer, API contract, CRUD routes, and `POST /api/job-tickets/scan` with the step gate.
- G Drive `JobTicket.json` and the live JobTickets tab carry the 23 agreed columns; the old malformed `spreadsheetId` is corrected.

## Agreed changes not yet made
- Ticket id becomes `XXX-<orderId>-<tagId>` with a three-letter department prefix (WSH, DRC, IRN, PCK, LOG), replacing `orderId:tagId:department`.
- `server/shared/repositories/write-failure.ts` must become the only classifier; move `invoice.service.ts` onto it in its own commit.
- A scan of a Cancelled ticket must return its real status instead of `not_found`; the UI decides how to show it, and history stays visible.
- Tag codes move from 8 decimal digits to 8 base62 characters; at 100 garments a day the current scheme reaches a 50 percent collision chance in about four months.
- Scanning advances Pending to In Progress to Completed, so each department scans twice. The user has not confirmed this.

## Next
- Persist tag ids at print time and add a single-tag reprint flow before real use.
- Scanner page needs a department selector and a gated scan call.
- `JOB_TICKETS_SPREADSHEET_ID=11Xfi6OjBRbjkU-SR564v3XQGWy-zNRE8LRYGmUkFJEk` is not in `.env.local` or Vercel yet, so nothing has touched the live sheet.
- Codex session that built this: `01a0ca04-64c7-7220-a476-dc5cac69ac99`.
