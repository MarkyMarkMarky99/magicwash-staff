# fix/wash-queue-camera-swipe

- Booking camera shutter was dead: the open booking sheet made the page inert; the sheet now hides while `?shoot=book` is open.
- Swipe rows: swipe can start on the basket photo, threshold 40, Cancel panel 128px (was 64px).
- Unload weighing + photo temporarily off by owner (2026-10-12): swipe right on In machine unloads at once; flag `UNLOAD_WEIGH_REQUIRED` in `src/features/wash-queue/unload-policy.ts`; see the doc section in `docs/features/wash-queue/wash-queue.md`.
- Row actions: no success toast; errors show on the card for 6 s; busy veil max 1.2 s (`ROW_MOVE_HOLD_MS`), then optimistic move while PATCH finishes; owner phone-tested OK 2026-10-12.
- Card left column shows the tag big with weight under it; tapping a card opens the `?basket=<id>` detail sheet (design B, prototype in `.user/memory/designs/wash-queue-detail-prototype.html`); owner OK'd 2026-10-12.
- Risk: no confirm/undo on swipe-unload; a mis-swipe moves the basket to Ready.
- Typecheck, wash-queue dry-tests and vite build pass; not tested in a browser or on a phone.
- Next: phone-test booking photo and swipe starting on the photo, then merge to main.
