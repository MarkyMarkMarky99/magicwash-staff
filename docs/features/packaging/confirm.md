# Packaging bags — API contract

`POST /api/packaging-bags/confirm` requires approved staff. The module lives in
`server/modules/packaging-bags/`; the contract is
`contracts/packaging-bags/packaging-bag-api.schema.ts`. The single catch-all gateway dispatches it.

Request: `{ orderId, createdBy, bags: [{ orderImageId, imagePath, laundryItemIds, weightKg }] }`.
There are 1–20 bags, each with at least one garment, an http(s) photo URL, and a required nullable `weightKg`
key. Null means an unweighed outbound pack; non-null weight is validated by the same rule as a WEIGHT order image `quantity` (`isValidOrderImageWeight`: greater
than 0, at most 200, at most one decimal place). Bag IDs are unique
eight-character lowercase hexadecimal short IDs generated on the device; all-digit and
digits-e-digits IDs are excluded so Sheets retains text. Garments cannot repeat in the request.

At the start, JobTickets, BagItems, and OrderImages are each read once by order_id in parallel.
The ticket snapshot serves validation, transition gating, LOG-BAG existence, and customer data.
Existing images are matched by id in memory. Apart from the weight-photo ticket step below, no OrderForm or WorkTransactions read is made.
This order-filtered image read cannot detect a bag ID belonging to another order. The append
repository checks only duplicate IDs within the submitted batch, so cross-order ID collisions
are not rejected by this flow. Preserving the previous cross-order check would require an
unfiltered image read or another lookup.

Before any write, every garment must have a non-deleted Packaging ITEM ticket in the order,
must not belong to another bag, and must pass the same earlier-step gate as ticket advancement.
Existing images and bag assignments must match the retry: an existing image must belong to this order with the same photo URL and inferred type. A non-null `weightKg` requires `WEIGHT` with matching numeric `quantity`; null requires `PACK` with blank `quantity` (null, undefined, or empty string). A PACK/WEIGHT type mismatch is a conflict. A legacy `BAG` row with the same id is a conflict. Invalid requests return 422;
conflicting assignments or unfinished work return 409 with a staff-readable message.

A weighed bag is recorded like an order-detail weight photo (see
[Order image](../orders/contracts/order-image.md)): an OrderImages `WEIGHT` row with the photo URL
in `image_path` and kg in `quantity`. An unweighed bag is a `PACK` row with the same photo URL and
null `quantity`. The type is inferred only from whether the weight field is empty after trim;
invalid non-empty text blocks confirmation. Quantity always means kg, never garment count. New bags never write `BAG` rows;
existing `BAG` rows from earlier confirmations stay as they are and are not migrated.

Writes run in order: batch append missing WEIGHT or PACK OrderImages, batch append missing BagItems,
provision missing LOG-BAG tickets, provision the weight-photo ticket and score of each WEIGHT bag only, and
complete Packaging ITEM tickets through
JobTicketTransitionService using the already-read tickets, with Pending and In Progress as
allowed sources for one direct transition to Completed. Missing LOG-BAG rows copy customer_id,
order_name, due_date, and notes from existing order tickets and append in one batch using the
same row builder as WEIGHT. Completed tickets are not completed again and earn nothing on retry.
EARN repair is intentionally dropped: a failed score write is logged, does not fail Confirm or
skip printing (the tickets are already Completed), and requires admin help. Newly Completed
tickets earn through the shared score writer with generated IDs. BagItems IDs use `<bagId>-<garmentId>`. Repository audit stamps append times.
The order-images API is not called; Confirm reuses the WEIGHT side effects of `OrderImageService.create`:

| WEIGHT side effect | Packaging Confirm |
| --- | --- |
| Completed Packaging ORDER ticket `PCK-<orderId>-<bagId>-PCK-WEIGHT-KG` and its EARN (`WeightPhotoTicketService.provision`) | Run once per WEIGHT bag with the same service; PACK skips this per-kg task; an existing ticket id is skipped, so a retry never scores twice. A ticket write failure fails Confirm (500, press Confirm again); an EARN failure is logged and does not. |
| Pending Logistics ticket `LOG-<orderId>-<bagId>-LOG-BAG` | Created once per bag by the Confirm batch (header data from the ticket snapshot); the weight-photo flow is not run for it, so there is no duplicate. |
| Bag tag print | One print per bag, after every write, with `weightKg` (null for PACK) and positive `itemCount`. |

The weight-photo ticket reads OrderForm and WorkRates (rates are cached) once per WEIGHT bag; PACK skips these reads. The other reads
stay as above. The WEIGHT photographer score is in addition to the garment Packaging scores. Both types complete garment tickets and create LOG-BAG tickets.

A write failure returns 500 and asks staff to press Confirm again. Rows are never rolled back;
retries read the landed rows and append or update only missing work. Reads and writes remain
separate operations in Sheets, so concurrent confirmations are not an atomic transaction.

After every write succeeds, tags print when `BAG_TAG_PRINT_ENABLED=true`. The bag-tag request
contains `qrValue` (tracking prefix plus bag ID), `barcodeValue` (`MWB-` plus bag ID), resolved nullable
`customerIndex`, the saved `weightKg` of the bag, its positive `itemCount`, nullable `employeeName`, and Bangkok `packedAt`.
Customer ID comes from the ticket snapshot; customer index is resolved once for all bags.
Employee name is resolved through `StaffService.getById` using the confirmation's `createdBy`.
Names are trimmed and cut to 100 characters. Lookup failures, unknown staff, blank names, or
names containing control characters send null and log `bag_tag_print_failure` with
`failureKind: staff_lookup_error`; they never prevent printing.
One print request is sent per bag. Print failures are logged and do not fail confirmation.

Response in the normal success envelope: `{ bags: [{ orderImageId, printed }] }`.
There is no print receipt ledger; retrying a successfully saved confirmation can print again.

The shared bag-tag print contract requires `weightKg` (null or greater than 0 and less than 1000),
`itemCount` (null or an integer 1–999), `employeeName` (null or a trimmed string of at most
100 characters without Unicode Cc control characters), and `packedAt` (`yyyy-MM-dd HH:mm:ss`).
At least one of `weightKg` and `itemCount` must be non-null; both can be sent together.
`BagTagPrintService.print(image, { itemCount })` supports a count alongside a WEIGHT image's
saved weight, resolves employee name from `image.createdBy`, and uses image creation time as
packedAt. The order-images hook continues calling `print(image)` with a null item count by
default. The order-images HTTP request/response and sheet contracts remain unchanged.
The print response is unchanged.
