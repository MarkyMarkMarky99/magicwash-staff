# feat/packaging-bag-page

- Status: UI + Confirm backend + real reads built; dry-tested only, browser test with real data pending.
- Route `/departments/packaging/:orderId`; workflow `docs/features/packaging/workflow.md`; endpoint `docs/features/packaging/confirm.md`.
- Deploy order: restart the print server (C:\MagicwashInvoice main, accepts legacy `weighedAt`) before deploying this branch.
- Owner left as-is: tag id below the tile, sheet ~50px taller than the prototype (DetailOverlay spacing).
- Open: keep the additive `closeButton` prop on shared `DetailOverlay`; sheet scan button uses `onDark` tone on a light sheet.
- Gap: `/b/:id` tracking accepts WEIGHT only, so a Packaging bag tag QR shows not found.
- Not exercised: live Firebase upload, real tag print, EARN repair path on retry.

## JobTickets data ownership (built 2026-10-09, browser test pending)
- All JobTickets reads/writes go through `src/data/job-tickets/job-ticket.store.ts`; checker blocks runtime service imports from features.
- Open work (Pending + In Progress) loads once for all departments, one request per status; cap 10,000 (owner). Loaded views refresh without blanking.
- Packaging reads only JobTickets (store) + BagItems; bag photo from the LOG-BAG ticket.
