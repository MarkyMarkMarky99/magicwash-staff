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

The card uses `order-status-presentation.ts` for its status icon, label, and badge tone. The
status filter tabs use `order-status-labels.ts`.

## Controls

- **Search** — one keyword across `orderId`, `orderNumber`, `customerId`, `invoiceNumber`. See `search-fields.md`.
- **Status tabs** — ทั้งหมด / รอดำเนินการ / รับผ้าแล้ว / เสร็จแล้ว.
- **Sort** — `receivedDate` descending, fixed.
- No date-range filter. The route owns the page value.

Control state lives in the query string. Changing the keyword or the tab resets `page` to 1.

## Actions

Tap opens detail. Swiping left reveals Edit, which pushes `/orders/:orderId/edit` through the
host. The card closes its panel after navigation and shows a failure message if navigation rejects.
The message stays visible until its close button is pressed or the next edit attempt begins.
The work-order store reconciles the PATCH response into loaded rows so changed header values appear
without waiting for a full reload.

## States

- **Loading** — five skeleton rows.
- **Error** — the API message, falling back to "Unable to load work orders".
- **Empty** — "ไม่พบออเดอร์ที่ตรงกับเงื่อนไข".
