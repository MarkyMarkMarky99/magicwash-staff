# feat/wash-queue-open-access

- Owner request 2026-10-10: every signed-in staff can book, load, unload, pick up, cancel any basket; FIFO load lock removed.
- Swipe hint line removed; page opens on Waiting (`?tab=all` for All); empty Dryer/Washer views show the tab's section header + Photo button.
- `tag_code` (A–Z, one pool for washer+dryer, no duplicate check, required on new bookings) in contracts, API, booking dialog, row badge; G Drive WashQueue.json updated.
- `wash_options` = `{ program, steps[] }` (design-4: program stickers, long-press drag steps, custom product dropdown, stain_removal step); read-only WashProducts + WashPrograms sheets/APIs; both tabs exist with headers only, owner fills them.
- Open: invalid WashPrograms rows are skipped silently (proposed: hide the whole program); WashPrograms cols G:H should be Plain text (GViz mixed-type nulls).
- Debt: wash-program.css is a namespaced global file, and the booking dialog restyles the shared overlay frame via :global(:has()).
- Order: deploy first, then add WashQueue columns `tag_code` (V) and `wash_options` (W); until then new bookings fail.
- Dev preview of the booking dialog: `/#/dev/wash-queue-book` (dev only, saves nothing).
- Not browser-checked on the real page as a non-admin.
