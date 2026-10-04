# feature/orders-report

- Orders report page: Week / Month tabs, dark only, Job Ticket ring + status cards, floating period pill.
- Week: 7-day bar chart doubles as day picker; day detail comes from the week response's `days`, no extra request.
- `/api/order-reports` cached 1 h (work-order create/update invalidate); shared `PullToRefresh` used on this page only; owner checked it locally, phone gesture not yet tried.
- Owner decisions: count by `receivedDate`; CANCELLED only in the cancelled line; week = last 7 days; Pending = PENDING, In progress = RECEIVED+SUBMITTED+APPROVED, Completed = COMPLETED.
- Open: Month change % compares a partial current month with the whole previous month; proposed same-days comparison, owner not decided.
- Open: status cards show each order's current status, not the status on that day; Completed was 0 of 12 for a 2-day-old date — check whether orders ever reach COMPLETED.
- Not verified: JobTicket ring after `CompletionRing` moved to `src/shared/components`; endpoint never hit on a real Vercel deploy.
- Resume files: `src/features/order-reports/`, `server/modules/order-reports/`, `docs/features/orders/order-report.md`.
