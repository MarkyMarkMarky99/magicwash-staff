# Department work pages

The five department pages use `/departments/:department`: `washing`, `drycleaning`, `ironing`, `packaging`, and `logistics`. These map to the JobTicket department values `Washing`, `DryCleaning`, `Ironing`, `Packaging`, and `Logistics`. An unknown value shows a not-found state.

The shared `src/data/job-tickets/job-ticket.store.ts` owns all ticket rows and view loading, errors,
and cap signals. Order loads merge shared rows without adding older Completed tickets to department
lists. Writes patch the shared rows so every view sees them. Invalidation marks every department stale and reloads the active department
and order views retained by visible pages; deactivated and unmounted pages release their views.

Each department page loads its own work with one `GET /api/job-tickets/department-work?department=X`
when first opened. The server reads that department's JobTickets rows with one GViz query and returns
all non-deleted, non-Cancelled tickets of orders that still have a Pending or In Progress ticket in
the department or a ticket completed today (Bangkok). Older Completed tickets of those orders are
included. The store caches per department, so returning to a department within one hour makes no request; after an hour, or after invalidation or a pull-to-refresh, it reloads in the background while the loaded work keeps showing. Invalidation marks every department stale and reloads only the
active department. If invalidation occurs during a read, its result is discarded and a fresh read
starts after it settles, so in-flight API deduplication cannot reuse the old response. A department
list shows at most 10,000 tickets and shows the incomplete-list warning at that cap. Loading, retry,
and empty states use the list page pattern. Job-ticket GETs bypass the response cache; the resource
store owns reuse. Only the first load blocks the page; loaded work keeps showing while it refreshes.
Washing, Dry Cleaning, Ironing, and Packaging filter the loaded list to scope ITEM before cards,
counts, rings, selection, and scan queues are derived. Their ORDER tickets, including weight-photo
Packaging credit, are hidden. Logistics keeps only non-deleted ORDER-scope Logistics LOG-BAG tickets.
Loaded garment tags are normalized to strings, with numeric tags padded to eight digits and missing tags retained as null so those tickets remain visible.

The `status` query selects ALL, PENDING, IN PROGRESS, or COMPLETED. Tab counts and sorting use the loaded list in memory. For the four garment departments, the `group` query selects `item` for a flat garment grid or defaults to `order` for order cards. Both controls replace the current URL entry. Orders sort by nearest due date. Each order card shows customer, order ID, due date, a completion ring, and counts for the three statuses. The ring starts at 12 o'clock; its head is a second, thinner stroke of fixed length on the same circle, locked to the arc end, carrying the completed percentage and moving with the arc when the value changes. The ring centre shows the customer's `customerIndex` from the preloaded customer store, or `-` when none is found. Tapping the card body expands it to show only garments matching the active tab. Garments use the shared square image card, showing photo evidence when present. Image cards show the image and status badge; their text labels are omitted. A ticket with a `taskCode` also shows it in a small chip at the bottom-left of the card, and the card's accessible name reads `Select tag <tag>, task <taskCode>; current status <status>`. A ticket without a task code shows no chip and no task in its name. A garment with several tasks in the department appears as one card per task, ordered by `stepNo` then `taskCode`, in both the flat grid and an expanded order card.

On the four garment department pages, the item/order grouping buttons are icon-only at every screen width. Their accessible names remain `By item` and `By order`.

Order due dates and customer IDs come directly from the loaded tickets. Names come from the preloaded customer list, falling back to customer ID. The department page does not fetch work-order details.

In the four garment departments, the Pending tab selects jobs to move to In Progress; the In Progress tab selects jobs to complete. Tapping an eligible image toggles its selection and marks it with a lime ring and check badge. The action button shows the selected count and asks for confirmation before one batch submission. All and Completed tabs do not permit image updates or show the scanner button. The selected tickets must have the active tab status in this department. Changing tabs clears the selection after Send or Discard confirmation when anything is pending.

A keyboard-wedge barcode gun can scan directly on the list page in the Pending and In Progress tabs when the camera and confirmation dialogs are closed. Each gun read shows a compact dark glass popup (5 s, replaced by the next read, dismissible) with the matched ticket's photo flush on the left, the customer name and the customer index; order IDs and tag codes are not shown because staff cannot read them. Success draws an animated neon check over the photo and shows no message; a rejected or repeated read shows the message in a tone-coloured pill and a warning or error mark. A ticket without a photo shows a striped "No photo" block; a tag with no ticket in the department shows an error block and "Not found in this department". Tickets matched by a rejected read (wrong tab, already queued, several tasks) still show their data. The camera overlay keeps the plain text result card.

