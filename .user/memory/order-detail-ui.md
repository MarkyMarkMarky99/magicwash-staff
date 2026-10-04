# Order detail UI — pending items

  - Phone-test `PhotoViewer` (merged 2026-09-27 on order detail, gallery, photo library): pinch/double-tap zoom, pan while zoomed, swipe-down close, thumbnail strip, safe areas.
  - Browser-check gallery "ย้ายไปรายการอื่น": the item picker must open above `PhotoViewer`.
  - Deferred by user: close X inside the photo corner (needs a dark disc).
  - Phone-test the order photo library: long-press drag-select, edge auto-scroll, glass refraction (now on Select too), black glass labels, lime selected-tab contrast, and single-request Move to item.
  - Phone-test Register garments without an item, then assigning those photos from the library.
  - Bulk photo reassign (one all-or-nothing request) is pushed but not browser-verified end to end.
  - 31 legacy photo ids were stored as numbers by Sheets (user: leave them); a bulk move including one returns 500 although the write lands.
  - Deferred: shared `LiquidGlass` component + `provideGlassBackdrop`; lens code lives in `features/orders` for now.
  - Decide whether the Items menu "Garment album" is retired in favour of the photo library.
  - Quantity-mismatch approval guard is frontend-only by user decision; the API still accepts APPROVED on mismatch.
  - `OrderDetailSheet.vue` re-implements the item row and the store's load/sequence logic instead of reusing `OrderItemRow` and `useWorkOrderStore`.
  - Order-detail header is taller than the sheet's; the menu button footprint was reduced but the result is unverified in a browser.
  - `orderImageTypeLabels` and `serviceTypeLabel` still return Thai on the now-English order-detail page; decide whether shared labels follow.
  - Order-item unit removal is not browser-verified: check the add-item form and that invoice seeding still shows `kg` for wash-dry-fold.
  - `docs/features/orders/` widely still says orders are unimplemented or blocked on `/api/orders`: `flows.md`, `screens.md`, `overview.md`, `data-model.md`, `forms/create-order-item.md`, `contracts/work-order.md`, `list-response-fields.md`.
  - `OrderDetailPage.vue` holds its whole template on one physical line, so diffs there carry no signal.
  - Browser-verify the hero pcs/kg cell and that WEIGHT capture closes the camera after one photo.
  - Total weight counts only `imageType` exactly `WEIGHT`; legacy spellings on old rows are not summed.
  - Order list shows pcs only; user declined adding weight there (would need `totalWeightKg` on the work-order list).
  - Browser-verify the customer order sheet's Items actions dropdown (replaced the four big buttons and the collapse chevron).

