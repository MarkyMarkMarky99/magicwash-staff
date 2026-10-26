# Branch `feat/order-intake-page`

New full-screen order intake page (`/orders/new/intake/:customerId`), entry "Intake Order" in the customer order-history create menu. Canonical doc: `docs/features/orders/order-intake-form.md`. Prototype: `.user/intake-form-design/variant-a.html`.

Also holds garment registration (merged from `feat/laundry-item-registration` 2026-10-24): Register Garments page (`#/customers/:customerId/garments/register`, doc `docs/features/laundry-items/register-garments-page.md`) and `POST /api/laundry-items/register` (plan `docs/plans/laundry-item-registration.md`).

## Status
- Intake page reworked to scan-only (plan `docs/plans/order-intake-flow.md`): preloads the customer's garments, groups rows by type, Uncategorized row, row sheet, centred scan card; owner tested with the scanner gun on Marky's printed QR sheet.
- Register Garments page browser-checked (tag check, upload at capture, remove/Discard delete Firebase files).
- Register endpoint: batchAppends LaundryItems + REGISTRATION photos, triggers MagicwashAI `{ input: {} }` via `VITE_AI_GATEWAY_URL`. Service live-tested on Marky's order `5aed2e17`: 32 garments kept as real data, AI typed 31.
- MagicwashAI classify now sees active Items only (MagicwashAI `00a6e9d`).
- Garment detail page `#/garments/:tagId` built (doc `docs/features/laundry-items/laundry-item-detail-page.md`, prototype `.user/item-detail-design/zone-5.html`); Intake row sheet opens it as a full-screen overlay.

## Pending
- Register Garments Save → endpoint not yet run in a browser (`vercel dev` needs a restart to load `AI_GATEWAY_SECRET`/`VITE_AI_GATEWAY_URL`).
- Intake Save wired to `POST /api/order-intakes` (commit `1c7eb580`, dry-tested); live browser test pending — checklist below.
- Owner decided 2026-10-25: unregistered tag blocked; tickets + Tagging read OrderGarments (LaundryPhotos fallback); Save ends APPROVED; no defect or weight photos at intake (weight is Packing's). Next: live test with a test order.
- Order `5aed2e17` (created 2026-10-24) uses inactive Items ids — check how staff can still pick inactive types.
- Garment photos on garment detail (plan `docs/plans/garment-photos.md`): built 2026-10-26; one-photo capture + save not tried live; no page links with `?order=` yet.
- Scan prefixes `MWG-`/`MWB-` + any-page garment scan (plan `docs/plans/scan-code-prefix.md`): built 2026-10-26, browser-tested 2026-10-27 with a simulated gun on Marky (plan `.user/scan-prefix-test/plan.md`); pending real gun test, one real print each of a garment tag and a bag tag (longer Code 128), and a real-gun check of the faster garment overlay.
- Garment detail now reads only LaundryItems, LaundryItemPhotos and JobTickets (history from tickets, no service name); measured 2026-10-27: garment shows after one request (~4 s on vercel dev); prod timing not measured.
- Open: garment reads skip the browser cache on purpose (`invalidate` before each read); owner asked why reopening is not instant from cache.
- Server photo create with `orderId` still checks OrderGarments, so it rejects orders that have only JobTickets.
- Garment detail entry points still open: order detail (needs OrderGarments read) and customer Garments tab.
- Garment `DWaIjLch` has empty `created_at` in LaundryItems, so its detail page errors (strict parse).
- Intake only chooses a type for untyped garments (owner 2026-10-24); a registered type is changed on the garment detail page.
- Shared UI consolidation (plan `docs/plans/shared-ui-consolidation.md`) merged in; owner has not yet viewed the Round 7 visual changes; leftover design work in `.user/memory/shared-ui-later.md`.
- 13 dry-test files already failing before the refactor (list in `.user/memory/shared-ui-later.md`).
- Merging to main ships both pages; Intake Save must be finished (or its menu hidden) first.
- Vite `scanic-ml` overlay on camera open under `vercel dev` predates this branch.

## Intake live test checklist (pending; writes real sheets)
- Setup: test customer with 2–3 registered garments, one with no type; `vercel dev` restarted.
- Page: scan each tag; untyped one lands in Uncategorized; Choose type moves it; an unregistered tag is blocked.
- Photos: 1 Document + 1 Customer asset; spinner while uploading; Save stays disabled until done.
- Save: lands on order detail, status APPROVED.
- OrderForm: 1 row, APPROVED, quantity = garment count.
- OrderItemForms: 1 row per type, quantity = tag count, price empty.
- OrderGarments: 1 row per garment, RECEIVED, orderitem_id set, created_by = me.
- OrderImages: 2 rows (DOCUMENT, BELONGING), Firebase URLs, quantity empty.
- LaundryItems: the untyped garment now has item_id.
- JobTickets: tickets per garment per department, photo evidence = registration photo.
- WorkTransactions: Tagging credit to me.
- Error path: a tag of another customer → 409 lists the tag, nothing written.
- Old Approve on an old-page order still creates tickets from LaundryPhotos.
