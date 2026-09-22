# prototype/mobile-tag-scanner

## Scanner prototype
- Route `/#/tag-scanner`; reads QR Code and Code 128 from the rear camera.
- Scanned values are session-only and resolve to nothing yet.
- Preview phone verification still pending.

## Garment tracking design (settled 2026-09-22 with the user)
- One garment = one `tag_id`; tracking identity is `order_id` + `tag_id`.
- A tag is registered when Tagging staff scan the tag on the garment and then photograph it.
- Tag codes are generated in the browser and printed as-is, so a lost tag is reprinted with the same code.
- Per-garment tickets are pre-created for every garment when the order reaches `APPROVED`.
- Route per `service_type`: WASH = Washing, Packaging; WSIR = Washing, Ironing, Packaging; DRCL = DryCleaning, Ironing, Packaging; IRON = Ironing, Packaging.
- A department may scan a garment only once every lower `step_no` ticket for that tag is Completed.
- Garments flow independently; QC and Packaging is the order-level convergence, Logistics is `scope: ORDER`.

## Done
- `PATCH /api/work-orders/:id` accepts `status` and `updatedBy` only, no transition guards.
- G Drive `JobTicket.json` and the real `JobTickets` tab now carry `laundry_item_id`, `scope`, `step_no`, `DryCleaning`, `started_at`, `completed_at`, `scanned_by`.
- `JobTicket.json` held a malformed `spreadsheetId`; corrected to the live MagicwashJobTracking workbook.
- Photo sheet columns were left untouched; `item_id` keeps its name and now documents the garment meaning.

## Next
- Decide whether a separate `Tags` sheet is needed or the before-photo row is the tag's birth record.
- Build the job-tickets module: db-contract, repository, API contract, routes, `JOB_TICKETS_SPREADSHEET_ID` in `.env.local` and Vercel.
- Persist tag ids at print time and add a single-tag reprint flow before real use.
- Scanner page needs a department selector and a gated scan call.
