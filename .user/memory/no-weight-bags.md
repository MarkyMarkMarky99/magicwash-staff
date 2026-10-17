# No-weight packs (hanger / per-piece) — next task, set by owner 2026-10-17

- Problem: Packaging Confirm requires a weight per bag (merged 2026-10-17), so hanger/per-piece orders cannot be confirmed on prod without a fake weight.
- Owner rules: `BAG` is ambiguous with the customer's own bag — do not use it; `quantity` must only ever mean weight.
- Owner floated 2 rows per weighed bag (bag row + weight row); Claude advised against: duplicate identity (tag id / BagItems.bag_id / LOG-BAG), double counting, two-place updates.
- Decided 2026-10-18: 1 row per physical bag; weight entered → `WEIGHT` (kg in quantity), weight left empty → `PACK` (null quantity); no toggle, inferred from the weight field.
- Owner chose inference over Claude's toggle; Claude flagged that a forgotten weight silently becomes `PACK`.
- serviceType (WSIR/IRON/DRCL/WASH) cannot tell hanger from folded, so per-bag inference is the only signal.
- Change map (Codex explore 2026-10-18): draft `canConfirm` + photo gate on weight, Confirm schema `weightKg` required, server writes WEIGHT only, OrderImages enum, total-weight, logistics bag view, `/b/:id`, tag print, 6 dry-tests, packaging/order-image docs.
- Needs: OrderImages API contract enum + owner adds the type to G Drive `OrderImages.json` (agents never edit the registry); tag print shows item count instead of weight; tracking/logistics accept the new type.
- Related leftovers: legacy Packaging `BAG` rows show 0 kg on `/b/:id`; camera overlay still shows the old text scan card.
