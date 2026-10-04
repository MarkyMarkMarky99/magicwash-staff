# feature/orders-report

- Orders report page: Day / Week / Month, dark only, Job Ticket ring + status cards, floating period pill.
- Owner decisions: count by `receivedDate`; CANCELLED only in the cancelled line; week = last 7 days; Pending = PENDING, In progress = RECEIVED+SUBMITTED+APPROVED, Completed = COMPLETED.
- Next: merge the day tiles and the "Orders per day" chart into one tappable bar chart (owner idea, approved direction, not built).
- Open: status cards show each order's current status, not the status on that day; owner has not chosen between this and "completed on that day".
- Not verified: page never seen in a browser; JobTicket ring after `CompletionRing` moved to `src/shared/components` with a `tone` prop; endpoint never hit on a real Vercel deploy.
- Resume files: `src/features/order-reports/`, `server/modules/order-reports/`, `docs/features/orders/order-report.md`.
