# feat/bag-items-sheet

- Done: registry `BagItems.json` in G Drive; live tab `BagItems` in the Orders workbook (6 cols, parity PASS 2026-10-08); contract, repository, `GET`/`POST /api/bag-items` (staff auth, idempotent on bag_id + laundry_item_id).
- Decided: a bag = one OrderImages row (WEIGHT for kg work, new type PACK for wash-dry-iron, hung or folded); every bag has a photo; no `Bags` sheet.
- Decided: weighing happens only after packing; WEIGHT bag = outbound bag.
- Not built: PACK image type, Pack-department UI to scan garments into a bag, customer `/b/:id` showing the bag's garments.
- Open: does Pack scan garments into the bag after the bag tag prints (recommended) or before weighing?
- Next: push; merge with or before `feat/bag-scan-delivery`.
