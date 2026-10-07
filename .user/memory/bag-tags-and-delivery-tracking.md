# Bag tags and delivery tracking (on main, 2026-10-07)

## Session log
- Transcripts `2026-10-07-045309-...txt` / `2026-10-06-192030-...txt` (repo root, untracked): query only via the `explore` skill.

## Bag tag print — done, live
- Printer: MagicwashInvoice main `123062a`; rotated on the 35 mm roll; ARIBLK/ARIALBD in TE210 flash; print server restarted 2026-10-07.
- Webapp: WEIGHT image save awaits `POST /print-bag-tag`; Vercel prod env `BAG_TAG_PRINT_ENABLED=true`, `BAG_TAG_TRACKING_URL_BASE`.
- `baa54ea`: customer code now read via OrderForm.customer_id (images are saved with customerId null); owner has not yet seen a tag printed after this fix.
- Owner's uncommitted `config.json` in MagicwashInvoice (printApiKey, domain) left untouched on purpose.

## Delivery-tracking API — on main 2026-10-07
- Live probe OK (`574fdcaa` → bag 4/4); owner still to scan a real tag on a phone.
- On main `deliveredAt` still comes from the appointment's `UpdatedAt`; `feat/bag-scan-delivery` replaces it with ticket `completed_at` + DELIVERY photo.
- Also open: real shop LINE/phone in `utils/delivery-tracking.ts`; weight-tab font falls back to Arial on phones (load Archivo Black).

## Bag scan / Logistics — on `feat/bag-scan-delivery`
- Status and next steps: `.user/memory/feat-bag-scan-delivery.md`.
- Design mockup: `.user/memory/designs/order-bag-scan-page.html`.
- Decided: Logistics ticket per bag; scan = Pending → In Progress (on the van); order COMPLETED closes all open tickets, no KPI.
- Decided: appointment → COMPLETED calls the existing work-order COMPLETED update; no separate delivery workflow.
- Decided: tracking `deliveredAt` = bag ticket `completed_at`; proof = OrderImages type `DELIVERY` (pickup proof = `PICKUP`).
- Decided: bag scan is the Logistics department's task (driver scans every bag at pickup); entry via side nav, not order detail.
- KPI out of scope; one delivery per order; proof photo optional; Appointments driven by a separate transport automation.
