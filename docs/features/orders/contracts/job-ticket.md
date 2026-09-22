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

## Provisioning

Tickets are provisioned after a work-order status write succeeds with `APPROVED`. The service reads
the order's LaundryPhotos rows, resolves each photo's `orderitem_id` against OrderItemForms, and
uses the order service type only when the referenced line cannot be resolved. It then reads existing
tickets and appends every missing `(laundryItemId, department)` pair in one batch.

Repeating an `APPROVED` update is safe for already-created pairs and fills tickets for garments that
were tagged later. A garment with a missing tag or unsupported service type is reported as skipped.
The order status is never rolled back when the ticket batch fails.
