# feat/department-work-query

## Committed
- Department pages load per department via `GET /api/job-tickets/department-work`: one GViz read, kept orders filtered on the server.
- Fixes ring/count under-count (order `32b0320c` Washing 71 → 74, checked against live sheet 2026-10-17).

## Decisions
- Reversed 2026-09-25 board design (2 reads): user chose one unfiltered department read for now (2026-10-17).
- Measured 2026-10-17: Washing read ~0.7–1.0 s (2,444 rows read, 357 returned); revisit when department history grows.
- Cancelled tickets are not returned and never keep an order in flight.

## In progress (uncommitted, backup in session scratchpad)
- One-hour freshness for department work in the store: built and tested, held out of the first commit.
- Pull-to-refresh: Codex built a duplicate mechanism; user rejected it. Redo must reuse `PullToRefresh.vue`.
- User placement: the pull gap sits under the ListContainer header, above the first row.

## Open
- Ticket `due_date` is an APPROVED snapshot; order edits do not update it.
- Work-order create/update do not invalidate `/api/job-tickets`; newly approved orders need a refresh.
