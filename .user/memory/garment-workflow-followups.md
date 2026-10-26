# Garment workflow follow-ups (merged to main 2026-10-27)

Intake Order, Register Garments, garment detail, garment photos and scan prefixes shipped from
`feat/order-intake-page`. Plans: `docs/plans/order-intake-flow.md`, `docs/plans/garment-photos.md`,
`docs/plans/scan-code-prefix.md`, `docs/plans/laundry-item-registration.md`.

## Must test
- Real print: one garment tag (QR now `MWG-<tag>`) and one bag tag (Code 128 now `MWB-<id>`, longer)
  on the real printer, then scan both with the real gun. Owner must be at the printer.
- Real gun on a normal page opens garment detail; on Intake / Register / department / Packaging it
  keeps the page flow.
- Garment photo Add (one photo per Add) not tried live.
- Prod timing of garment detail not measured (vercel dev: garment after one request, ~2.5–4 s).

## Next task
- Registration camera (order detail and Register Garments): while it is open, gun scans should
  go into its Tag ID field. Today an unfocused gun scan on order detail reaches the app-level
  garment scanner. Camera QR reading is not affected.

## Known gaps
- Server photo create with `orderId` checks OrderGarments, so it rejects orders that have only
  JobTickets (old-flow orders).
- Garment detail entry points: order detail link and customer Garments tab not built.
- Garment `DWaIjLch` has an empty `created_at`; its detail page errors (strict parse).
- Order `5aed2e17` uses inactive Items ids; check how staff picked inactive types.
- Garment reads skip the browser cache on purpose (`invalidate` before each read); owner chose to
  keep it (2026-10-27).
- Owner has not viewed the shared-UI Round 7 changes; leftovers and the 13 pre-existing failing
  dry-tests are in `.user/memory/shared-ui-later.md`.

## Test data
- Test customer `cbcc555a` (KLX): garments `TEST0001`–`TEST0003`, order `6dc8190f` (open tickets
  cancelled, Tagging voided). Use it for every live test that writes.
- Marky test orders `499cde06`, `ba45cd70` cancelled; their Tagging credit voided.
