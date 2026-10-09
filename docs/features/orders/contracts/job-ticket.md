# Job tickets — API contract

Module `job-tickets`. Reads and writes the `JobTickets` tab in the job-tracking workbook
(`JOB_TICKETS_SPREADSHEET_ID`). ITEM rows give one garment one ticket
for every task step in its service route. A task is identified by `taskCode`, which is the `task_code` of a
`WorkRates` row and belongs to one department. A route may hold several tasks in the same department;
today every route holds exactly one task per department, so a garment still has one ticket per department.

The order and order-item `serviceType` only select the route. It is not copied onto the ticket.
Routes are fixed by `serviceType`, each step written as department (`stepNo`) `taskCode`:

- `WASH` — Washing (1) `WSH-STANDARD`, Packaging (2) `PCK-STANDARD`
- `WSIR` — Washing (1) `WSH-STANDARD`, Ironing (2) `IRN-STANDARD`, Packaging (3) `PCK-STANDARD`
- `DRCL` — DryCleaning (1) `DRC-STANDARD`, Ironing (2) `IRN-STANDARD`, Packaging (3) `PCK-STANDARD`
- `IRON` — Ironing (1) `IRN-STANDARD`, Packaging (2) `PCK-STANDARD`

Tagging is not part of a route: its ticket at step 0 uses `TAG-PHOTO`. `LOG-STANDARD` is reserved for
Logistics, which no route uses yet. Task variants (machine, hand, carpet, shoe) and a Packaging split are not implemented.
WEIGHT order photos create Completed ORDER tickets at step 0 for `PCK-WEIGHT-KG`, with a blank
`laundry_item_id` (read as nullable `laundryItemId`). Department boards show only ITEM tickets.

## `GET /api/job-tickets`

The generic list query accepts `keyword`, `page`, `perPage`, `sortBy`, and `sortOrder`, plus optional
exact filters for `orderId`, `laundryItemId`, `department`, and `status`.
`sortBy` accepts `createdAt`, `stepNo`, `dueDate`, or `completedAt`; `completedAt` maps to the physical `completed_at` column.

The response exposes all physical columns in camelCase. `taskCode` is nullable: a ticket created
before task codes existed and not yet backfilled returns `null`, and the API never derives a task from
an old service code. Audit, scan, completion, evidence, and soft-delete fields are nullable strings.
The response carries no task display name; clients show `taskCode` itself.

New ticket ids are deterministic: `XXX-<orderId>-<laundryItemId>-<taskCode>`. Department prefixes are
`TAG`, `WSH`, `DRC`, `IRN`, `PCK`, and `LOG` for Tagging, Washing, DryCleaning, Ironing, Packaging, and
Logistics respectively; the prefix is the department, not the start of the task code. Tickets created
before task codes keep their id `XXX-<orderId>-<laundryItemId>`, which is never rewritten.

## `GET /api/job-tickets/:id`

Returns the full camelCase ticket row.

## `PATCH /api/job-tickets/:id`

The request accepts only `status` and `updatedBy`. This is the direct ticket maintenance endpoint;
department work uses the shared gated transition below.

## Shared department transition

Start all pending, department batch advancement (including Logistics), and Packaging Confirm use
`JobTicketTransitionService`. It takes ticket/order ID pairs, department, target status, allowed
source statuses, and actor, plus optional tickets already read in the request. Missing, deleted,
and wrong-department tickets are `not_found`; changed source statuses are `status_changed`.
The lowest earlier unfinished step for the same order and garment blocks, including Cancelled
and earlier tasks in the same department. All changes use one updateMany. Missing start times
are stamped; completion stamps completion time and earns once for newly Completed tickets with
finite numeric work minutes. Failed EARN writes report scoreFailed; retries do not repair scores.
Packaging allows Pending or In Progress directly to Completed. Other callers retain their usual hop.
The unused single-ticket `/scan` endpoint has been removed; the scanner queues a batch for `/advance`.

## `POST /api/job-tickets/start-order`

The request accepts a non-empty `orderId`, `department`, and non-empty `scannedBy` staff actor.
The service reads the order's tickets once. It starts Pending tickets in the requested department
that have a garment tag and whose lower `stepNo` tickets for the same order and tag, including earlier
tasks in the same department, are all `Completed`. Blocker checks use only tickets from that order. Pending tickets without tags are
counted as skipped. Eligible tickets are written together in one batch; an existing `startedAt`
is retained.

The unwrapped response has two outcomes:

- `completed` — 200, with `advanced` entries containing ticket id, garment tag, `In Progress`
  status, and nullable start time; `blocked` entries containing ticket id, garment tag, and blocking
  department; and a non-negative `skippedWithoutTag` count
- `write_failed` — 502 for a rejected write or 500 for an unknown write outcome, with `certainty`,
  `blocked`, and `skippedWithoutTag`; no advanced entries are reported

## `POST /api/job-tickets/advance`

The request names a department, a source status of `Pending` or `In Progress`, a non-empty staff actor, and 1–200 ticket and order ID pairs. IDs and actor are trimmed. Repeated ticket IDs are processed once. The service reads JobTickets with status Pending, In Progress, and Cancelled in three parallel reads, whatever the number of orders, because every GViz query scans the whole sheet; it checks only tickets from each requested order. An order with a requested ticket outside those reads (Completed or missing) is read in full so the skip reason stays exact. Missing or deleted tickets and department mismatches are skipped as `not_found`; tickets whose status changed are skipped as `status_changed`. The lowest incomplete earlier step for the same order and garment blocks an update, including an earlier task in the same department, and the response names its department.

