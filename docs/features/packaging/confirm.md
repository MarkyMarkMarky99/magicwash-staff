# Packaging bags — API contract

`POST /api/packaging-bags/confirm` requires approved staff. The module lives in
`server/modules/packaging-bags/`; the contract is
`contracts/packaging-bags/packaging-bag-api.schema.ts`. The single catch-all gateway dispatches it.

Request: `{ orderId, createdBy, bags: [{ orderImageId, imagePath, laundryItemIds }] }`.
There are 1–20 bags, each with at least one garment and an http(s) photo URL. Bag IDs are unique
eight-character lowercase hexadecimal short IDs generated on the device; all-digit and
digits-e-digits IDs are excluded so Sheets retains text. Garments cannot repeat in the request.

Before any write, every garment must have a non-deleted Packaging ITEM ticket in the order,
must not belong to another bag, and must pass the same earlier-step gate as ticket advancement.
Existing images and bag assignments must match the retry. Invalid requests return 422;
conflicting assignments or unfinished work return 409 with a staff-readable message.

Writes run in order: batch append missing BAG OrderImages, batch append missing BagItems,
provision missing LOG-BAG tickets, and complete Packaging ITEM tickets through
JobTicketAdvanceService (both hops for Pending). Completed tickets are not completed again.
An interrupted confirmation can repair missing EARN rows for tickets it already completed,
using the same score writer and recorded worker. BagItems IDs use `<bagId>-<garmentId>`;
Packaging confirmation EARN IDs use `EARN-<ticketId>`. Repository audit stamps append times.
No BAG create enum is added to the order-images API and no WEIGHT side effects run.

A write failure returns 500 and asks staff to press Confirm again. Rows are never rolled back;
retries read the landed rows and append or update only missing work. Reads and writes remain
separate operations in Sheets, so concurrent confirmations are not an atomic transaction.

After every write succeeds, tags print when `BAG_TAG_PRINT_ENABLED=true`. The bag-tag request
contains `qrValue` (tracking prefix plus bag ID), `barcodeValue` (bag ID), resolved nullable
`customerIndex`, `weightKg: null`, the bag's positive `itemCount`, and Bangkok `packedAt`.
Print failures are logged and do not fail confirmation.

Response in the normal success envelope: `{ bags: [{ orderImageId, printed }] }`.
There is no print receipt ledger; retrying a successfully saved confirmation can print again.

The shared bag-tag print contract requires `weightKg` (null or greater than 0 and less than 1000),
`itemCount` (null or a positive integer), and `packedAt` (`yyyy-MM-dd HH:mm:ss`). WEIGHT sends
its saved weight, null item count, and its image creation time as packedAt. The print response
is unchanged. The separate printer project must accept this request shape.
