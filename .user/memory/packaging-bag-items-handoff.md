# Packaging: garments into bags (BagItems) — handoff 2026-10-08

## Goal
- Packaging records which garments go into which bag; Logistics already scans bags onto the van.
- Customer opens a bag tag QR (`/b/:id`) and sees the garments in that bag.

## Already on main
- A bag = one OrderImages row; the bag id = `orderImageId`, printed on the bag tag (QR = `BAG_TAG_TRACKING_URL_BASE` + id).
- Today only WEIGHT images are bags; weighing happens after packing, so a WEIGHT photo = an outbound packed bag.
- Saving a WEIGHT image creates a Packaging credit ticket, a Logistics `LOG-<orderId>-<orderImageId>-LOG-BAG` ticket, and prints the bag tag.
- `BagItems` sheet (Orders spreadsheet, live, append-only): `id`, `bag_id`, `order_id`, `laundry_item_id`, `created_at`, `created_by`.
- `GET /api/bag-items` needs `bagId` or `orderId`; `POST` is idempotent on (`bag_id`, `laundry_item_id`); no update or delete.
- Nothing in `src/` reads or writes BagItems yet.
- Garment identity = tag id (`laundry_item_id`); garment photos live in LaundryPhotos.
- Packaging department page exists (ITEM tickets per garment); see `docs/features/job-tickets/department-work.md`.

## Not built
- PACK image type for hung/folded bags that skip the scale; each PACK image needs its own LOG-BAG ticket and bag tag.
- Packaging UI: scan a bag tag, then scan garment tags into it (writes BagItems).
- `/b/:id` customer page listing the bag's garments.

## Open decisions (owner)
- When Packaging scans garments into a bag: after the bag tag prints (Claude's pick) or before weighing.
- Where the Packaging bag UI lives: on the Packaging department page or its own page.
- Whether a garment may move between bags (BagItems has no update/delete today).

## References
- Bag tag and tracking history: `.user/memory/bag-tags-and-delivery-tracking.md`.
- Contract and API: `contracts/bag-items/bag-item-api.schema.ts`, `server/modules/bag-items/bag-item.module.ts`.
- LOG-BAG provisioning: `server/modules/order-images/bag-logistics-ticket.service.ts`.
