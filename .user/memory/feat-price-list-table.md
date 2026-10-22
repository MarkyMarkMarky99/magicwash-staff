# feat/price-list-table

- Browse page rebuilt as table: subcategory cards, two-line rows, per-service price columns in ALL mode; no variant badge (Thai names carry it).
- Shows only active + `DEFAULT` price group rows (old page leaked corporate prices).
- Owner approved prototype: `.user/price-list-design/price-list.html`.
- Not yet checked: service pill switching, phone width, tap-price → edit form.
- Dropped vs old page: pull-to-refresh, swipe-to-edit, subcategory image tiles, `subcategory` URL param; owner asked 2026-10-22 whether to restore pull-to-refresh, no answer yet (price list is cached 1 h).
- HOUSEHOLD/OTHERS tabs show 0 (no DEFAULT rows); tab underline is white (GenericTabs), not lime.
- `ImageContentCard` no longer used by browse page; check other callers before deleting.
