# Bag tags and delivery tracking (merged to main 2026-10-07)

## Session log
- Transcripts `2026-10-07-045309-...txt` / `2026-10-06-192030-...txt` (repo root, untracked): query only via the `explore` skill.

## Bag tag print
- Printer: MagicwashInvoice main `123062a`; drawn rotated on the 35 mm roll; ARIBLK/ARIALBD in TE210 flash; print server restarted 2026-10-07.
- Webapp: WEIGHT image save awaits `POST /print-bag-tag`; env `BAG_TAG_PRINT_ENABLED`, `BAG_TAG_TRACKING_URL_BASE`.
- Open: QR scan on a phone not yet confirmed; first real tag from a live weight photo not yet seen.
- Owner design rules: QR >= 20 mm; black tabs liked; English only; change one thing at a time.

## Delivery-tracking page (`/#/b/<orderImageId>`, public)
- Shipped on fixture data only: a real QR currently opens "not found" (or sample data for fixture ids).
- Next: public API returning weight photo, bags, status, delivered time, proof photo; no customer name/phone.
- Open: what counts as proof of delivery (no image type yet); real shop LINE/phone in `utils/delivery-tracking.ts`.
- Open: weight-tab font falls back to Arial on phones (no Arial Black); load a web font such as Archivo Black.

## Bag-scan page (staff, not built)
- Purpose: count every bag onto the van before delivery; scan matches orderImageId.
- Decided: store scans in a sheet (owner leans to AfterPhoto); how to record is still open.
