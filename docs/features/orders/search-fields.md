# Order list — search fields

**Status:** decided, NOT yet implemented.
**Decided:** 2026-08-31

## The change

`server/modules/work-orders/work-order.service.ts` currently declares:

```ts
searchFields: [],
```

An empty array means the keyword is silently dropped: `GvizQueryBuilder.search()`
returns early when `search.fields.length === 0`
(`server/shared/repositories/utils/gviz-query.builder.ts:74`). The order list search
box therefore does nothing today, even though the frontend already sends `keyword`
and the placeholder promises order-number / customer-id search.

Agreed replacement:

```ts
searchFields: ['orderId', 'orderNumber', 'customerId', 'invoiceNumber'],
```

## Why these four

`searchFields` entries are **API field names**, not DB column names — the repository
resolves them to columns via `toDbField` (`server/shared/repositories/base.repository.ts:218`).
Confirmed by `server/modules/customers/customer.module.ts:61`, which declares
`['customerIndex', 'customerName', 'address']`.

| Field | Reason |
|---|---|
| `orderId` | **The critical one.** `WorkOrderService.create()` never writes `order_number`, so app-created orders have a null `orderNumber` and the list row falls back to showing `orderId`. Without this entry, staff type what they see on screen and get no results. |
| `orderNumber` | The number from the paper form; present on imported/legacy rows. |
| `customerId` | Pull up every order for one customer. Already promised by the search placeholder. |
| `invoiceNumber` | Trace an invoice back to its order — a real workflow when checking or chasing payment. |

## Deliberately excluded

- **`quantity`, `hangers`, `bags`** — these are `z.number()` columns
  (`server/sheets/OrderForm/OrderForm.db-contract.ts:13-15`). GViz `contains` against a
  numeric column fails the whole query, breaking the entire list rather than merely
  returning no matches. Never add a numeric column to `searchFields`.
- **`receivedDate`, `dueDate`** — date filtering is a range problem, and the query layer
  has no range support (see below).
- **`status`, `serviceType`** — already covered by the status tabs. Including them means
  typing `P` floods the results with every `PENDING` order.
- **`note`, `orderName`, `orderDescription`** — free text; matches would be noisy.
  Easy to add later, hard to remove once staff rely on it.
- **`createdBy`, `updatedBy`** — audit data, not something staff search by.

## Known limitations

- **Customer name is not searchable.** `customerName` is merged onto rows *after* the
  paginated OrderForm read, from the Customers sheet
  (`server/modules/work-orders/work-order.service.ts:101-116`). It is not a column on
  OrderForm, so GViz cannot match it. Supporting it would require denormalising the name
  onto OrderForm, a two-step customer-then-orders query, or in-memory filtering after
  paging — all outside the current `GenericListQuery`.
- **Date-range search is unsupported at the query layer**, not just here.
  `read-query.dto.ts:6` states it does not "support operation/range/null/or filters", and
  `GvizQueryBuilder` exposes no range method — every non-reserved query key becomes an
  equality filter. Adding date ranges means changing `ReadQueryDTO` and `GvizQueryBuilder`,
  which every module shares.
- **Case sensitivity of GViz `contains` is untested.** No test asserts it and the builder
  does no case folding (`gviz-query.builder.ts:80`). Verify against the live sheet when
  implementing.

## Matching behaviour

GViz builds `column contains 'keyword'` per field, OR-ed together
(`gviz-query.builder.ts:80-83`) — substring matching, single keyword across all four fields.
