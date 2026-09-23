# feat/order-photo-library

- Branched from local `main` at `bcb78ab` (customer order card + swipe widths), which was not yet pushed to `origin/main`.
- Adds `/orders/:orderId/photos` (`OrderPhotoLibraryPage.vue`, `use-photo-drag-select.ts`); spec in `docs/design/order-photo-library.md`.
- Pending: phone test of long-press drag-select, edge auto-scroll, and scroll blocking during drag.
- Pending: phone test of Move to item against real LaundryPhotos/AfterPhoto rows.
- Open: whether "Garment album" in the Items menu should be retired in favour of this page.