Eligible Pending tickets move to In Progress; eligible In Progress tickets move to Completed. The existing start time is retained, or stamped if missing. Completion stamps the completion time. Staff is recorded for the scan and update. Eligible tickets are written in one batch.

Completing a ticket through `/api/job-tickets/advance` appends one WorkTransactions EARN row with the ticket's `work_minutes` and `created_by` set to the staff StaffId; accepting work (Pending → In Progress) earns nothing. Tickets without `work_minutes` (created before the column existed) earn nothing and are not reported. If the score write fails, the affected tickets are counted in `scoreFailed` and the page shows “Score not saved … Tell an admin”; completion itself still succeeds.

The unwrapped response is `completed` with HTTP 200, or `write_failed` with HTTP 502 for a rejected write and HTTP 500 for an uncertain write. Completed responses list advanced ticket IDs, nullable garment IDs, new statuses, and nullable start and completion times, plus blocked and skipped entries and a non-negative integer `scoreFailed` count. Failed writes report certainty, blocked entries, and skipped entries without claiming advancement.

## Weight photo credit

After a WEIGHT order image is appended, one ticket uses id
`PCK-<orderId>-<orderImageId>-PCK-WEIGHT-KG`, Packaging, ORDER scope, and step 0. Start and
completion timestamps use the image creation time in Bangkok. Scan, update, and creation actors
are the photographer; evidence is the stored image path. Customer, order name, due date, and notes
come from OrderForm; special instructions are null because the header has no such field.
Work minutes are positive finite kg times the Packaging rate for `PCK-WEIGHT-KG`, or null when
quantity or rate is unavailable. Finite minutes earn one EARN for the trimmed photographer only
when they match an active StaffId. Existing ticket ids are skipped. Ticket or EARN failures are
logged, never retried automatically, and leave the image response unchanged. Other image types
create no ticket or credit. Image editing and deletion are outside this workflow.

## Bag logistics tickets

Each saved WEIGHT image provisions `LOG-<orderId>-<orderImageId>-LOG-BAG`, with task LOG-BAG,
Logistics department, ORDER scope, step 0, and blank laundry item id. Existing ids are skipped.
Customer, order name, due date, and notes come from OrderForm exactly as Packaging does; special
instructions are null. Evidence uses the image path; creation and update actors use the photographer.
Status starts Pending, with null start, completion, scan actor, and work minutes. No rates, staff,
or WorkTransactions are read or written. Provisioning failures are logged and never fail the image save.

An order updated to COMPLETED closes every open non-deleted ticket in one updateMany, across all
departments and scopes. Pending and In Progress become Completed at the current Bangkok time,
with that same start time only when missing, and the request actor as updated_by. scanned_by stays
unchanged; no EARN is written. Read/write failures are logged without changing the order response.

## Provisioning

Tickets are provisioned after a work-order status write succeeds with `APPROVED`. The service reads
the order's LaundryPhotos rows, resolves each photo's `orderitem_id` against OrderItemForms, and
uses the order service type only when the referenced line cannot be resolved. It then reads existing
tickets and appends every missing `(laundryItemId, department, taskCode)` ticket in one batch.
Each new ticket's `work_minutes` is the `minutes` of the active WorkRates row whose `task_code` is the ticket's `taskCode` and whose `department` matches the ticket. It is left blank when no such row exists, the code is duplicated, or WorkRates cannot be read (approval still succeeds). Minutes are stored on the ticket and never recomputed when WorkRates later changes.
Each new department ticket defaults `photoEvidenceUrl` to the first non-empty `LaundryPhotos.image_url` for its garment tag, or null when none exists.

Approval also creates one Tagging ticket at step 0 per distinct non-blank tag whose
LaundryPhotos `created_by` matches an active StaffId. The first matching photo author is the
tagger. This ticket is already Completed, with start and completion times set to the approval
time and scan/update actors set to the tagger. It is created even for an unsupported service. Routed tickets remain Pending at steps 1 onward. Old photo authors
that are not active StaffIds create no Tagging ticket or score. After the ticket batch succeeds,
each new Tagging ticket with finite work minutes earns one WorkTransactions EARN row credited
to the tagger. Existing Tagging tickets are skipped and earn no additional score on re-approval.

Repeating an `APPROVED` update is safe for already-created tickets and fills tickets for garments that
were tagged later. An existing ticket occupies its garment, department, and `taskCode`. A ticket whose id
is the old form `XXX-<orderId>-<laundryItemId>` and whose department matches its prefix also occupies that
department's default task (`TAG-PHOTO`, `WSH-STANDARD`, `DRC-STANDARD`, `IRN-STANDARD`, `PCK-STANDARD`,
`LOG-STANDARD`), whatever its `task_code` cell holds, so approvals made before task codes are not repeated
and Tagging is not scored twice. It never suppresses a different task in the same department. A new ticket
is also skipped when its id already exists. An old ticket is not retrofitted with extra tasks. A garment with a missing tag or unsupported service type is reported as skipped for routing; an unsupported service can still receive its Tagging ticket.
The order status is never rolled back when the ticket batch fails.
