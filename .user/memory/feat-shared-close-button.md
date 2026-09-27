# feat/shared-close-button

- Status: `src/shared/components/CloseButton.vue` (login-page design, `label` + `tone`, exposes `focus()`) replaces the close X in login, `BaseOverlayFrame` (Detail/Picker/Lightbox), `FormOverlay`, `NavSidebar`, `QrScannerOverlay`, garment camera, document scanner x2, invoice proof lightbox.
- Lightbox: `backdrop="opaque"`, transparent square panel, image top padding 64px, square images in order detail and gallery.
- Next: browser-check every close X (form overlay, scanners, pickers) and the lightbox, then merge to `main`.
- Deferred by user: close X inside the photo's corner (would need a dark disc behind it).
- Not changed on purpose: notice/error dismiss X, gallery image remove X, list clear-search X, photo library back arrow.
- `order-image-section-preview.dry-test` test 3 fails on `main` too; not from this branch.
