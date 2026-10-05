# Order list screen

**Route:** `/orders` · **Page:** `OrderListPage.vue` · **Card:** `OrderCard.vue`

The card is shared with customer order history. The staff list uses `GET /api/work-orders`.

## Card

- **Customer** — display name from the customer store, falling back to `customerId`.
- **Date** — formatted `receivedDate`; status and service badges follow it.
- **Quantity** — order-header `quantity` as `N pcs`, hidden when null.
- **Note** — shown below the date, with a dash when absent.
- **Invoice and photos** — optional icon actions.

Customer names are resolved from the customer store. The card falls back to the customer id when a name is unavailable.

## Status labels

The card uses `order-status-presentation.ts` for its status icon, label, and badge tone. The list has
no status filter.

## Controls

- **Date tabs** — the shared `DateTabs` month strip above the list; one day is selected, today by default. The arrows move to the first day of the previous or next month.
- **Date field** — the magnifier opens the search row, which holds Received / Due / Created pills choosing which order date the day matches (`receivedDate`, `dueDate` or `createdAt`); Received by default.
- **Search** — one keyword matching the customer's label, name, phone or address, or the order's `orderNumber` or `invoiceNumber`. See `search-fields.md`. A non-empty keyword searches every day; the selected day is ignored while it is set.
- **Sort** — `receivedDate` descending, fixed.
- The route owns the page value.

Control state lives in the query string (`keyword`, `date`, `dateField`, `page`); today and Received are left out of it. Changing the keyword, day or date field resets `page` to 1.

`GET /api/work-orders` accepts optional `date` (`YYYY-MM-DD`) and `dateField` (`receivedDate` by default). With `date`, the server reads every row matching the other filters, keeps those whose chosen field falls on that day, and pages them in memory. An invalid value returns 422.

## Actions

Tap opens detail. Swiping left reveals Edit, which pushes `/orders/:orderId/edit` through the
host. The card closes its panel after navigation and shows a failure message if navigation rejects.
The message stays visible until its close button is pressed or the next edit attempt begins.
The work-order store reconciles the PATCH response into loaded rows so changed header values appear
without waiting for a full reload.

## States

- **Loading** — five skeleton rows.
- **Error** — the API message, falling back to "Unable to load work orders".
- **Empty** — "No orders match these filters".
