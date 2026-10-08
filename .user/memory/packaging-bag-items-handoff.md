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

## Agreed workflow (2026-10-09)
- Business flow and owner decisions: `docs/features/packaging/workflow.md`.
- Bag page reuses the Logistics order bag page; one Confirm per order writes everything and prints all tags.
- Prototype to reuse for the page look: `.user/memory/designs/order-bag-scan-page.html`.

## Not built
- Packaging order bag page, bag bottom sheet, confirm endpoint, and print contract change (item count, optional `weightKg`, `packedAt`).
- `/b/:id` customer page listing the bag's garments.
- PACK image type: superseded by create-bag unless the owner revives it.

## Open (technical, Claude to propose)
- When the bag photo uploads to Firebase, and partial-failure handling of the one Confirm request.
- Printer-side contract change in C:\MagicwashInvoice.

## References
- Bag tag and tracking history: `.user/memory/bag-tags-and-delivery-tracking.md`.
- Contract and API: `contracts/bag-items/bag-item-api.schema.ts`, `server/modules/bag-items/bag-item.module.ts`.
- LOG-BAG provisioning: `server/modules/order-images/bag-logistics-ticket.service.ts`.
