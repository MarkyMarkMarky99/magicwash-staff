# Order item form — spec

**Component:** `src/features/orders/components/OrderItemForm.vue`
**Not a page.** It is an overlay on the order detail screen, opened by `?item=new`.
**Status:** spec — see "Gaps"; one of them is a live data-integrity bug.
**Written:** 2026-08-31

Supersedes `forms/create-order-item.md`, a pre-implementation plan
(`PLANNING — not implemented`, commit `9e6d5e8`).

## Fields

| Label | Binds to | Type | Required |
|---|---|---|---|
| รายละเอียดสินค้า | `description` | textarea | no |
| จำนวน | `quantity` | number, must be > 0 | yes |
| ราคา | `price` | number | no |
| หมวดหมู่ | `category` | option grid — Tops / Bottoms / Home Textile / Others | no |
| คำแนะนำเพิ่มเติม | `specialInstructions` | textarea | no |

Blank optional fields submit as `null`.

**`serviceType` is deliberately absent.** The old plan listed it, but
`orderItemCreateSchema` has no such field — service type belongs to the order, not the
item. The plan is wrong; the schema is right.

## Payload

`orderItemCreateSchema` in `contracts/order-items/order-item-api.schema.ts`. The form
parses the schema with `orderId` and `createdBy` omitted; the parent detail page supplies
`orderId` from the route and `createdBy: 'admin'` — the same hardcoded value flagged on
the create screen. `itemId` is always `null`.

## Overlay behaviour

Opened as a route query parameter via `useOrderOverlayRoute({ queryKey: 'item', queryValue: 'new' })`,
following the project convention: open state is a `computed` derived from the route, never
mirrored into a local ref, and closing calls `router.back()` only when this page pushed the
entry, otherwise `router.replace` strips the query. The overlay itself never touches
`history`.

## Submit flow

emit → `orderStore.addItem` → `createOrderItem` → `POST /api/order-items` → `loadDetail`
to refresh.

- Success → the overlay closes.
- Error → the overlay stays open with `itemError` shown.

## Gaps

1. **Data-integrity bug — the form does not reset after a successful submit, and it lives
   on a cached page.** `OrderDetailPage` is not on the `<KeepAlive>` exclude list in
   `src/App.vue` (correct for a page that only displays), but that means this form's
   local refs survive. Open the item form on order A, add an item, navigate to order B,
   open the item form again — the previous values are still there and can be saved against
   the wrong order. Fix by resetting the fields on successful submit and on overlay open.
2. Stale copy: the overlay still tells the user the API is not connected
   (`OrderItemForm.vue:33`). It has been connected since `8927e95`.
3. `createdBy: 'admin'` hardcoded, as on the create screen.
