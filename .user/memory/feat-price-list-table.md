# feat/price-list-table

- Browse page rebuilt as table: subcategory cards, two-line rows, per-service price columns in ALL mode, BaseBadge warning variant.
- Shows only active + `DEFAULT` price group rows (old page leaked corporate prices).
- Owner approved prototype: `.user/price-list-design/price-list.html`.
- Not yet checked: service pill switching, phone width, tap-price → edit form.
- Dropped vs old page: pull-to-refresh, swipe-to-edit, subcategory image tiles, `subcategory` URL param; owner not yet asked about these.
- HOUSEHOLD/OTHERS tabs show 0 (no DEFAULT rows); tab underline is white (GenericTabs), not lime.
- Sheet data: ITM-0086 ตุ๊กตา has two DEFAULT WASH rows (฿250, ฿300) with no variant; owner to fix.
- `ImageContentCard` no longer used by browse page; check other callers before deleting.
