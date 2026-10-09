# LaundryPhotos batch append (temporary fix, not started)

Agreed 2026-10-09. Stopgap until the app-wide write outbox exists.

## Design
- Each photo uploads to Firebase as soon as tag + photo are ready (unchanged).
- Sheet rows are held, mirrored to localStorage per order, and sent in ONE batch append.
- Rows carry a client-made `id`; server skips ids already in the order (replay-safe).
- On close, wait for in-flight Firebase uploads, then send the one batch.

## Send triggers
- Registration closes: Back, X, done (watch on `isRegistrationOpen`, OrderDetailPage.vue ~295).
- Screen off / app switch: `visibilitychange` hidden, `fetch` with `keepalive`.
- Leaving the order page: `onBeforeUnmount` / `onDeactivated` (page is in KeepAlive).
- Opening the order again: send leftovers from localStorage.

## Failure UX
- Batch failed: show "ยังไม่ได้บันทึก N รูป" + retry button; auto-retry on next open of that order.
- No counter while the camera is open.

## Touch points
- Contract: batch request schema in `contracts/laundry-photos/laundry-photo-api.schema.ts`.
- Server: `POST /api/laundry-photos/batch` beside `reassign` in `laundry-photo.module.ts`; repo `batchAppend` exists.
- Client: `createLaundryPhotosBatch` in `src/data/laundry-photos/laundry-photo.service.ts`; keep `createLaundryPhoto` (BEF album uses it).
- `saveRegistration` in `OrderDetailPage.vue`; enable the X in `GarmentRegistrationCamera.vue` (now disabled while uploading).
- Tests under `tests/server/unit/modules/laundry-photos/`, `route-registry-laundry-photos.dry-test.ts`, `tests/web/unit/data/laundry-photos/`.
- Docs: `docs/features/orders/garment-registration.md`, `order-detail-screen.md`.

## Open decisions
- Approve while rows are unsent loses TAG-PHOTO tickets + EARN; proposed: disable Approve while the order has unsent rows.
- Cross-device duplicate tag: dropped 2026-10-09, needs one physical tag scanned on two phones in one order; practically impossible.

## Known effects
- Photo counts, album and library update after close, not per photo.
- `createdAt` is batch time for every row unless the client sends capture time.
- Local duplicate-tag check must include localStorage leftovers.
- Hole kept: a photo still uploading when the app is killed is lost (fixed only by the IndexedDB outbox).
