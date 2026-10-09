# feat/packaging-bag-page

- Status: UI + Confirm backend + real reads built; dry-tested only, browser test with real data pending.
- Route `/departments/packaging/:orderId`; workflow `docs/features/packaging/workflow.md`; endpoint `docs/features/packaging/confirm.md`.
- Deploy order: restart the print server (C:\MagicwashInvoice main, accepts legacy `weighedAt`) before deploying this branch.
- Owner left as-is: tag id below the tile, sheet ~50px taller than the prototype (DetailOverlay spacing).
- Open: keep the additive `closeButton` prop on shared `DetailOverlay`; sheet scan button uses `onDark` tone on a light sheet.
- Gap: `/b/:id` tracking accepts WEIGHT only, so a Packaging bag tag QR shows not found.
- Not exercised: live Firebase upload, real tag print, EARN repair path on retry.
