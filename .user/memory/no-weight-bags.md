# No-weight packs (hanger / per-piece) — next task, set by owner 2026-10-17

- Problem: Packaging Confirm requires a weight per bag (merged 2026-10-17), so hanger/per-piece orders cannot be confirmed on prod without a fake weight.
- Owner rules: `BAG` is ambiguous with the customer's own bag — do not use it; `quantity` must only ever mean weight.
- Owner floated 2 rows per weighed bag (bag row + weight row); Claude advised against: duplicate identity (tag id / BagItems.bag_id / LOG-BAG), double counting, two-place updates.
- Claude's proposal (not yet approved): 1 row per physical bag; `WEIGHT` = weighed pack (kg in quantity), new type (`PACK` or `HANGER`) = unweighed pack with empty quantity; "all bags of an order" = LOG-BAG tickets (or WEIGHT + new type).
- Open decisions: the new type name; per-bag "weighed / not weighed" choice vs. derived from order serviceType (mixed-service orders are deferred).
- Needs: OrderImages API contract enum + owner adds the type to G Drive `OrderImages.json` (agents never edit the registry); tag print shows item count instead of weight; tracking/logistics accept the new type.
- Related leftovers: legacy Packaging `BAG` rows show 0 kg on `/b/:id`; camera overlay still shows the old text scan card.
