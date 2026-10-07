# Bag tags and delivery tracking (on main, 2026-10-07)

## Session log
- Transcripts `2026-10-07-045309-...txt` / `2026-10-06-192030-...txt` (repo root, untracked): query only via the `explore` skill.

## Bag tag print — done, live
- Printer: MagicwashInvoice main `123062a`; rotated on the 35 mm roll; ARIBLK/ARIALBD in TE210 flash; print server restarted 2026-10-07.
- Webapp: WEIGHT image save awaits `POST /print-bag-tag`; Vercel prod env `BAG_TAG_PRINT_ENABLED=true`, `BAG_TAG_TRACKING_URL_BASE`.
- `baa54ea`: customer code now read via OrderForm.customer_id (images are saved with customerId null); owner has not yet seen a tag printed after this fix.
- Owner's uncommitted `config.json` in MagicwashInvoice (printApiKey, domain) left untouched on purpose.

## NEXT: scan the tag → real delivery-tracking page
- Today `/#/b/<orderImageId>` runs on fixtures, so a real tag QR shows "This tag isn't in our system" (seen with `574fdcaa`).
- Build a public no-login `GET /api/delivery-tracking/:orderImageId`: weight photo, weight, weighed time, other bags of the order, order status, customerIndex, receivedDate, deliveredAt; never name/phone/address.
- Swap `src/features/delivery-tracking/services/delivery-tracking.service.ts` from fixtures to that API; then delete the fixtures and `public/delivery-tracking-sample/`.
- Proposed (owner not yet confirmed): proof of delivery stays "—" until a proof image type exists.
- Check first: does OrderForm have a delivered date/time column; how other public routes skip auth (Vercel 12-function cap: add to an existing api file).
- Also open: real shop LINE/phone in `utils/delivery-tracking.ts`; weight-tab font falls back to Arial on phones (load Archivo Black).

## Bag-scan page (staff, not built)
- Purpose: count every bag onto the van before delivery; scan matches orderImageId.
- Decided: store scans in a sheet (owner leans to AfterPhoto); how to record is still open.
