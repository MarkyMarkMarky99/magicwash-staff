# feat/bag-tag-and-bag-scan — handoff (2026-10-07)

## Session log
- Full transcript: `2026-10-07-045309-local-command-caveatthe-command-below-was-run-d.txt` (repo root, untracked); previous one: `2026-10-06-192030-...txt`.
- They are huge. Do NOT read them directly; run the `explore` skill (Codex) with a precise question and let it quote line numbers.

## Done this session (on main, pushed and deployed)
- `28268ac` task codes for WorkRates/JobTickets; live sheet headers + G Drive registry migrated; parity passed.
- `feb3c46` weight-photo score: WEIGHT image save -> Completed ORDER Packaging ticket `PCK-<order>-<image>-PCK-WEIGHT-KG` + EARN (kg x 20, 2 dp); verified on prod with order `be2f58f2`.
- Live WorkRates row `PCK-WEIGHT-KG` (Packaging, 20 min/kg) added via service account.

## This branch: design only, no code yet
- `designs/bag-tag-70x35.html`: locked bag tag ("1. Ledger — weight tab"): QR left, MAGICWASH centred, black tab with weight + full-width timestamp, rule, barcode + customer code; content scaled 0.9375 for ~2.5 mm margins (QR ~20.6 mm).
- `designs/order-bag-scan-page.html`: approved Packaging/delivery page: green card (customer, order, TOTAL WEIGHT top-right, BAGS SCANNED x/N + segmented bar), photo-right white rows with scanned check, existing `StickerFab` scan button.
- Owner design rules learned: QR >= 20 mm; black tabs liked; English only; no order id / due date / service on tag; change one thing at a time when refining; verify (overflow + QR decode) before showing.

## Bag tag print plan (proposed, not approved)
- Trigger server-side after a WEIGHT order image append succeeds (beside weight-photo-ticket hook); failures logged, never fail the save.
- `POST /print-bag-tag` to MagicwashInvoice: `{ orderImageId, customerIndex, weightKg, weighedAt }`; printer owns layout/formatting (TSPL, 70x35, QR + Code128 = orderImageId).
- Open: missing customerIndex -> "—"?; QR = id only?; `BAG_TAG_PRINT_ENABLED` env default off?; is 70x35 stock loaded in the TSC?

## Bag-scan page plan
- QR on each bag tag = orderImageId, so a scan matches a weight-photo row.
- Open: store scanned state on device vs in a sheet (shared, records who scanned).

## Next step
- Get the owner's answers above, write a plan, then dispatch implementation (printer repo first, then webapp-vue); one Codex job at a time.
