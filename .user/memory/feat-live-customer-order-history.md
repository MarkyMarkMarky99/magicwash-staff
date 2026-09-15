# feat/live-customer-order-history

## Status

- Two commits on top of `main`. Browser-verified by the user on 2026-09-15; not pushed.
- Customer detail order history reads `GET /api/work-orders?customerId=` (live `OrderForm`) instead of
  `GET /api/orders?customerId=` (materialized `OrdersView`).
- `OrderDetailSheet.vue` no longer reads `items` off the list row; it loads them from
  `GET /api/work-orders/:id` when it opens, with request sequencing and a same-id guard.
- `/api/orders` and its `OrdersView`-backed module are untouched and now have no frontend caller.

## Open

- `/api/work-orders` list reads the whole `Customers` sheet for `customerName`, which this page does not
  render. That cost now applies to customer detail too.
- Decide whether to delete the `/api/orders` module or keep it for a future live `/api/orders/:id`.
  See [[feat-live-order-helper]] for the helper that would back that route.