A gun read that selects a ticket, or repeats a selected one ("Already selected"), moves that ticket to the top of the list and scrolls the list to the top; earlier reads follow, newest first, then the normal order. In the order view, order cards sort by their newest read ticket and each expanded card lists its read tickets first. Tapping a ticket never reorders. Clearing the selection, deselecting the ticket, switching tab, or sending restores the normal order. The move animates over 300 ms and is instant under `prefers-reduced-motion`.

In the four garment departments, the scan button opens the shared scanner with `scan=1` in the query. Browser Back closes an overlay opened from the page; closing a refreshed scanner deep link removes the query with replace. Each read resolves a loaded ticket in this department and the active status tab, adds it to a deduplicated queue, and gives success or failure feedback. When a tag has more than one ticket with the active status in the department, the read is rejected and names the task codes, so staff pick the tasks from the list; a scan never queues the first of several tasks. The result explains tags outside the tab, duplicate reads, ambiguous tags, and unknown tags. The queue count appears in the scanner. A queue is saved locally by department and status, keyed by ticket id, and restored only for tickets still loaded with that status. Queues saved before task codes hold ticket ids and restore unchanged; an entry is never remapped by garment alone, so a sibling task of the same garment is not restored in its place. Closing with queued scans asks staff to Send, Discard, or Cancel. Leaving the page, changing department, or switching tabs with a selection or queue also asks for confirmation. A rejected write or connection error keeps the pending work for retry. An uncertain write clears it and reloads the department so staff can check the jobs before sending again. A successful batch updates the loaded statuses, timestamps, and actor and shows one summary notice with advanced, blocked, and skipped counts.

Completing a ticket through `/api/job-tickets/advance` appends one WorkTransactions EARN row with the ticket's `work_minutes` and `created_by` set to the staff StaffId; accepting work (Pending → In Progress) earns nothing. Tickets without `work_minutes` (created before the column existed) earn nothing and are not reported. If the score write fails, the affected tickets are counted in `scoreFailed` and the page shows “Score not saved … Tell an admin”; completion itself still succeeds.

Packaging weight-photo scores come from successful WEIGHT order-image saves and from Packaging Confirm (one per confirmed bag, same service): a Completed ORDER
ticket stores kg times the `PCK-WEIGHT-KG` Packaging rate and earns one EARN for an active
photographer StaffId. Missing rates leave minutes null and earn nothing; inactive or unknown
photographers still receive a ticket without EARN. Failures are logged and do not fail the image save.

Tagging scores come from work-order approval: newly appended Completed Tagging tickets at
step 0 earn their stored work minutes for the active StaffId recorded in LaundryPhotos
`created_by`, rather than the approving actor. Photos without an active StaffId earn nothing.
WorkRates successful reads are indexed by task code and cached in memory for the life of each server instance, without
a TTL, so a rate change reaches approvals and weight photos only after the instance restarts; concurrent reads share one in-flight request. Failed reads are logged and are not cached,
so a later approval can try again. Minutes already stored on tickets are not affected by a rate change.

Start and advance share the same transition core and earlier-step gate as Packaging Confirm.

On the All and Pending tabs, the play arrow on each garment department order card sends one `/api/job-tickets/start-order` request to start all Pending tickets with tags in that order. In Progress, Completed, and Cancelled tickets are skipped; Pending tickets without tags are counted as skipped. Each order's Start runs in the background and shows a spinning sync icon while that order syncs. Its button is disabled only during that order's sync or when the order has no Pending tickets. The actor is the signed-in StaffId, or `unknown` when signed out; the optional `by` query is ignored.

Start shows one summary notice with counts of advanced, blocked, and skipped without a tag, plus the blocking department names when any are blocked. A task blocked by an earlier task in its own department names that same department. A failed Start write asks staff to retry or check the order according to write certainty. The shared sound and vibration controls appear in the scanner header. A queued read plays one short beep and a 70 ms vibration; rejected reads play two short beeps and a distinct vibration pattern, subject to the independent preferences. Image taps and Start are silent.

