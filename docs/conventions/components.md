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
`BaseBadge.vue` has sizes `sm` (dense list rows and counts) and `lg` (headers, hero statuses, and date chips), tones neutral, brand, accent, lime (solid lime with dark green text, for statuses on dark brand surfaces), info, warning, success, and danger, and a solid variant for danger only.
`SquareImageCard.vue` is a generic square image card with nullable image, optional text lines, and an optional badge slot.
`DropdownPillTrigger.vue` is the shared pill button with an open-state chevron for `BaseDropdown`'s trigger slot; it takes `label`, optional `ariaLabel` (falls back to `label`), and the trigger slot values `open`, `setTrigger`, `toggle`, `triggerAttrs`.
`BottomNavBar.vue` is the shared bottom navigation bar: a brand-green bar with rounded top corners, equal-width icon-over-label buttons, and a safe-area bottom inset. It takes `items` (`{ key, label, icon }[]`, Material Symbols names), `activeKey`, and `ariaLabel`, and emits `select(key)`; the active item gets a filled icon and `aria-current="page"`. It overlaps the content above it by 24px (`-mt-6`) so that content shows behind its rounded corners; the scroll area above needs at least that much bottom padding. It does not navigate: place it as the last child of `AppLayout`'s column, and the caller owns the route change. The active item sits on a lime pill.
`NavSidebar.vue` is the route-owned navigation drawer behind the app shell. `App.vue` renders it and
slides the shell to reveal it; tapping or dragging the shifted shell left closes it. `AppHeader.vue`
opens it through `use-nav-drawer.ts`. It shows the staff-management entry only when the injected
`staffAdminKey` is true.
`CompletionRing.vue` is the shared 164px completion ring: a progress arc with a "Completed" caption on the top arc, "{completed} of {total}" on the bottom arc, a centre `label`, and the percentage riding the arc head. It takes `percentage`, `completed`, `total`, `label`, and `tone` (`onLight` by default, or `onDark` for the dark report pages). Job-ticket order cards and the order report use it.
`DateTabs.vue` is the shared month day strip: a month label between previous and next arrows over a horizontally scrolling row of weekday and day buttons, with today underlined and the selected day marked and scrolled into view. It takes `year`, `month` (0-based) and `selectedDate` (`YYYY-MM-DD`), and emits `dateSelect(date)`, `prevMonth` and `nextMonth`; the caller owns the month change. It has no text colour of its own: place it in a `bg-primary text-on-primary` wrapper. The appointment schedule and the order list use it.
`ListContainer.vue`'s search row stays open until its magnifier is pressed again, unless the caller sets `closeSearchOnOutsideClick`: then a pointer press outside the row and the magnifier closes it, except inside a `BaseDropdown` panel (teleported to body). Leave it off where a `search-actions` button opens a panel in the list body, as price list, invoices and customer packages do. The order list turns it on.
`CloseButton.vue` is the shared 40px round icon button for page and overlay exits and navigation. It accepts an `icon` (Material Symbols name, default `close`), `label` (default `Close`), and `tone` (`onLight` by default, or `onDark`). Keyboard focus uses a lime ring on light surfaces and a lime icon on dark surfaces. Callers own its position and text colour.
`StickerFab.vue` is the shared 72px floating action button: a lime squircle tilted -7°, with an offset shadow, a glyph from the default slot above a short `label`. It also takes `ariaLabel`, `disabled`, `saving`, and `savingLabel` (default `Saving…`); while saving it turns green, swaps the glyph for a spinner, and ignores clicks. It emits `click`. Callers own its position. The order-detail Approve action and the department-page Scan action use it.
`PhotoViewer.vue` is the shared full-screen photo viewer built on PhotoSwipe: swipe between photos, pinch or double-tap to zoom, swipe down to close, a `3 / 12` counter, a `CloseButton`, and a thumbnail strip when there is more than one photo. It takes `images` (`{ id, src, alt }[]`) and `activeId`, and emits `change(id)` and `close`; it opens whenever `activeId` matches an image. It mounts in `#overlay-root` and sizes PhotoSwipe to that element, so it stays inside the app column like every other overlay. It knows nothing about orders. The caller owns the open state in the URL: `push` a query key to open, `replace` it on `change`, and on `close` go back if it pushed (otherwise remove the key), so Back closes the viewer instead of stepping through photos. Image sizes are read from the loaded files, so no size data is needed. Order detail uses `?photo=<orderImageId>`, a query on the same route, so the page's `orderId` watcher never clears its stores while the viewer is open.
`FormToggleInput.vue` is a card for an optional text field: an optional `icon` slot, a label with an optional `description`, and a `FormSwitch` on the right. It takes `id`, `label`, `inputLabel` (the field's accessible name), a string `modelValue`, and optional `description`, `placeholder`, `type`, `inputmode`, `autocomplete`. By default it starts on when `modelValue` is not empty. Callers may bind optional `v-model:enabled` to control and observe whether the field is open independently of its text value; this allows an enabled optional field to remain blank. Switching on slides the label out and the field in on the same row, then focuses the field; switching off slides the label back and emits `''`, so a hidden field never carries a value.

`PullToRefresh.vue` is the shared pull-to-refresh scroll region, a drop-in for `ScrollRegion` on pages that opt in by passing `refresh: () => Promise<void>`; every other attribute (`as`, `class`, ...) is forwarded to the inner `ScrollRegion`. Dragging the body down while it is scrolled to the top (touch, or the mouse for desktop testing) moves the body down at half the drag distance, up to 96px, while the app header stays put; the gap shows `bg-primary` with a lime refresh icon that turns with the pull and the body's top corners round. Releasing at 64px or more calls `refresh`, holds the body at 56px with a spinner until the promise settles, then closes in 250ms; releasing earlier springs back without calling it. It reacts only to a mostly vertical downward drag, calls `preventDefault` only while pulling, ignores a new pull during a refresh, and drops the animation under `prefers-reduced-motion`. The caller invalidates and reloads inside `refresh`; the component and its `use-pull-to-refresh` composable know nothing about data. The gesture maths is in `src/shared/utils/pull-to-refresh.ts`. The Orders report page uses it.

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
