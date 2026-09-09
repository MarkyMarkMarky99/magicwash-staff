---
last_audited: 2026-09-07
audit_sources:
  - src/router/index.js
  - src/App.vue
  - src/features/customers/composables/useOrderSheetRoute.ts
  - src/features/gallery/routes.ts
  - src/features/gallery/pages/OrderGalleryPage.vue
---

# Navigation Conventions

## Routes

Feature routes are flat. Do not introduce nested `children` routes.

## Route-owned overlays

A shared overlay must never call `history.pushState`, `history.back()`, `history.forward()`, or
listen for `popstate`.

An overlay that must close through browser or Android Back is route-owned. The default convention
for new route-owned overlays is a query parameter; `CameraOverlay` is the established exception,
using a path plus route metadata. Other overlays use local state.

Derive route-owned open state from the route. Close with `router.back()` only for an entry pushed by
the current page; on a deep link or refresh, remove the route-owned state with `router.replace`.
Navigation away from an open route-owned overlay also uses `router.replace`.

Filter query state is replace-only; it is not an overlay-dismiss pattern.

## Overlay width

Overlays `Teleport` to `body`, so they sit outside the app shell in `src/App.vue` and inherit none
of its width. The app column is defined once, as `.app-column` in `src/style.css`: full-bleed below
`sm`, `var(--container-app)` centred at `sm` and up.

Any teleported panel that should read as part of the app carries `app-column`. Never restate the
number or the breakpoint at the call site — restating it once already shipped a form overlay capped
at 390px on 430px phones while the page behind it was full width. `BaseOverlay` and `BaseFullOverlay`
apply `app-column` to their panels, so an overlay built on either is correct by default.

Full-bleed overlays are the deliberate exception: `CameraOverlay` and `DocumentScannerOverlay` are
`fixed inset-0` and own their own chrome, including safe-area insets.

## Verification

For a navigation or overlay change, verify the affected flow both from in-app navigation and after
a refresh on its deep link. Check that browser Back closes a route-owned overlay without skipping
the underlying page, and that filter query state does not gain an unwanted Back entry. Include the
customer order sheet, gallery camera, invoice flow, and appointment flow when the change affects
them.

## References

- `src/features/customers/composables/useOrderSheetRoute.ts` — query-parameter overlay template
- `src/features/gallery/routes.ts` — CameraOverlay path/route-metadata exception
- `src/style.css` — `--container-app` and `.app-column`, the single definition of the app width
- `tests/e2e/app-column-width.spec.ts` — regression cover at 430px and 1280px
