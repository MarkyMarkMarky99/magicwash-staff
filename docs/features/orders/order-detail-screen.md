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
- The header quantity uses the danger colour when it is null, the order has no items, or it
  differs from the sum of stored item quantities.
- **Invoice** — `invoiceNumber`, shown when present.
- **หมายเหตุ** — `note`, own section with line breaks preserved, hidden when empty.
- **รายการสินค้า** — one row per item: description or `ไม่ได้ระบุรายละเอียด`, quantity, price. The Items header has no item-count badge.

`createdAt` and `createdBy` are audit data and are not shown.

## Caching

The page is not on the `<KeepAlive>` exclude list. The item form overlay it hosts resets its own fields — see `order-item-form.md`.

## Overlays

- `?item=new` — the item form.

The item form uses `useOrderOverlayRoute`.

Each item row opens its before-photo gallery on tap and offers a separate menu action to
register a garment's tag and before-photo. See [garment registration](garment-registration.md).
The registration overlay is owned by `?orderAction=register-garment&registerItem=<orderItemId>`.
The Items menu also offers **Register garments**, which opens it without `registerItem` to register
garments not yet assigned to an item.

The item rows show stored quantity beside the live BEF LaundryPhotos count. Counts refresh
after capture and when returning from photo moves or deletions. The Items menu offers
Reassign quantities; it sends one batch for items with at least one BEF photo whose count
differs from stored quantity. Zero-photo items are skipped. The list shows saving and error states.

A square Approve action anchored to the bottom-right of the app column appears for PENDING,
RECEIVED, and SUBMITTED orders. Its error toast uses the same anchor. The action is disabled
when header and item quantities mismatch or while saving. Approval uses the normal
work-order update path and reports ticket provisioning in the detail notice.
