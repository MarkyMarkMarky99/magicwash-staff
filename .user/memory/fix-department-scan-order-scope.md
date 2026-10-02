# fix/department-scan-order-scope

- Status: built and pushed 2026-10-02; owner testing on Preview, not merged.
- Start posts `/api/job-tickets/start-order` once per order (one GViz read + one `updateMany`); blocker check is order-scoped.
- Start no longer blocks the page: per-order sync spinner; image taps ignored while that garment is saving.
- Cause found: Start looped one `/scan` per garment (~4 Google calls each), pushing the service account past 60 Sheets reads/min.
- The "Washing is not completed" report reproduced only on Ironing/Packaging pages — expected gating, not a bug.
- Open: scanner can still double-advance a garment that an order batch is writing (rare).
- Open: single tap/scan still costs ~4 Google calls; `/scan` is not order-scoped.
- Open: concurrent-device race (read-then-write without re-check) left as is pending owner decision.
- Open: overlapping order notices share one slot; the later one replaces the earlier.
- Data: 1,533 overdue Pending/In Progress tickets were set Completed on 2026-10-02 (`updated_by` = `admin-bulk-overdue`).
