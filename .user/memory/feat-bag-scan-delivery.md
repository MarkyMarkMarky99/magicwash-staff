# feat/bag-scan-delivery

- Committed, not pushed: LOG-BAG ticket per WEIGHT image, order COMPLETED closes open tickets, appointment COMPLETED completes order, bag-scan page, tracking from tickets + DELIVERY photos, image types PICKUP/DELIVERY.
- Live-tested 2026-10-08 (local tsx on prod sheets): orders `97d1967a`, `ee288916` set COMPLETED; 3 + 22 open tickets closed, completed tickets untouched, no EARN rows; their `updated_by` reads `claude-test`.
- Resolved 2026-10-08: nothing is weighed at intake; a WEIGHT image = the outbound packed bag = bag tag id, so LOG-BAG at weigh time is correct. No Bags sheet.
- Merged here 2026-10-08: `BagItems` sheet (live tab, parity PASS) + `GET`/`POST /api/bag-items`; a bag = one OrderImages row (WEIGHT, or future PACK for hung/folded).
- Not built: PACK image type (needs LOG-BAG tickets too), Pack UI to scan garments into a bag, `/b/:id` showing the bag's garments.
- Open: Pack scans garments into the bag after the tag prints (recommended) or before weighing?
- Watch: OrderImages already has legacy `DELIVERY` (2) and `PICKUP` (271) rows; tracking proof may pick a legacy DELIVERY row.
- To do: remove the "Scan bags" link from `OrderDetailPage.vue`; add side-nav Logistics page with the same status filters as other departments (ALL / PENDING / IN PROGRESS / COMPLETED) — decided 2026-10-08.
- Proposed (awaiting owner's go): add Logistics to `DepartmentWorkPage` (departments map + side nav), let `filterTickets` show ORDER-scope LOG-BAG for Logistics, scan resolves a bag-tag QR to its ticket, tapping an order opens `/orders/:id/bag-scan`; same round removes the order-detail link.
- To do: bag-scan page must list bags from JobTickets (photo = `photo_evidence_url`), not OrderImages; weight read from OrderImages by the orderImageId in the ticket id.
- Not tested: phone camera scanning; appointment → order completion on live sheets.