On the In Progress tab, admins see Complete in the same position and style as the order's Start
button. It closes every Pending and In Progress list-visible job for that order and department,
including jobs without tags, with no earlier-department gate and no score. Non-admins see no
per-order button on this tab. The shared confirm dialog asks “Complete all <n> open jobs of order
<id> in <Department>? This skips the workflow and gives no score.” The count includes both open
statuses from the shared department list. Confirm calls only the resource store's `completeOrder`;
the server enforces the admin role and supplies the StaffId actor.

The order button disables and uses the existing spinning sync state during saving. Success patches
shared ticket rows in place and reports the completed count and no score; affected selections and
scan queue entries are removed. Rejected writes allow retry; uncertain writes and connection errors
ask staff to check the order and reload the list. Completed has no per-order button. All and Pending
retain Start for everyone in garment departments; Start remains absent in Logistics.

## Logistics order bags

Logistics always groups by order, including when a deep link supplies `group=item`. It uses the same
ALL, PENDING, IN PROGRESS, and COMPLETED tabs, order cards, completion ring, and status counts.
There is no ticket image grid, grouping control, ticket selection, batch start/play action, or scan
FAB on the Logistics list. Admin Complete appears only on In Progress order cards; tapping this
button opens the confirmation without navigating to the bag page. Tapping an order card body opens `/departments/logistics/:orderId`, route name
`logistics-order-bags`, owned by job-tickets and rendered by `OrderBagsPage.vue`. The route
pattern `/departments/:department(logistics)/:orderId` captures the Logistics department for the
`department-work` parent, so the header Back button returns to `/departments/logistics`.

Logistics and Packaging share one order bag page, `OrderBagsPage.vue`, which keys `OrderBagsView.vue`
by department. Both departments use the same summary card (`OrderBagSummary.vue`) and bag row
(`OrderBagRow.vue`); the department only selects the workflow composable (`useLogisticsBags` or
`usePackagingBags`), the wording, and the bottom action (Scan or Confirm). Neither shows an
order-status badge; the customer comes from the order's tickets. Only Packaging reads the work order,
and only for item names (below).

The Logistics bag page loads all pages of that order's Logistics tickets and its order images
through the data layer. Tickets use `loadOrder(orderId, 'Logistics')` in the resource store;
cached Logistics tickets render immediately during reload. Non-deleted ORDER LOG-BAG tickets define the bags. Each ticket id
is `LOG-<orderId>-<orderImageId>-LOG-BAG`; the row shows the embedded orderImageId, the ticket's
photoEvidenceUrl, and scanned/pending state. Weight is the quantity of the matching OrderImages row,
without filtering by image type; a missing image or quantity shows no weight. Images without a bag
ticket do not create rows. The header shows customer, bag weights, and scanning progress, with no
order-status badge. Bags sort by ticket createdAt ascending after Bangkok timestamp normalization,
then by orderImageId. In Progress and Completed bags are already scanned.

Scan opens the existing shared camera overlay with `scan=1`. Each read accepts a trimmed bare
orderImageId or the text after the last `/b/` segment, and matches against this order's loaded bags.
Pending matches are marked scanned only in memory. Unmatched ids show “Not a bag of this order”;
repeated local scans and already In Progress or Completed bags show “already scanned”. Reads provide
sound/vibration feedback and make no network request individually.

Scanning the last Pending bag automatically confirms; the Confirm button can confirm a partial
set. Either calls the store’s `advanceTickets` for one advance request with Logistics, from Pending, the current staff
actor, and every locally scanned ticket id paired with this order id. Orders have fewer than 200
bags; the page does not chunk requests. Confirmed advances update shared tickets to In Progress and
record the returned start time and actor. Partial responses, failed writes, and uncertain writes
reload server data before staff scan again. After confirmation finishes, the camera closes.
Closing without confirmation, browser Back, or leaving the page discards the local scans without a
write; scans are never persisted. Close uses Back for a scanner entry pushed by the page and removes
`scan` with replace for a refreshed/deep-linked scanner. Navigation waits while confirmation saves.

## Packaging order bags

On the Packaging page, tapping an order card body opens `/departments/packaging/:orderId`, route name
`packaging-order-bags`, owned by job-tickets and rendered by the shared `OrderBagsPage.vue`, with the
same `department-work` parent as Logistics. The route is registered before the generic department route.
The other garment departments still expand the card.

