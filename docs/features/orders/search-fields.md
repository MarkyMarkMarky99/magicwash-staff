# Order list — search fields

A keyword on `GET /api/work-orders` is matched in memory by `WorkOrderService`
(`server/modules/work-orders/work-order.service.ts`), not by GViz. An order matches when either:

- its customer matches the keyword the same way the customer list search does — `customerIndex`
  (the three-letter label), `customerName`, `phone` or `address`, read from the Customers sheet; or
- its `orderNumber` or `invoiceNumber` contains the keyword.

Matching is a case-insensitive substring match with the keyword trimmed. The customer rule is
`matchesCustomerKeyword` in root `shared/utils/customer-search.ts`, which the customer list page
also uses, so both screens find the same customers.

With a keyword, the service reads every OrderForm row matching the equality filters (`customerId`,
`status`) and the Customers sheet in parallel, filters, then pages in memory. Without a keyword or
`date`, the list keeps the paged GViz read.

## Why these fields

- Customer label, name, phone, address — what staff know about a customer.
- `orderNumber` — the number from the paper form, present on imported rows.
- `invoiceNumber` — trace an invoice back to its order.

## Excluded

- `orderId`, `customerId` — system UUIDs that no person remembers.
- `quantity` — numeric; a number is not something staff search by.
- `receivedDate`, `dueDate`, `createdAt` — covered by the date tabs and date-field pills (see `order-list-screen.md`).
- `status`, `serviceType` — shown on each card; the list has no status filter.
- `note`, `orderName`, `orderDescription` — free text, noisy matches.
- `createdBy`, `updatedBy` — audit data.

## Limits

- **No date-range search in the query layer.** `ReadQueryDTO` does not support range filters and `GvizQueryBuilder` exposes no range method — every non-reserved query key becomes an equality filter. The order list's single-day filter and keyword search work around this inside `WorkOrderService`.
- **A keyword ignores the selected day.** The page drops `date` while a keyword is set, so search covers every day.
- **Every keyword search reads both sheets in full.** Acceptable while orders and customers stay in the low thousands.
