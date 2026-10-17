# Branch — `feat/no-weight-packs`

- Packaging bag weight optional: empty → OrderImages `PACK` (null quantity), valid → `WEIGHT`; invalid typed weight still blocks.
- `/b/:id` accepts PACK and hides kg when null (legacy BAG now null too, no more 0 kg).
- PACK skips the per-kg `PCK-WEIGHT-KG` ticket/score; garment tickets, BagItems, LOG-BAG and tag print run for both.
- Proven 2026-10-18: Chrome UI test (S1–S4) + one real Confirm on test order `ffa710fc` (bag `e7f8a9b0`), rows checked with GViz.
- Printer OK (Codex read of `C:\MagicwashInvoice` `bc80a4e`, 2026-10-18): null weight prints item count + "pcs"; only a real print on prod remains.
- Not done: PACK photos do not show on order detail (`ORDER_IMAGE_TYPES` is WEIGHT/BELONGING/DOCUMENT).
- Test leftovers on live sheets: order `ffa710fc` now fully packed with a picsum photo URL.
