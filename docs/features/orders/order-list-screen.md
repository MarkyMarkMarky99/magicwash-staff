# Order list screen

**Route:** `/orders` · **Page:** `OrderListPage.vue` · **Card:** `OrderCard.vue`

The card is shared with customer order history. The staff list reads `GET /api/order-snapshots` once per page activation into the shared in-memory snapshot store, also used by the orders report. Changing the day, date field or keyword filters this snapshot in the browser and makes no request. Snapshot responses are never cached.

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
- **Date field** — the magnifier opens the search row; its right end holds a `tune` filter button whose dropdown picks which order date the day matches: Received, Due or Created (`receivedDate`, `dueDate` or `createdAt`), with a check on the current one. Received is the default; for the others the button shows the field's name beside the icon.
- **Search** — one keyword matching the customer's label, name, phone or address, or the order's `orderNumber` or `invoiceNumber`. See `search-fields.md`. A non-empty keyword searches every day; the selected day is ignored while it is set.
- **Sort** — `receivedDate` descending, fixed.
- The route owns the page value.

Control state lives in the query string (`keyword`, `date`, `dateField`, `page`); today and Received are left out of it. Changing the keyword, day or date field resets `page` to 1.
The list ignores route changes while another page is active.

Without a non-empty trimmed keyword, the browser keeps snapshot rows whose chosen date field starts with the selected `YYYY-MM-DD` day. Received is the default field; Due and Created use the same rule. A keyword ignores the day and searches the whole snapshot. Filtering preserves received-date descending order, with null dates last and order id ascending for ties.

## Actions

The actions menu opens the order report on the selected day with both `date` and `day` query parameters set to that day.

Tap opens detail. Swiping left reveals Edit, which pushes `/orders/:orderId/edit` through the
host. The card closes its panel after navigation and shows a failure message if navigation rejects.
The message stays visible until its close button is pressed or the next edit attempt begins.
Work-order invalidation reloads the shared snapshot so saved header changes appear in the list and report.

## States

- **Loading** — five skeleton rows while the first snapshot is loading.
- **Error** — the API message, falling back to "Could not load orders", only when no snapshot has loaded. A failed refresh keeps the previous snapshot visible.
- **Empty** — "No orders match these filters".
