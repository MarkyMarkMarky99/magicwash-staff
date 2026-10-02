# Job tickets — API contract

Module `job-tickets`. Reads and writes the `JobTickets` tab in the job-tracking workbook
(`JOB_TICKETS_SPREADSHEET_ID`). The physical row shape is item-scoped: one garment has one ticket
for every department in its service route.

Routes are fixed by `serviceType`:

- `WASH` — Washing (1), Packaging (2)
- `WSIR` — Washing (1), Ironing (2), Packaging (3)
- `DRCL` — DryCleaning (1), Ironing (2), Packaging (3)
- `IRON` — Ironing (1), Packaging (2)

## `GET /api/job-tickets`

The generic list query accepts `keyword`, `page`, `perPage`, `sortBy`, and `sortOrder`, plus optional
exact filters for `orderId`, `laundryItemId`, `department`, and `status`.
`sortBy` accepts `createdAt`, `stepNo`, `dueDate`, or `completedAt`; `completedAt` maps to the physical `completed_at` column.

The response exposes all physical columns in camelCase. `serviceType` is nullable. Audit, scan,
completion, evidence, and soft-delete fields are nullable strings.

Ticket ids are deterministic: `XXX-<orderId>-<laundryItemId>`. Department prefixes are `TAG`,
`WSH`, `DRC`, `IRN`, `PCK`, and `LOG` for Tagging, Washing, DryCleaning, Ironing, Packaging, and
Logistics respectively.

## `GET /api/job-tickets/:id`

Returns the full camelCase ticket row.

## `PATCH /api/job-tickets/:id`

The request accepts only `status` and `updatedBy`. This is the direct ticket maintenance endpoint;
department scanning uses the gated endpoint below.

## `POST /api/job-tickets/scan`

Request:

- `laundryItemId` — the physical tag stored as `LaundryPhotos.item_id`
- `department` — the scanning department
- `scannedBy` — the staff actor

A scan resolves the ticket by garment and department. Every lower `stepNo` ticket for the garment
must be `Completed` before the ticket can move.

The first successful scan changes `Pending` to `In Progress`, stamps `startedAt`, and records
`scannedBy`. The next successful scan changes `In Progress` to `Completed`, stamps `completedAt`,
and records `scannedBy`. A completed ticket is a successful no-op outcome.

The response is an unwrapped discriminated union:

- `advanced` — 200
- `already_completed` — 200
- `not_found` — 404
- `not_advanceable` — 409 and includes the resolved ticket id and its current status
- `blocked` — 409 and includes `blockedByDepartment`
- `write_failed` — 502 for a rejected write, 500 for an unknown write outcome

`not_found` is reserved for a garment that has no ticket for the requested department. A cancelled
ticket returns `not_advanceable` with status `Cancelled`, so it remains resolvable in history.

## `POST /api/job-tickets/start-order`

The request accepts a non-empty `orderId`, `department`, and non-empty `scannedBy` staff actor.
The service reads the order's tickets once. It starts Pending tickets in the requested department
that have a garment tag and whose lower `stepNo` tickets for the same order and tag are all
`Completed`. Blocker checks use only tickets from that order. Pending tickets without tags are
counted as skipped. Eligible tickets are written together in one batch; an existing `startedAt`
is retained.

The unwrapped response has two outcomes:

- `completed` — 200, with `advanced` entries containing ticket id, garment tag, `In Progress`
  status, and nullable start time; `blocked` entries containing ticket id, garment tag, and blocking
  department; and a non-negative `skippedWithoutTag` count
- `write_failed` — 502 for a rejected write or 500 for an unknown write outcome, with `certainty`,
  `blocked`, and `skippedWithoutTag`; no advanced entries are reported

## `POST /api/job-tickets/advance`

The request names a department, a source status of `Pending` or `In Progress`, a non-empty staff actor, and 1–200 ticket and order ID pairs. IDs and actor are trimmed. Repeated ticket IDs are processed once. The service reads each distinct order once and checks only tickets from that order. Missing or deleted tickets and department mismatches are skipped as `not_found`; tickets whose status changed are skipped as `status_changed`. The lowest incomplete earlier step for the same order and garment blocks an update, and the response names its department.

Eligible Pending tickets move to In Progress; eligible In Progress tickets move to Completed. The existing start time is retained, or stamped if missing. Completion stamps the completion time. Staff is recorded for the scan and update. Eligible tickets are written in one batch.

The unwrapped response is `completed` with HTTP 200, or `write_failed` with HTTP 502 for a rejected write and HTTP 500 for an uncertain write. Completed responses list advanced ticket IDs, nullable garment IDs, new statuses, and nullable start and completion times, plus blocked and skipped entries. Failed writes report certainty, blocked entries, and skipped entries without claiming advancement.

## Provisioning

Tickets are provisioned after a work-order status write succeeds with `APPROVED`. The service reads
the order's LaundryPhotos rows, resolves each photo's `orderitem_id` against OrderItemForms, and
uses the order service type only when the referenced line cannot be resolved. It then reads existing
tickets and appends every missing `(laundryItemId, department)` pair in one batch.
Each new department ticket defaults `photoEvidenceUrl` to the first non-empty `LaundryPhotos.image_url` for its garment tag, or null when none exists.

Repeating an `APPROVED` update is safe for already-created pairs and fills tickets for garments that
were tagged later. A garment with a missing tag or unsupported service type is reported as skipped.
The order status is never rolled back when the ticket batch fails.
