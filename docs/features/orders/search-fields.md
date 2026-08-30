# Order list — search fields

`WorkOrderService` in `server/modules/work-orders/work-order.service.ts` declares:

```ts
searchFields: ['orderId', 'orderNumber', 'customerId', 'invoiceNumber'],
```

Entries are **API field names**, not DB column names; the repository resolves them to columns via `toDbField`.

GViz builds `column contains 'keyword'` per field, OR-ed together — substring matching, one keyword across all four fields. An empty `searchFields` array makes the builder drop the keyword entirely.

## Why these four

- `orderId` — `create()` never writes `order_number`, so app-created orders show `orderId` in the list. Without this entry, staff search for what they see and get nothing.
- `orderNumber` — the number from the paper form, present on imported rows.
- `customerId` — every order for one customer.
- `invoiceNumber` — trace an invoice back to its order.

## Excluded

- `quantity` — numeric. GViz `contains` against a numeric column fails the whole query rather than returning no matches. Never put a numeric column in `searchFields`.
- `receivedDate`, `dueDate` — dates need range filtering, which the query layer does not support.
- `status`, `serviceType` — covered by the status tabs.
- `note`, `orderName`, `orderDescription` — free text, noisy matches.
- `createdBy`, `updatedBy` — audit data.

## Limits

- **Customer name is not searchable.** `customerName` is merged from the Customers sheet after the paginated OrderForm read. It is not an OrderForm column, so GViz cannot match it. Supporting it needs denormalisation onto OrderForm, a two-step query, or in-memory filtering after paging.
- **No date-range search anywhere.** `ReadQueryDTO` does not support range filters and `GvizQueryBuilder` exposes no range method — every non-reserved query key becomes an equality filter. Adding ranges changes shared code every module uses.
- **GViz `contains` case sensitivity is unverified.** The builder does no case folding and no test asserts it.
