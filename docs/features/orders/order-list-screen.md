# Order list screen

**Route:** `/orders` · **Page:** `OrderListPage.vue` · **Row:** `OrderRow.vue`

Covers the staff-facing list row only. `src/features/customers/components/OrderCard.vue` is a separate component with its own layout.

## Row

- **Title** — `orderNumber`, falling back to `orderId`. Bold, truncated.
- **Badge, top right** — `status` as a Thai label.
- **Subtitle** — `customerName`, falling back to `customerId` when blank.
- **Bottom left** — `receivedDate` → `dueDate`, `DD Mon YYYY`, `—` when absent.
- **Bottom right** — `serviceType` chip, `—` when null.
- **Quantity** — `quantity` as `N ชิ้น`, hidden when null.
- **Invoice** — `invoiceNumber` badge, hidden when null.

`note` is not shown.

`customerName` is a non-nullable `z.string()` and arrives as `''` when unresolved, so the fallback is a truthy/trim check, never `??`.

## Status labels

- `PENDING` — รอดำเนินการ
- `RECEIVED` — รับผ้าแล้ว
- `COMPLETED` — เสร็จแล้ว
- anything else — the raw value

Staff-facing labels only; raw API enum values never reach the screen. See `docs/design/patterns/list-pages.md`.

## Controls

- **Search** — one keyword across `orderId`, `orderNumber`, `customerId`, `invoiceNumber`. See `search-fields.md`.
- **Status tabs** — ทั้งหมด / รอดำเนินการ / รับผ้าแล้ว / เสร็จแล้ว.
- **Sort** — `receivedDate` descending, fixed.
- No date-range filter and no page controls.

Control state lives in the query string. Changing the keyword or the tab resets `page` to 1.

## States

- **Loading** — five skeleton rows.
- **Error** — the API message, falling back to "Unable to load work orders".
- **Empty** — "ไม่พบออเดอร์ที่ตรงกับเงื่อนไข".
