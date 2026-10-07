# feat/bag-scan-delivery

- Committed, not pushed: LOG-BAG ticket per WEIGHT image, order COMPLETED closes open tickets, appointment COMPLETED completes order, bag-scan page, tracking from tickets + DELIVERY photos, image types PICKUP/DELIVERY.
- Live-tested 2026-10-08 (local tsx on prod sheets): orders `97d1967a`, `ee288916` set COMPLETED; 3 + 22 open tickets closed, completed tickets untouched, no EARN rows; their `updated_by` reads `claude-test`.
- Resolved 2026-10-08: nothing is weighed at intake; a WEIGHT image = the outbound packed bag = bag tag id, so LOG-BAG at weigh time is correct. No Bags sheet.
- Merged here 2026-10-08: `BagItems` sheet (live tab, parity PASS) + `GET`/`POST /api/bag-items`; a bag = one OrderImages row (WEIGHT, or future PACK for hung/folded).
- Not built: PACK image type (needs LOG-BAG tickets too), Pack UI to scan garments into a bag, `/b/:id` showing the bag's garments.
- Open: Pack scans garments into the bag after the tag prints (recommended) or before weighing?
- Watch: OrderImages already has legacy `DELIVERY` (2) and `PICKUP` (271) rows; tracking proof may pick a legacy DELIVERY row.
- To do: remove the "Scan bags" link from `OrderDetailPage.vue`; add side-nav Logistics list page (open question: list only orders with Pending bags, or also In Progress).
- To do: bag-scan page must list bags from JobTickets (photo = `photo_evidence_url`), not OrderImages; weight source open.
- Not tested: phone camera scanning; appointment → order completion on live sheets.
