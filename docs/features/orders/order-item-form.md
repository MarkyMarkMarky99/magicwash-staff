# Order item form

**Component:** `src/features/orders/components/OrderItemForm.vue`

An overlay on the order detail screen, opened by `?item=new`. Not a page.

## Fields

- **รายละเอียดสินค้า** — `description`, optional. Text input.
- **จำนวน** — `quantity`, required. Number, must be greater than 0.
- **ราคา** — `price`, optional. Number.
- **คำแนะนำเพิ่มเติม** — `specialInstructions`, optional. Textarea.

Blank optional fields submit as `null`. `serviceType` belongs to the order, not the item, and is not on this form.

Fields reset when the overlay opens and after a successful submit. A failed submit keeps what was typed.

## Payload

`orderItemCreateSchema` in `contracts/order-items/order-item-api.schema.ts`. The form parses the schema with `orderId` and `createdBy` omitted; the detail page supplies `orderId` from the route and `createdBy: 'admin'`. `itemId` is `null`.

## Overlay

Route query parameter via `useOrderOverlayRoute({ queryKey: 'item', queryValue: 'new' })`. Open state is a `computed` derived from the route, never mirrored into a local ref. Closing calls `router.back()` when this page pushed the entry, otherwise `router.replace` strips the query. The overlay never touches `history`.

## Submit

`orderStore.addItem` → `createOrderItem` → `POST /api/order-items` → `loadDetail`.

- Success → the overlay closes.
- Error → the overlay stays open with `itemError` shown.
