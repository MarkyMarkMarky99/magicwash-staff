# Bag tag printing and order bag-scan page (main, design only)

## Bag tag (printed after each WEIGHT photo)
- Layout locked: `designs/bag-tag-70x35.html`, design "1. Ledger — weight tab" (70x35 mm, content scaled 0.9375 for ~2.5 mm margins, QR ~20.6 mm).
- Proposed body `POST /print-bag-tag` (webapp-vue server -> MagicwashInvoice): `{ orderImageId, customerIndex, weightKg, weighedAt }`; QR + Code128 encode `orderImageId`.
- Trigger: server-side after a WEIGHT order image append succeeds (next to weight-photo-ticket provisioning); print failure is logged, never fails the save.
- Open owner decisions: missing customerIndex (print "—"?), QR = id only?, `BAG_TAG_PRINT_ENABLED` env switch default off; is 70x35 stock loaded in the TSC?
- Printer flow and TSPL details: MagicwashInvoice `server.js` `/print-order-tags`, `docs/handoff-tsc-tag-printer.md`.

## Order bag-scan page (Packaging / delivery)
- Purpose: courier scans every bag tag of an order before delivery; progress bar full only when all bags scanned.
- Approved mock: `designs/order-bag-scan-page.html` (photo-right rows, no row tint, existing `StickerFab` scan button).
- Open decision: store "scanned" state on the device or in a sheet (shared, records who scanned).
