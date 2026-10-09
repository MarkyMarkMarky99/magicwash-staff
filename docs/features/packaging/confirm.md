# Packaging bags — API contract

`POST /api/packaging-bags/confirm` requires approved staff. The module lives in
`server/modules/packaging-bags/`; the contract is
`contracts/packaging-bags/packaging-bag-api.schema.ts`. The single catch-all gateway dispatches it.

Request: `{ orderId, createdBy, bags: [{ orderImageId, imagePath, laundryItemIds }] }`.
There are 1–20 bags, each with at least one garment and an http(s) photo URL. Bag IDs are unique
eight-character lowercase hexadecimal short IDs generated on the device; all-digit and
digits-e-digits IDs are excluded so Sheets retains text. Garments cannot repeat in the request.

At the start, JobTickets, BagItems, and OrderImages are each read once by order_id in parallel.
The ticket snapshot serves validation, transition gating, LOG-BAG existence, and customer data.
Existing images are matched by id in memory. No OrderForm or WorkTransactions read is made.
This order-filtered image read cannot detect a bag ID belonging to another order. The append
repository checks only duplicate IDs within the submitted batch, so cross-order ID collisions
are not rejected by this flow. Preserving the previous cross-order check would require an
unfiltered image read or another lookup.

Before any write, every garment must have a non-deleted Packaging ITEM ticket in the order,
must not belong to another bag, and must pass the same earlier-step gate as ticket advancement.
Existing images and bag assignments must match the retry. Invalid requests return 422;
conflicting assignments or unfinished work return 409 with a staff-readable message.

Writes run in order: batch append missing BAG OrderImages, batch append missing BagItems,
provision missing LOG-BAG tickets, and complete Packaging ITEM tickets through
JobTicketTransitionService using the already-read tickets, with Pending and In Progress as
allowed sources for one direct transition to Completed. Missing LOG-BAG rows copy customer_id,
order_name, due_date, and notes from existing order tickets and append in one batch using the
same row builder as WEIGHT. Completed tickets are not completed again and earn nothing on retry.
EARN repair is intentionally dropped: a failed score write is logged, does not fail Confirm or
skip printing (the tickets are already Completed), and requires admin help. Newly Completed
tickets earn through the shared score writer with generated IDs. BagItems IDs use `<bagId>-<garmentId>`. Repository audit stamps append times.
No BAG create enum is added to the order-images API and no WEIGHT side effects run.

A write failure returns 500 and asks staff to press Confirm again. Rows are never rolled back;
retries read the landed rows and append or update only missing work. Reads and writes remain
separate operations in Sheets, so concurrent confirmations are not an atomic transaction.

After every write succeeds, tags print when `BAG_TAG_PRINT_ENABLED=true`. The bag-tag request
contains `qrValue` (tracking prefix plus bag ID), `barcodeValue` (bag ID), resolved nullable
`customerIndex`, `weightKg: null`, the bag's positive `itemCount`, and Bangkok `packedAt`.
Customer ID comes from the ticket snapshot; customer index is resolved once for all bags.
One print request is sent per bag. Print failures are logged and do not fail confirmation.

Response in the normal success envelope: `{ bags: [{ orderImageId, printed }] }`.
There is no print receipt ledger; retrying a successfully saved confirmation can print again.

The shared bag-tag print contract requires `weightKg` (null or greater than 0 and less than 1000),
`itemCount` (null or a positive integer), and `packedAt` (`yyyy-MM-dd HH:mm:ss`). WEIGHT sends
its saved weight, null item count, and its image creation time as packedAt. The print response
is unchanged. The separate printer project must accept this request shape.
