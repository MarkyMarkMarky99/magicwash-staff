# Order detail screen — spec

**Route:** `/orders/:orderId` · **Page:** `OrderDetailPage.vue` · `props: true`
**Status:** spec — the shipped screen shows less than it fetches. See "Gaps".
**Written:** 2026-08-31

## Caching

This page is **not** on the `<KeepAlive>` exclude list, which is correct: it displays
rather than collects. But it hosts the item form overlay, whose local refs are therefore
cached — see `order-item-form.md`, gap 1.

## What it shows

| Field | Format |
|---|---|
| `orderNumber`, falling back to `orderId` | title |
| `customerName`, falling back to `customerId` when blank | subtitle |
| `status` | Thai label chip — see `order-list-screen.md` for the map; `—` when absent |
| `receivedDate` | `DD Mon YYYY`, `ยังไม่กำหนด` when unset |
| `dueDate` | same |
| `serviceType` | raw or `—` |
| `quantity` | order-level quantity |
| `invoiceNumber` | shown when present |
| `note` | own section, preserved line breaks, hidden when empty |
| `items[]` | one row per item: description or `ไม่ได้ระบุรายละเอียด`, quantity, category, price |
| photos | photo strip |

**Not shown:** `hangers` and `bags` — being retired from the contract entirely
(`list-response-fields.md`). `createdAt`, `createdBy` are audit data, not part of this
screen.

## Gaps

1. **Subtitle shows `customerId`, not `customerName`**, even though the detail DTO carries
   the name. Same bug already fixed on the list row; fix it here with the same
   truthy/trim fallback, since the backend fills `''` rather than null.
2. **Status renders the raw enum**, violating `docs/design/patterns/list-pages.md:38`.
3. **The item count is wrong.** The list header counts `items.length` and labels it `pcs`
   — that is the number of item lines, not the sum of their quantities. Two lines of ten
   pieces each display as "2 pcs".
4. **Item rows discard most of the item DTO**: `price`, `category`, `specialInstructions`,
   `creditsUsed` are all fetched and dropped. Price in particular is the number staff need.
5. **The photo strip is permanently empty.** The store's `orderPhotos` is hardcoded `[]`
   and nothing ever populates it, so the empty state is the only state that renders.
6. **The capture overlay does not work.** `OrderCaptureOverlay` is a prototype: the file
   input uploads nothing, its fields are plain local refs, and it ships defaults
   (type `WEIGHT`, quantity `20.5`) that look like real data. Either wire it to the
   order-images endpoint or remove it — a control that silently does nothing is worse than
   no control. Tracked separately in `forms/create-order-image.md`, still a plan.
7. Order-level `quantity` and `invoiceNumber` are fetched and not displayed.
