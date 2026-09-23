# Order photo library

Route `order-photo-library` (`/orders/:orderId/photos`), opened from the order-detail Items menu
("Photo library"). It shows one order's garment photos: Before (`LaundryPhotos`) or After
(`AfterPhoto`). Order images (weight, document, belonging) are a separate system and do not appear
here.

## Layout

- Full-bleed page without `AppHeader`. The photos scroll under floating controls.
- Top left: large title (Before or After) and a subtitle with the order id and photo count, or the
  selection count while selecting. A dark gradient keeps the white title readable over photos.
- Top right: a glass capsule button, Select or Cancel.
- Bottom: a glass circle Back button and a glass segmented capsule, Before | After. While
  selecting, this is replaced by a capsule with the selected count and **Move to item**.
- Photos are a three-column square grid with 2px gutters, grouped into sections by order item, in
  the order's item order. Photos whose item is missing or unknown go in a final "No item" section.

## Glass controls

- The bottom controls refract the photos behind them. Each control holds a lens layer: copies of
  the grid photos under it, positioned to match the scroll, bent by an SVG displacement filter with
  a slight per-channel spread for chromatic edges. A CSS `filter: url(...)` on content is used
  because WebKit does not paint SVG filters in `backdrop-filter`.
- The displacement map is generated per control size: neutral in the middle, bending toward the
  rounded edge. Select stays a frosted light capsule without a lens.

## Selection

- Select enters selection mode; a tap toggles a photo.
- A long press (350 ms) on a photo, in either mode, enters selection mode and starts a drag
  selection. Dragging selects every photo between the pressed photo and the one under the finger,
  across sections. If the pressed photo was already selected, the drag deselects instead. Dragging
  near the top or bottom edge auto-scrolls.
- Moving the finger before the long press fires is a normal scroll.

## Move to item

- Opens a bottom picker listing the order's items. An item is disabled when every selected photo
  already belongs to it.
- Photos are reassigned through the photo type's single-photo `PATCH`, up to four requests in flight; photos already on the
  target item are skipped. On full success selection mode ends. On partial failure the failed photos
  stay selected and a message reports how many moved.

## Route state

- `type=AFT` selects After; Before is the default and has no query value. Replace-only filter state.
- `photo=<id>` opens the photo lightbox and `move=1` opens the item picker. Both are route-owned
  overlays per `docs/conventions/navigation.md`.
