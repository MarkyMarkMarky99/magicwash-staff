# Department board load — decided design, not built

## Problem

- Department page drops tickets completed before today, so an order's ring under-counts (be2f58f2 Washing: shows 0 of 3, real 2 of 5).
- Today: 3 sequential status lists + one getWorkOrder per unlisted order (3 + N client, 3 + 2N Google).

## Chosen direction (user, 2026-09-25)

- New board endpoint inside the job-tickets module: 1 client request, 2 sequential GViz reads.
- GViz 1: order_ids of this department's tickets that are Pending, In Progress, or completed today.
- GViz 2: every ticket of those orders in this department (`order_id='A' or ...`), built in the module layer; do not widen the shared GVizQueryBuilder.
- Group by order server-side; skip GViz 2 when no order is open.
- Rejected: unfiltered department read (grows with Completed history every day).
- Estimate ~1.3s warm vs ~3.3s today; not measured.

## Open before building

- Ticket due date/customer are snapshots from APPROVED; keep getWorkOrder or sync ticket fields on order edit.
- Whether Cancelled tickets count in the ring.
- `completed_at` must be compared as a GViz datetime; test on the live sheet.
- Archive threshold for JobTickets growth.
