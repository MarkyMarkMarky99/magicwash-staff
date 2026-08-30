# Order list — response fields

`workOrderListResponseSchema` in `contracts/work-orders/work-order-api.schema.ts` carries eleven fields:

`orderId`, `customerId`, `customerName`, `orderNumber`, `invoiceNumber`, `receivedDate`, `dueDate`, `serviceType`, `status`, `quantity`, `note`.

`note` stays in the DTO even though the row does not render it. What the row shows is in `order-list-screen.md`.

## Excluded

- `hangers`, `bags` — retired from the API contract, read and write: the list and detail responses, and the create and update payloads. Scope is the API contract only; the sheet and the db-contract are untouched.
- `createdAt` — available on the detail DTO.

## `invoiceNumber`

`invoice_id` holds the invoice number. The `invoice_id → invoiceNumber` mapping in `work-order.mapping.ts` is a naming difference, not a semantic one.

## `customerName`

`z.string()`, non-nullable, while nearly every other field in the schema is nullable. `WorkOrderService.list()` fills `''` when the customer cannot be resolved, so consumers must use a truthy/trim check rather than `??`. Normalising it to nullable means revisiting every fallback at the same time.
