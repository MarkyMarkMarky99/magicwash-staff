# `refactor/base-row-card`

## What is on it

- New `src/shared/components/BaseRowCard.vue`: lead slot, three text lines, top-end and bot-end
  slots. Domain-free; imports nothing from features.
- `BaseSwipeCard` gained `swipeable` and `pressable`. `disabled` still means "a write is in flight",
  not "swipe off" — do not conflate them.
- Seven cards migrated: WaitingPickup, Package, Customer, Invoice, Order, Appointment,
  CustomerPackageListCards. `PriceListCard` was left alone but inherits the BaseSwipeCard changes.
- Written by codex `gpt-5.6-sol` over two rounds; every line reviewed here.

## Round-one defect worth remembering

With `swipeable: false` the first attempt skipped `maxMovement` tracking and emitted `tap` from
every touch release, so scrolling a list navigated. typecheck and every repo check passed while it
was broken. Gesture code has no automated cover in this repo at all.

## Still open

- Not tested in a browser. The checklist is: scroll-and-release must not navigate; tap must open;
  swipe must still work on CustomerCard, AppointmentCard, PriceListCard; OrderCard's two icon
  buttons must not also open the order; focus ring and Enter/Space.
- `OrderCard` with `showCustomerName: false` now puts the date row in line1. Visually unchanged
  because the slot overrides the heading typography — confirm that in the browser.
- Line spacing across every card now comes from `space-y-0.5` in one place; compare against main.

## Decided, do not re-propose

- Every card stays wrapped in `BaseSwipeCard`, swipe locked off where nothing is hidden behind it.
- `BaseRowCard` must not import `CardLeadingIcon` or `BaseBadge`; callers pass them through slots.
