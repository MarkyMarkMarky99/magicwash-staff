# feat/order-photo-library

- Branched from local `main` at `bcb78ab` (customer order card + swipe widths), which was not yet pushed to `origin/main`.
- Adds `/orders/:orderId/photos` (`OrderPhotoLibraryPage.vue`, `use-photo-drag-select.ts`); spec in `docs/design/order-photo-library.md`.
- Pending: phone test of long-press drag-select, edge auto-scroll, and scroll blocking during drag.
- Pending: phone test of Move to item against real LaundryPhotos/AfterPhoto rows.
- Open: whether "Garment album" in the Items menu should be retired in favour of this page.
- Glass controls refract via `GlassLens.vue` + `use-glass-lens.ts` (lens copy of photos, SVG filter); tuned with the user over several previews.
- Deferred by user: shared `LiquidGlass` component + `provideGlassBackdrop` (needs a dedicated shared-component refactor).
- Deferred by user: bulk photo-reassign endpoint (`updateMany`, 35 → 5 requests for 7 photos); client now runs 4 PATCHes in parallel.
