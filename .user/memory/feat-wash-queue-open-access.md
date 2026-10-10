# feat/wash-queue-open-access

- Owner request 2026-10-10: every signed-in staff can book, load, unload, pick up, cancel any basket; FIFO load lock removed.
- Swipe hint line removed; page opens on Waiting (`?tab=all` for All); empty Dryer/Washer views show the tab's section header + Photo button.
- `tag_code` (A–Z, one pool for washer+dryer, no duplicate check, required on new bookings) in contracts, API, booking dialog, row badge; G Drive WashQueue.json updated.
- Order: deploy first, then add sheet column `tag_code` (col V, after `machine_id`) — owner wants Sonnet to add it via browser; until then new bookings fail.
- Dev preview of the booking dialog: `/#/dev/wash-queue-book` (dev only, saves nothing).
- Not browser-checked on the real page as a non-admin.
