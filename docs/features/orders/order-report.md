# Order report

`GET /api/order-reports?period=day|week|month&date=YYYY-MM-DD` requires approved staff and returns one summary object in the normal success envelope, not a page. `period` is required; `date` is optional and defaults to the current Asia/Bangkok day. An invalid `period` or a `date` that is not a real `YYYY-MM-DD` day returns 422 before any sheet is read. The contract is `contracts/order-reports/order-report-api.schema.ts`; the module is `server/modules/order-reports/`.

## Source and attribution

The service reads the whole OrderForm sheet once per request through the work-orders repository and field map, then aggregates in memory with the pure function `buildOrderReport`. Rows with a blank `orderId` or a `receivedDate` that is not a real calendar day are ignored. `receivedDate` is normalised with the shared sheet helpers, so a GViz `Date(y,m,d)` cell, a plain `yyyy-MM-dd` string, a `yyyy-MM-dd HH:mm:ss` string, and an ISO value with an offset (converted to Bangkok) all resolve to one Bangkok calendar day. An order belongs to that day.

## Ranges

All ranges are inclusive `YYYY-MM-DD` days.

- `day`: `range` is `[date, date]`; `previousRange` is the day before.
- `week`: `range` is the 7 days ending at `date` (`date-6` to `date`); `previousRange` is the 7 days before that.
- `month`: `range` is the whole calendar month containing `date`, first to last day, even when that month is the current one; `previousRange` starts on the first day of the previous calendar month. When `date` and today in Asia/Bangkok are in the same calendar month, it ends on today's day of the month, clamped to the last day of the previous month. Otherwise it ends on the last day of the previous month.

## Counting rules

- `CANCELLED` orders are excluded from `totals.orders`, `totals.pieces`, `status`, `byService`, `series`, `previousTotals` and `sevenDayAverage`. They appear only in `totals.cancelled`, which counts cancelled orders inside `range`.
- `pieces` is the sum of `quantity`; a missing quantity counts as 0.
- `status.pending` counts `PENDING`; `status.inProgress` counts `RECEIVED`, `SUBMITTED` and `APPROVED`; `status.completed` counts `COMPLETED`. An order with any other or blank status counts toward `totals.orders` but toward none of the three buckets.
- `byService` always has five entries in the fixed order `WSIR`, `DRCL`, `IRON`, `WASH`, `OTHER`. Any other or blank `serviceType` counts as `OTHER`.
- `sevenDayAverage` is the non-cancelled orders over the 7 days ending at `date`, divided by 7, rounded to one decimal, for every `period`.

## Days

`days` holds the per-day detail so the screen needs no request to show one day. `day` and `week` return one entry per day of the 7 days ending at `date`, in ascending order, the same days as `series`; `month` returns an empty array. Each entry is `{ date, totals, status, byService, sevenDayAverage }` with the shapes and rules above applied to that single day: `totals.cancelled` counts that day's cancelled orders, `byService` has the five fixed entries, and `sevenDayAverage` is the non-cancelled orders over the 7 days ending at the entry's `date`, divided by 7, to one decimal. An entry equals the shared fields of `period=day` for that date.

## Series

- `day` and `week` return the 7 days ending at `date`, one entry per day, with `from` equal to `to` and `label` the three-letter English weekday (`Mon`).
- `month` returns weekly buckets of the month: `W1` is days 1-7, `W2` 8-14, `W3` 15-21, `W4` 22-28 and `W5` 29 to the last day. `W5` is omitted when the month has 28 days.
- Series `orders` follow the same cancelled exclusion as the totals.

## Screen

The page lives at `/reports/orders` (`src/features/order-reports/`), is listed in the navigation menu as "Orders report", and is open to every signed-in staff member. It is a dark page in the style of the staff profile: `bg-on-surface` with `on-primary` text and `border-on-primary/10 bg-on-primary/5` cards. `src/data/order-reports/order-report.service.ts` reads the endpoint.

The screen offers two periods, Week and Month; the selected-day detail comes from the week response's `days`, so the screen never requests `period=day`. The view is route-owned query state, replaced rather than pushed: `period` is `week` or `month`, `date` is a `YYYY-MM-DD` day ending the week (or inside the month), and `day` is an optional selected day inside the week. A missing or unknown `period` is `week` (an old `day` link opens the week). A missing, invalid or future `date` is today in Asia/Bangkok. `day` is dropped unless the period is `week` and the day lies in the 7 days ending at `date`. The default view carries no query at all. Switching period or moving with the arrows clears the selected day and, for a period switch, resets the date to today.

Layout, top to bottom:

- Title "Orders report" and the subtitle "Orders received, by service and status".
- A period header. `week` shows "Last 7 days · from – to" between previous and next arrows that move seven days (next is disabled once the range ends today). `month` shows a previous and next month navigator (next is disabled on the current month); its arrows land on the first day of a past month and on today for the current one.
- The period total and a change badge against `previousTotals.orders` (hidden when that is 0). The comparison line says "Previous 7 days" for week; for month it says "Same days last month" when `previousRange` ends before the last day of its own month, otherwise "Previous month". The total describes the whole selected period, and the comparison uses the previous range described above.
- The completion block: a ring of `completed / totals.orders` (0 when there are no orders) with the order total in the centre, beside Pending, In progress and Completed cards whose fill width is their share of the total. Under it one line: pieces and cancelled, plus, for a selected day only, the percentage of the seven-day average with the average in brackets, left out when the average is 0. With no day selected it describes the whole period; with a day selected it describes that day, taken from the loaded week's `days` entry, under a lime label naming the day.
- `week`: an "Orders per day" picker with no card background. Each of the 7 days in the week response's `series` is one tappable column with its order count, a bar and the weekday and date as the label. Tapping a day selects it (lime) and tapping it again returns to the whole week. Nothing is selected when the week opens.
- `month`: an "Orders per week" chart of the `W1`–`W5` buckets with today's bucket in lime.
- "By service" rows with orders, pieces and a lime bar for the share of orders, for the same scope as the completion block. The Other row is hidden when it has no orders. When that scope has no orders the card is replaced by "No orders this day." or "No orders in this period."

A floating Week and Month pill is pinned to the bottom of the screen above the scroll region, which has bottom padding so the last card is never covered. A failed load shows an error with Retry, which reloads the period; the page shows "Loading report…" until the response for the current period and date arrives. Selecting a day makes no request. The page reloads each time it is reactivated, and a new Bangkok day moves the default date.

## Cache

`/api/order-reports` is cached for one hour in the shared response cache, served stale-first: a cached response paints at once and, once older than an hour, is refreshed in the background and swapped in. Each period and date is its own entry. `createWorkOrder` and `updateWorkOrder` (`src/data/work-orders/work-order.service.ts`) call `invalidate('/api/order-reports')`; they are the only frontend writes to OrderForm columns the report reads (receivedDate, serviceType, status, quantity). Invoice and order-item writes touch no such column. A change made from another device or typed into the sheet shows after the hour, after pull-to-refresh, or after the navigation menu's refresh.

## Pull to refresh

The scroll region is the shared `PullToRefresh` (see `docs/conventions/components.md`). Pulling the body down at the top calls `invalidateOrderReports()`, which drops every cached report, then reloads the current period and date; the spinner stays until that response arrives or fails.