`loadPackagingOrder` in `packaging-bag-source.ts` calls the resource store’s `loadOrder(orderId)`
for all departments and reads BagItems in parallel. Cached Packaging tickets render
immediately, then the page rebuilds as the reads finish. Garments use their disabled style and cannot
be selected or scanned until the full order ticket load succeeds; invalidation reloads disable them
again until earlier-department gates and older Completed tickets are known. Non-deleted Packaging ITEM tickets
define garments; the shared advance gate identifies the earliest unfinished department. A garment's
photo is its Packaging ticket's `photoEvidenceUrl`, as on the department page. Garments sort by tag ID, independent of preview or full-load ticket order. BagItems defines
confirmed assignments, bag counts, and the earliest timestamp for each bag. A confirmed bag photo
comes from the matching `LOG-<orderId>-<bagId>-LOG-BAG` Logistics ticket’s `photoEvidenceUrl`,
or is null when the ticket is absent. Packaging does not read OrderImages. The customer comes from the tickets' `customerId` and the preloaded
customer store. The summary card shows the bag count and garments packed; the page shows no order
status.

Staff cannot read tag codes, so the page never shows a garment tag: it shows the garment's item name
instead. `loadItemNames` in `packaging-bag-source.ts` joins two reads once per order when the page
opens, in parallel and without blocking the garment list: the order's LaundryPhotos rows, which map a
tag (the row's `itemId`) to an `orderItemId`, and the work-order detail (`/api/work-orders/:id`),
whose order items map `orderItemId` to `description`. The photo read uses the same cached request as
the gallery; a work order already held by the work-order store is reused without a request. Rows
whose `itemId` is not a garment tag (a reassigned photo holds a catalog id there) are ignored, as are
links to unknown order items. `buildItemNames` in `packaging-item-names.ts` is the pure join. A name
that cannot be resolved, or a failed read, shows the neutral name “Item”. Reloading the same order
(for example after Confirm) does not read the names again.

New bag IDs use the browser-safe short-ID generator. IDs, garment tags, photo URLs, and the typed weight are kept
per order in localStorage. Taking a photo immediately uploads to `order-images/<orderId>` in
Firebase Storage; only the returned URL is saved on the device. The photo slot shows uploading,
upload failures show a notice, and Confirm is disabled during uploads or a save.

Confirm sends every new bag in one `POST /api/packaging-bags/confirm` request with the current
StaffId. The endpoint validates the whole request, appends missing WEIGHT images (kg in `quantity`) and BagItems,
provisions LOG-BAG tickets and the weight-photo ticket and score of each bag, completes garment Packaging tickets through the shared transition core,
and then attempts printing. Failure retains the device bags for retry, including after a reload
following partial writes. Success clears stored bags, reloads the order, and reports printed and
unprinted tags. Job-ticket, bag-item, and order-image caches invalidate on both success and failure.
See [Confirm contract](../packaging/confirm.md) for validation, write order, and retry semantics.

The bag sheet is the shared `DetailOverlay` with its close button off, opened by `?bag=<bagId>`. The
tag scanner adds `scan=1` on top of it and the bag camera uses `?photo=<bagId>`; each is a route-owned
query overlay (`useQueryOverlay`) that closes with Back. Each garment in the sheet's grid is labelled
with its item name under the photo.

The page shows no banner above the bag list: a new bag with no garments shows “Empty · delete or add
garments” on its row, a bag without a photo shows “Add bag photo”, and Confirm stays disabled until
every new bag has a garment and a photo.

A keyboard-wedge barcode gun can add garments while a bag's sheet is open and neither the camera
scanner, the bag camera nor the Confirm dialog is open (`useScannerGunInput`, the same hook as the
department page). A gun read goes through the same `scan` call as a camera read, so it adds the
garment to the open bag, rejects the same cases (not in this order, already in a confirmed bag, in
another bag, waiting for an earlier department), and plays the same success or failure sounds.
Reading a garment already in this bag shows the warning “Already in this bag” and keeps it selected;
a read never removes a garment. Each read shows the department page's compact dark popup
(`ScanNotice` with `ScanResultCard`, state in `useScanNotice`: 5 s, replaced by the next read,
dismissible) with the garment photo, its item name, and the neon check on success or the message in a
tone-coloured pill on a rejection. A tag that is not in the order shows an error block with no name.
The popup is rendered in the overlay layer at the top of the screen so it stays visible and
clickable above the open sheet, and it is dismissed when the sheet or the tag scanner opens or
closes. The camera scanner keeps the plain text result card, titled with the item name. The kept-alive
department page ignores gun reads while this page is active.

The Packaging bag workflow (create bags, assign garments, confirm, print tags) is in
[Packaging workflow](../packaging/workflow.md).
