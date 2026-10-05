# Order list — search fields

The order list matches its keyword in the browser over the shared order snapshot, using customers from the customer store. It fetches `GET /api/order-snapshots` once per activation; keyword changes make no request. Unknown customers cannot match customer fields, but their orders can still match order or invoice numbers. An order matches when either:

- its customer matches the keyword the same way the customer list search does — `customerIndex`
  (the three-letter label), `customerName`, `phone` or `address`, read from the Customers sheet; or
- its `orderNumber` or `invoiceNumber` contains the keyword.

Matching is a case-insensitive substring match with the keyword trimmed. The customer rule is
`matchesCustomerKeyword` in root `shared/utils/customer-search.ts`, which the customer list page
also uses, so both screens find the same customers.

For other `GET /api/work-orders` callers, the same matching rules remain in `WorkOrderService` (`server/modules/work-orders/work-order.service.ts`). With a keyword, the service reads every OrderForm row matching the equality filters (`customerId`,
`status`) and the Customers sheet in parallel, filters, then pages in memory. Without a keyword or
`date`, the list keeps the paged GViz read.

## Why these fields

- Customer label, name, phone, address — what staff know about a customer.
- `orderNumber` — the number from the paper form, present on imported rows.
- `invoiceNumber` — trace an invoice back to its order.

## Excluded

- `orderId`, `customerId` — system UUIDs that no person remembers.
- `quantity` — numeric; a number is not something staff search by.
- `receivedDate`, `dueDate`, `createdAt` — covered by the date tabs and the date-field filter (see `order-list-screen.md`).
- `status`, `serviceType` — shown on each card; the list has no status filter.
- `note`, `orderName`, `orderDescription` — free text, noisy matches.
- `createdBy`, `updatedBy` — audit data.

## Limits

- **No date-range search in the query layer.** `ReadQueryDTO` does not support range filters and `GvizQueryBuilder` exposes no range method — every non-reserved query key becomes an equality filter. The order list filters its snapshot in the browser; other `/api/work-orders` callers use the in-memory filtering in `WorkOrderService`.
- **A keyword ignores the selected day.** The browser ignores the date filter while a trimmed keyword is non-empty, so search covers every day.
- **Server keyword searches read both sheets in full.** This remains true for `/api/work-orders` callers. The order list searches its loaded snapshot and customer store without another request.
