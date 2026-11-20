# Stock-take

A stock-take is a one-shot, shop-wide count. Staff scan every garment tag where it physically sits, then an admin reviews a per-order report and applies corrections to job tickets. The design, data model and apply rules are in [the stock-take plan](../../plans/stock-take.md); the routes, roles and freeze are in [Stock-take routes](../../architecture/backend/operations.md). This page describes the two screens.

All UI text is English. The data layer is `src/data/stock-takes/` (`stock-take.service.ts`, `stock-take.store.ts`); the feature is `src/features/stock-take/`.

## Routes and roles

- `/stock-take` (`stock-take-count`): the Count page. Every signed-in staff member. The side menu lists it under Departments as "Stock-take". The route sets `ownsWorkScan`, so the app-level garment scanner stays off and this page reads scans itself.
- `/stock-take/manage` (`stock-take-manage`, `meta.parent = stock-take-count`): the Manage page. Admin only; any other role is redirected to the Count page. Admins reach it from the "Manage" button on the Count page.

## Count page

Loads the active session on open, on returning to the page and when the signed-in operator changes. States:

- No session: "No stock-take in progress" with a Refresh button.
- Session `CLOSED`: "Counting has ended. An admin is reviewing the results". Scanning is off.
- Session `OPEN`: the counting view below.
- A load error shows the server message with Try again. A shared device account without a staff card scanned shows "Scan your staff card to start counting" and does not scan; scanning a card with the hardware scanner refreshes the page. A camera read of a staff card is passed to the operator store for device accounts and ignored otherwise.

The counting view has:

- A zone picker. The zone is a department (Washing, Dry Cleaning, Ironing, Packaging) crossed with a status (Pending, In Progress), plus Packed. The chosen zone stays selected between scans and is restated as "Counting <zone>". Changing zone clears the current bag.
- In Packed, a Bag panel. Scanning a bag QR (an `MWB-` code or a `/b/<bagId>` URL) sets the current bag and shows it; every following garment scan carries that bag. Scanning another bag QR switches bag. "Bag has no QR" sets the bag to none, and garment scans then carry no bag; pressing it again clears that choice. A garment scan in Packed with no bag chosen is refused with a message. A bag QR scanned outside Packed is refused.
- Zones other than Packed never send a bag.
- An acknowledgement strip for the last scan (tag, zone and bag, or the refusal reason), with sound and vibration through the shared scan feedback. A repeated tag in the same zone (and bag) is refused locally with "Already scanned here".
- A running "N scanned" count, "N waiting to send" when the queue is not empty, and the last eight scans, each marked Waiting or Saved.

Scanner input: the hardware (keyboard-wedge) scanner is read by `useScannerGunInput` whenever the page is active, counting is on and the camera overlay is closed; staff-card codes are left to the app-level operator handler. The camera is the shared `QrScannerOverlay`, opened by the Scan button and owned by the route through the `scan=1` query (Back closes it). Camera reads go through the same input handler as hardware reads.

Sending: each accepted scan joins a queue that is mirrored to `localStorage` per session and restored on reload. The queue is sent through `stockTakeAction('scans', ...)` in batches of up to 50, one request at a time. The server is idempotent on session, tag, zone and bag, so a retry never double counts. Failure handling:

- Network failure, timeout, 429 or 5xx: the batch stays queued, a notice says so, and it retries with growing delay, when the browser comes back online, and on "Retry now".
- 401 or 403 (for example a device without a card): the queue is kept and the server message shows; "Retry now" sends again.
- Any other 4xx, including 409 when the session is no longer open: the batch is dropped from the queue and the display, the message shows, and the active session is reloaded.

Scans never write job tickets. The page does not sync live; it learns the session ended when a send is rejected, on a manual refresh or when the page is reopened.

## Manage page

Loads the active session on open. The session card shows id, status badge, who opened it and when, close and end times, and notes. With no active session it shows optional notes and "Open stock-take". Server error messages are shown as they come.

Buttons are enabled by session status:

The page has two session buttons, so the whole flow is Open, scan, Finish:

- Finish: `OPEN` or `CLOSED`, after a confirmation. One server call stops scanning, plans and writes the ticket corrections for every scanned garment, and ends the session. Garments not scanned are left untouched.
- Cancel: `OPEN` or `CLOSED`, after a confirmation. Abandons the count without writing tickets.
- Resolutions: `CLOSED` only (a session left `CLOSED` by an older flow); the normal flow never shows them.

While the session is `OPEN` or `CLOSED` a notice reminds the admin that tickets, bags and garments are frozen.

### Report

The report loads on demand with "Load report" and "Refresh report"; nothing refreshes by itself, and recording a resolution reloads it. A report that belongs to a different session than the active one is hidden. Sections:

- Orders: one row per open order with found, returned, off-site and expected counts and an Accounted or Review badge; a row expands to its garments with their disposition (found, returned, off-site, missing).
- Missing garments: tag, garment type, registration photo, last ticket (department, task, step, status), a logistics hint per bag, and any existing resolution and reason.
- Membership gaps, Conflicts, Unexpected scans, Backward cases, Blocked, Packing exceptions, Dispatch exceptions, Skipped: each lists order, tag and a plain-language reason from the server code, with ticket ids where the server gives them. Empty sections say so.

### Resolutions

Available only while the session is `CLOSED`. Every resolution is recorded through the resolutions route, after which the report reloads and any shown preview is discarded, so the admin previews again before applying.

- Missing garment: Returned, Off-site, Lost or Keep looking. Returned and Off-site require a reason (who, where and when); the Save button reports a missing reason before sending. Lost and Keep looking stay unaccounted.
- Membership gap that is not yet confirmed and whose code is a ticket without a link or a link in only one source: "Confirm link" records `LINK_CONFIRMED`. Other gap codes are listed only, because a confirmation cannot clear them.
- Conflict "claimed by more than one open order": "This order owns the garment" records `LINK_CONFIRMED` for that order.
- Conflict "more than one live task in the zone": one button per ticket id; choosing one records `TASK_PICK` with that ticket.
- Zone and bag conflicts have no resolution and stay listed.

### Finish

Finish ends the session; the page then shows the final session with its end time. Backward, blocked and skipped garments are not written; loading the report afterwards lists them for the owner.

## Department work pages

While a stock-take is active the server refuses advance, start-order and complete-order with `STOCK_TAKE_ACTIVE`. The Department Work page shows "Paused: a stock-take is in progress" instead of a generic failure for those three actions.
