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

## Verification

For a navigation or overlay change, verify the affected flow both from in-app navigation and after
a refresh on its deep link. Check that browser Back closes a route-owned overlay without skipping
the underlying page, and that filter query state does not gain an unwanted Back entry. Include the
customer order sheet, gallery camera, invoice flow, and appointment flow when the change affects
them.

## References

- `src/features/customers/composables/useOrderSheetRoute.ts` — query-parameter overlay template
- `src/features/gallery/routes.ts` — CameraOverlay path/route-metadata exception
