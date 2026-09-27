---
last_audited: 2026-08-26
audit_sources:
  - src/shared/components
  - src/shared/layouts
  - src/features/customers/components
  - src/features/appointments/components
---

# Component Conventions

Components should focus on UI.

## Ownership

src/
├── shared/components/              # Generic cross-feature UI
└── features/<feature>/components/  # Feature-specific UI

### Shared Components

- Generic and reusable across unrelated features.
- Must not contain domain-specific business logic.
- Must not depend on `src/features/`, feature stores, or feature services.
- Must not call APIs directly.
- `src/shared/components/` is import-only. Do not add to or modify it outside a dedicated shared
  component refactor; create a feature-local component when an existing shared component does not
  fit.
- List `src/shared/components/` from disk before building a feature-local replacement. Report the
  missing shared capability as a shared gap rather than changing the shared component API.

`AppHeader.vue` is a legacy exception: it reads the appointment store for the global pending count.
Do not add similar feature dependencies to shared components; remove this exception only in a
dedicated shared-component refactor.

See [Shared QR scanner overlay](./qr-scanner-overlay.md) for the camera-only overlay API.
`BaseBadge.vue` has sizes `sm` (dense list rows and counts) and `lg` (headers, hero statuses, and date chips), tones neutral, brand, accent, info, warning, success, and danger, and a solid variant for danger only.
`SquareImageCard.vue` is a generic square image card with nullable image, optional text lines, and an optional badge slot.
`DropdownPillTrigger.vue` is the shared pill button with an open-state chevron for `BaseDropdown`'s trigger slot; it takes `label`, optional `ariaLabel` (falls back to `label`), and the trigger slot values `open`, `setTrigger`, `toggle`, `triggerAttrs`.
`BottomNavBar.vue` is the shared bottom navigation bar: a brand-green bar with rounded top corners, equal-width icon-over-label buttons, and a safe-area bottom inset. It takes `items` (`{ key, label, icon }[]`, Material Symbols names), `activeKey`, and `ariaLabel`, and emits `select(key)`; the active item gets a filled icon and `aria-current="page"`. It overlaps the content above it by 24px (`-mt-6`) so that content shows behind its rounded corners; the scroll area above needs at least that much bottom padding. It does not navigate: place it as the last child of `AppLayout`'s column, and the caller owns the route change. The active item sits on a lime pill.
`CloseButton.vue` is the shared 40px round close X for every page and overlay exit. It accepts a `label` (default `Close`) and `tone` (`onLight` by default, or `onDark`). Callers own its position and text colour.
`PhotoViewer.vue` is the shared full-screen photo viewer built on PhotoSwipe: swipe between photos, pinch or double-tap to zoom, swipe down to close, a `3 / 12` counter, a `CloseButton`, and a thumbnail strip when there is more than one photo. It takes `images` (`{ id, src, alt }[]`) and `activeId`, and emits `change(id)` and `close`; it opens whenever `activeId` matches an image. It mounts in `#overlay-root` and sizes PhotoSwipe to that element, so it stays inside the app column like every other overlay. It knows nothing about orders. The caller owns the open state in the URL: `push` a query key to open, `replace` it on `change`, and on `close` go back if it pushed (otherwise remove the key), so Back closes the viewer instead of stepping through photos. Image sizes are read from the loaded files, so no size data is needed. Order detail uses `?photo=<orderImageId>`, a query on the same route, so the page's `orderId` watcher never clears its stores while the viewer is open.

### Feature Components

- May understand the owning feature's domain.
- Keep feature-specific components inside their feature.

## Rules

- Keep components focused on UI and interaction.
- Prefer props for input and emits for actions.
- Keep API calls, shared state, and business workflows outside components.
- Local UI state may remain inside the component.
- Do not move a component to `shared/` merely because it is reused within one feature.
- Move to `shared/` only when genuinely reusable across multiple features.
- Prefer existing shared components as-is; if one does not fit, create a feature-local component rather than changing the shared API casually.
