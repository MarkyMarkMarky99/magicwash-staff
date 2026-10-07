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
- Temporary: `deliveredAt` = COMPLETED DELIVERY appointment's `UpdatedAt`; proof null until Appointments gets DeliveredAt/proof columns.
- Also open: real shop LINE/phone in `utils/delivery-tracking.ts`; weight-tab font falls back to Arial on phones (load Archivo Black).

## Bag-scan page (staff, not built)
- Purpose: count every bag onto the van before delivery; scan matches orderImageId.
- Design: `.user/memory/designs/order-bag-scan-page.html`.
- Decided 2026-10-07: one JobTicket per bag, created when the WEIGHT image is saved; scan → In Progress (= on the van, `started_at`/`scanned_by` are the scan record); Appointment delivered → all bag tickets Completed; KPI only at Completed. No new scan sheet.
- Decided: deliveredAt and proof photo come from Appointments (needs new columns; deploy contract first).
- Decided: department `Logistics`; one delivery per order (no split); proof photo optional.
- KPI out of scope this round (later: earner = whoever sets the appointment COMPLETED).
- Staff can also complete a bag ticket directly by scan/tap, like other tasks (covers shop pickup).
- Appointments is driven by a separate transport automation.
- Decided: this app's backend does it — when an appointment update to COMPLETED arrives, batchUpdate the Logistics bag tickets of its `DeliveryOrderID` to Completed (hook in `appointment.service.ts` update).
