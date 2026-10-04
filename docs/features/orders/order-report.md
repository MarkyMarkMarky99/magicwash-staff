# Order report

`GET /api/order-reports?period=day|week|month&date=YYYY-MM-DD` requires approved staff and returns one summary object in the normal success envelope, not a page. `period` is required; `date` is optional and defaults to the current Asia/Bangkok day. An invalid `period` or a `date` that is not a real `YYYY-MM-DD` day returns 422 before any sheet is read. The contract is `contracts/order-reports/order-report-api.schema.ts`; the module is `server/modules/order-reports/`.

## Source and attribution

The service reads the whole OrderForm sheet once per request through the work-orders repository and field map, then aggregates in memory with the pure function `buildOrderReport`. Rows with a blank `orderId` or a `receivedDate` that is not a real calendar day are ignored. `receivedDate` is normalised with the shared sheet helpers, so a GViz `Date(y,m,d)` cell, a plain `yyyy-MM-dd` string, a `yyyy-MM-dd HH:mm:ss` string, and an ISO value with an offset (converted to Bangkok) all resolve to one Bangkok calendar day. An order belongs to that day.

## Ranges

All ranges are inclusive `YYYY-MM-DD` days.

- `day`: `range` is `[date, date]`; `previousRange` is the day before.
- `week`: `range` is the 7 days ending at `date` (`date-6` to `date`); `previousRange` is the 7 days before that.
- `month`: `range` is the whole calendar month containing `date`, first to last day, even when that month is the current one; `previousRange` is the whole previous calendar month.

## Counting rules

- `CANCELLED` orders are excluded from `totals.orders`, `totals.pieces`, `status`, `byService`, `series`, `previousTotals` and `sevenDayAverage`. They appear only in `totals.cancelled`, which counts cancelled orders inside `range`.
- `pieces` is the sum of `quantity`; a missing quantity counts as 0.
- `status.pending` counts `PENDING`; `status.inProgress` counts `RECEIVED`, `SUBMITTED` and `APPROVED`; `status.completed` counts `COMPLETED`. An order with any other or blank status counts toward `totals.orders` but toward none of the three buckets.
- `byService` always has five entries in the fixed order `WSIR`, `DRCL`, `IRON`, `WASH`, `OTHER`. Any other or blank `serviceType` counts as `OTHER`.
- `sevenDayAverage` is the non-cancelled orders over the 7 days ending at `date`, divided by 7, rounded to one decimal, for every `period`.

## Series

- `day` and `week` return the 7 days ending at `date`, one entry per day, with `from` equal to `to` and `label` the three-letter English weekday (`Mon`).
- `month` returns weekly buckets of the month: `W1` is days 1-7, `W2` 8-14, `W3` 15-21, `W4` 22-28 and `W5` 29 to the last day. `W5` is omitted when the month has 28 days.
- Series `orders` follow the same cancelled exclusion as the totals.

## Screen

The page lives at `/reports/orders` (`src/features/order-reports/`), is listed in the navigation menu as "Orders report", and is open to every signed-in staff member. It is a dark page in the style of the staff profile: `bg-on-surface` with `on-primary` text and `border-on-primary/10 bg-on-primary/5` cards. `src/data/order-reports/order-report.service.ts` reads the endpoint; `/api/order-reports` is never cached because today's numbers change with every new order.

The period and date are route-owned query state, replaced rather than pushed. `period` is `day`, `week` or `month`; `date` is a `YYYY-MM-DD` day. A missing or invalid `period` is `day`. A missing, invalid, future, or (for `day`) older-than-six-days `date` is today in Asia/Bangkok. The default view carries no query at all. Switching period resets the date to today.

Layout, top to bottom:

- Title "Orders report" and the subtitle "Orders received, by service and status".
- A period header. `day` shows seven day tiles for the seven days ending today, the selected day in lime, with a dot under a tile whose day has orders; the dots come from every response the page has received, so a tile after a past selected day has no dot until a response covers it. `week` shows "Last 7 days · from – to" between previous and next arrows that move seven days (next is disabled once the range ends today), then the total orders, a change badge against `previousTotals.orders` (hidden when that is 0) and the "Previous 7 days" line. `month` shows a previous and next month navigator (next is disabled on the current month), the total, the badge and the "Previous month" line; arrows land on the first day of a past month and on today for the current one.
- The completion block: a ring of `completed / totals.orders` (0 when there are no orders) with the order total in the centre, beside Pending, In progress and Completed cards whose fill width is their share of the total. Under it one line: pieces and cancelled, plus, for `day` only, the percentage of the seven-day average with the average in brackets, left out when the average is 0.
- "Orders per day" bars for `day` and `week` (seven days) or "Orders per week" bars for `month`. The lime bar is the selected day for `day`, and today's bar or bucket otherwise.
- "By service" rows with orders, pieces and a lime bar for the share of orders. The Other row is hidden when it has no orders.
- A `day` with no orders shows "No orders this day." instead of the chart and the service card.

A floating Day, Week and Month pill is pinned to the bottom of the screen above the scroll region, which has bottom padding so the last card is never covered. A failed load shows an error with Retry; the page shows "Loading report…" until the response for the current period and date arrives. The page reloads each time it is reactivated, and a new Bangkok day moves the default date.
