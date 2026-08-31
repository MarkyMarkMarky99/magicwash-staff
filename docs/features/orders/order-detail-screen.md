# Order detail screen

**Route:** `/orders/:orderId` · **Page:** `OrderDetailPage.vue` · `props: true`

## Shows

- **Title** — `orderNumber`, falling back to `orderId`.
- **Subtitle** — `customerName`, falling back to `customerId` when blank.
- **Status** — Thai label chip, `—` when absent. Labels in `order-list-screen.md`.
- **รับผ้า** — `receivedDate`, `DD Mon YYYY`, `ยังไม่กำหนด` when unset.
- **กำหนดส่ง** — `dueDate`, same format.
- **Service** — `serviceType`, `—` when null.
- **จำนวน** — order-level `quantity`.
- **Invoice** — `invoiceNumber`, shown when present.
- **หมายเหตุ** — `note`, own section with line breaks preserved, hidden when empty.
- **รายการสินค้า** — one row per item: description or `ไม่ได้ระบุรายละเอียด`, quantity, price. The header count is the number of item lines, labelled `รายการ`.

`createdAt` and `createdBy` are audit data and are not shown.

## Caching

The page is not on the `<KeepAlive>` exclude list. The item form overlay it hosts resets its own fields — see `order-item-form.md`.

## Overlays

- `?item=new` — the item form.

The item form uses `useOrderOverlayRoute`.
