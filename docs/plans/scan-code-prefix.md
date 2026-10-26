# Plan — Scan code prefixes and garment scan from any page

Status: **built 2026-10-26, not live-tested.** Branch `feat/order-intake-page`.

## Why

Staff should be able to scan a garment tag on any page and see that garment. One scanner gun
serves every page, so a scanned code must say what it is. Every printed code gets a type prefix,
the same way staff cards already start with `MWS-`.

## Decisions

Owner (2026-10-26):

1. Every code the system prints carries a type prefix. This is the shared standard for all new
   prints.
2. The prefix lives only in the printed code. IDs in the sheets do not change.
3. Codes printed before this change stay as they are and are not reprinted.
4. Work pages keep their flow exactly: Intake, department work (every department and status),
   Packaging and Logistics. A scan there never opens garment detail. They accept a code with or
   without its prefix.
5. On every other page a garment tag scan only opens garment detail, with no order (shared mode).
6. The bag tag QR stays a tracking link (`<BAG_TAG_TRACKING_URL_BASE><id>`), so customers can scan
   it with a phone camera as today.
7. What a bag scan does outside a work page is decided later.
8. `MagicwashInvoice/laundry-tag.html` is unused and is not changed.

Claude (minor):

9. Garment detail opens as a route-owned overlay, so a half-filled form underneath is kept.
10. A tag that is not registered shows a "Tag not registered" notice and opens nothing.
11. The scanner gun is the only input for the any-page scan this round.

## Prefixes

| prefix | code | printed as | built in |
|---|---|---|---|
| `MWS-` | staff card | unchanged | not printed by the system |
| `MWG-` | garment tag | QR `MWG-<tagId>` | webapp, garment tag print request |
| `MWB-` | bag tag | Code 128 `MWB-<orderImageId>`; QR stays the tracking link | webapp backend, bag tag print |
| `MWO-` | order | reserved; no order code is printed today | — |

A prefix is upper case and matched case-insensitively. The part after the prefix is the sheet ID
exactly as stored (garment tag IDs are case-sensitive).

`MWG-` plus an 8-character tag is 12 bytes; it still fits a version 2, level H QR, the same version
an 8-character tag uses today, so the printed QR keeps its size. The longer Code 128 on the bag tag
must be checked on one real print.

## Scan code reader

One shared function turns a scanned string into `{ kind, id }`:

- `MWS-…` → staff card (the full code, as the card login uses today).
- `MWG-<id>` → garment.
- `MWB-<id>`, or a link containing `/b/<id>` → bag.
- `MWO-<id>` → order.
- No prefix → unknown kind with the trimmed text as `id`. Work pages treat it as their legacy
  format (a bare garment tag, a bare bag ID); the any-page scan ignores it.

Every reader below goes through this function first and then keeps its own matching unchanged:

- Intake scan (gun and camera).
- Department work scan (gun and camera).
- Packaging garment-into-bag scan (gun and camera).
- Logistics bag scan (camera).
- Garment registration camera (Register Garments page and order detail registration): the saved
  tag is the ID without prefix.

## Any-page scan

- One app-level gun listener next to the staff-card listener in `App.vue`, for any signed-in
  account, off on public routes.
- Routes of work pages carry a route meta flag that turns it off; there the page's own listener
  owns every scan.
- It acts only on `MWG-` codes this round. Other kinds and codes without a prefix are ignored.
- A garment scan opens the existing garment detail view as a route-owned overlay (query parameter,
  per `docs/conventions/navigation.md`), without `order`. A second scan replaces the open garment.

## Printing

- Garment tag print: the request's `tags[].tagId` carries the printed code `MWG-<tagId>`. The printer
  encodes that field in the QR unchanged, so the printer app does not change. The print contract's
  tag field gets its own schema for the printed code; `laundryTagIdSchema` (the sheet ID) does not
  change.
- Bag tag print: `barcodeValue` becomes `MWB-<orderImageId>`; `qrValue` stays the tracking link.

## Later

- What a bag scan opens outside work pages.
- Order codes (`MWO-`) once something prints them.
- A camera "Find garment" button for phones without a scanner gun.
