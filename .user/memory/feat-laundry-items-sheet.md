# feat/laundry-items-sheet

- New workbook `MagicwashLaundryItems` (env `LAUNDRY_ITEMS_SPREADSHEET_ID`), tab `LaundryItems` (A..L, L = `image_url` cover photo), registry `LaundryItems.json`.
- Backend only: `/api/laundry-items` GET list/item, POST (409 on existing tag), PATCH; no UI, no flow integration.
- Gates passed: typecheck api/web, dry tests, live column parity, live create/409/patch/get/soft-delete.
- Not deployed (owner: commit first). Prod env set; Vercel Preview env missing (CLI loops on branch prompt), add in dashboard if needed.
- Live sheet holds 125 rows backfilled from 2026-10-22 garment registrations (owner exception to no-backfill) with image_url = lh3 Drive URL of AI flat-lay images (Drive Magicwash/LaundryItemImages, <tag>.png); wash_program empty.
- Timestamps read back as GViz `Date(...)`; owner declined Plain text formatting (2026-10-23).
- `wash_program` is free text until WashPrograms is split into parent + steps.
