# Branch — `feature/department-ring-head`

## Status

- Completion ring extracted to `src/features/job-tickets/components/CompletionRing.vue`: percent pill rides the arc head, centre shows `customerIndex`.
- Not browser-verified in motion: no QR tags to change a status yet.

## Next

- Check the pill sits centred on the stroke at 12/3/6/9 o'clock and follows the arc when a status changes.
- Tap-to-advance and order Start button built (single scan path); tap shows saving/failed on an icon badge.
- Order card expands to show its garment photos inside the card; photo grids use 8px gaps.
- Garment status icon is ghost (no background, #f2f4f4 glyph); ring and stat tiles polish was tried and reverted.
- Department list drops tickets completed before today, so the ring under-counts (be2f58f2 shows 0 of 3, real 2 of 5); fix under discussion.
