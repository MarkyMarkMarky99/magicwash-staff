# Customer detail and visual system — open checks (merged 2026-09-27)

- Browser-verify create dropdowns open, order swipe "Order detail", and appointment date order; the ui-shots run failed to capture these.
- Pill shows `0 PACKAGES` while the list is still loading.
- Order rows show `—` as line 2 when there is no note; long invoice numbers truncate (`INV20260905-41f3…`).
- Package names are long in the `Packages` sheet itself; user to choose renaming them there or showing `packageCode`.
- Browser-check customer detail `BottomNavBar` on a phone: floating lime sticker + pop animation, custom section icons, `pb-14` list clearance.
- Phone-check the push drawer (open, drag-close, Back) and swipe cards no longer moving on scroll.
- Deferred by user: the push drawer's rounded corner sits below the iOS status bar because status-bar-style `black` keeps the page under it; reaching the top edge needs `black-translucent` plus a new height fix.
- Browser-check `CloseButton` onDark sticker style (lime outline squircle, solid lime + offset shadow when active) on header (menu, back, pending with badge) and the 6 dark-overlay X buttons; hover/focus pop animation; also check every shared `CloseButton` placement (forms, sheets, pickers, nav, scanners, invoice proof lightbox).
- Browser-check the palette move (mint/tertiary removed, info = steel blue) and `BaseBadge` sm/lg sizes on order hero card, scanner, form controls.
