# Order list — response fields

**Status:** decided, NOT yet implemented.
**Decided:** 2026-08-31

Covers `workOrderListResponseSchema` in
`contracts/work-orders/work-order-api.schema.ts:18-33` and what the order list
page shows.

## Current state

Fourteen fields ship in the list DTO. Eight reach the screen.

| Field | Rendered today | Decision |
|---|---|---|
| `orderId` | yes — row title fallback | keep |
| `customerId` | yes — subtitle fallback | keep |
| `customerName` | yes — subtitle | keep |
| `orderNumber` | yes — row title | keep |
| `receivedDate` | yes | keep |
| `dueDate` | yes | keep |
| `serviceType` | yes — chip | keep |
| `status` | yes — chip | keep |
| `invoiceNumber` | **no** | keep in DTO, **start displaying it** |
| `note` | **no** | keep in DTO — required, do not remove |
| `quantity` | **no** | keep in DTO, display it |
| `hangers` | no | **remove — dead field** |
| `bags` | no | **remove — dead field** |
| `createdAt` | no | **remove from the list DTO** |

## Decisions

### Retire `hangers` and `bags` entirely

These are dead fields. They have not been used in real operations for a long time.
Remove them from the **API contracts, both read and write** — the list response, the
detail response, and the create/update payloads in
`contracts/work-orders/work-order-api.schema.ts`, plus the corresponding writes in
`WorkOrderService.create()`.

**Scope: API contract only — do not touch the sheet or the db-contract.**

### `invoiceNumber` — display it

Already present in the list DTO, so **no contract change is needed** — the field is
fetched today and thrown away. The work is purely in the list row UI.

`invoice_id` **is** the invoice number. The `invoice_id → invoiceNumber` mapping in
`work-order.mapping.ts` is a naming difference only, not a semantic mismatch; the column
holds the invoice number. Render it directly.

### `createdAt` — remove from the list DTO

Unused, and `receivedDate` already answers the same question more usefully. It stays
available on the detail DTO.

### `note` — keep

`note` must remain in the list DTO. Do not remove it, even though the row does not
currently render it.

### `quantity` — keep and display

The one genuinely useful operational number still being discarded.

## Resulting list DTO

Twelve fields: `orderId`, `customerId`, `customerName`, `orderNumber`, `invoiceNumber`,
`receivedDate`, `dueDate`, `serviceType`, `status`, `quantity`, `note`.

(Removed: `hangers`, `bags`, `createdAt`.)

## Open point

`customerName` is `z.string()` — non-nullable — while nearly every other field in this
schema is nullable. `WorkOrderService.list()` fills `''` when the customer cannot be
resolved, so `OrderRow` must use a truthy/trim check rather than `??`, since `'' ?? x`
yields `''`. This works, but it is inconsistent with the rest of the contract. If it is
ever normalised to nullable, the frontend fallback must be revisited at the same time.
