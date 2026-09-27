# feat/photo-viewer

- Status: `src/shared/components/PhotoViewer.vue` wraps PhotoSwipe inside `#overlay-root` (app column); order detail opens it with `?photo=<orderImageId>` (push to open, replace on swipe, back on close).
- Based on `feat/shared-close-button`; merge that branch first.
- User confirmed it stays inside the app column on desktop (2026-09-27).
- Next: phone test (swipe vs zoom, swipe-down close, thumbnail strip, Back), then move gallery and photo library to `PhotoViewer` and delete `LightboxOverlay`.
- Keep any viewer route under the same page route: a route without `:orderId` would trigger OrderDetailPage's `orderId` watcher and clear its stores.
- Image sizes are measured from the loaded files (portrait placeholder until then); no size data in sheets.
