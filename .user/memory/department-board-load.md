# Department board load — decided design, not built

## Problem

- Department page drops tickets completed before today, so an order's ring under-counts (be2f58f2 Washing: shows 0 of 3, real 2 of 5).
- Current client loads three status lists concurrently, paging each at 500 rows up to 2,000 tickets; there is no per-order detail fetch.
- Completed loading retains today-or-later rows and stops at older rows, so earlier completions still disappear from the ring.

## Chosen direction (user, 2026-09-25)

- New board endpoint inside the job-tickets module: 1 client request, 2 sequential GViz reads.
- GViz 1: order_ids of this department's tickets that are Pending, In Progress, or completed today.
- GViz 2: every ticket of those orders in this department (`order_id='A' or ...`), built in the module layer; do not widen the shared GVizQueryBuilder.
- Group by order server-side; skip GViz 2 when no order is open.
- Rejected: unfiltered department read (grows with Completed history every day).

## Open before building

- Ticket due date remains an APPROVED snapshot; decide whether the board reads the current order or synchronizes ticket fields on edits.
- Whether Cancelled tickets count in the ring.
- `completed_at` must be compared as a GViz datetime; test on the live sheet.
- Archive threshold for JobTickets growth.
