# Frontend Refactor Plan

## Goal

Refactor the frontend to consume backend API contracts directly.

Backend DTOs are the frontend data model. The frontend must not map, rename, reshape, or enrich business data. If the UI needs more data, update the backend contract/mapper first.

## Rules

- Import API schemas from `@contracts/<feature>/<m>-api.schema` — file is singular, folder plural (e.g. `@contracts/customers/customer-api.schema`).
- Derive DTO/request/query types with `z.infer`.
- Do not create frontend-owned API response type copies.
- Do not create frontend mappers for API DTOs.
- Do not import backend DB schemas, DB field names, or server modules into frontend code.
- Services call API endpoints and return contract data.
- Stores manage state and call services.
- Pages orchestrate route/store/component behavior.
- Components receive DTOs or primitive props and emit UI events.

## Shared vs Feature Code

Use `src/shared` only for generic, reusable code:

```text
src/shared/api/
src/shared/components/
src/shared/stores/
src/shared/types/
```

Keep customer-specific UI and state under `src/features/customers`.

Do not promote a component to `src/shared/components` unless it is genuinely generic and needed outside customers. Customer DTO display/behavior belongs in the customer feature.

Use existing shared UI primitives where they fit:

```text
src/shared/components/ListContainer.vue
src/shared/components/GenericTabs.vue
src/shared/components/BaseSwipeCard.vue
src/shared/components/CardLeadingIcon.vue
src/shared/composables/useHeaderSearch.ts
```

New feature code should import shared UI from `src/shared`, not legacy `src/components/shared`.

## Customer Scope

Start with a new customer feature module:

```text
src/features/customers/
```

Create a full vertical slice:

```text
src/features/customers/services/customer.service.ts
src/features/customers/stores/customer.store.ts
src/features/customers/pages/CustomerListPage.vue
src/features/customers/components/CustomerCard.vue
src/features/customers/components/CustomerTypeTabs.vue
src/features/customers/routes.ts
```

Customer code must use contract DTO fields directly:

- `customerId`
- `customerIndex`
- `customerName`
- `phone`
- `address`
- `location`
- `customerType`

Do not keep legacy aliases such as `id`, `index`, `name`, or `type`.

`phone` is consumed as a **string** (zero-padded) — the card uses it for display and `tel:` directly. Do not pad or format it on the frontend; that is a backend contract change (see Decisions).

Do not import legacy customer files into the new feature:

```text
src/pages/CustomersPage.vue
src/components/customers/*
src/composables/useCustomerStore.js
src/composables/useSelectedCustomer.js
```

Leave legacy files in place until the new route and booking handoff are proven.

## Shared API Infrastructure

Create:

```text
src/shared/api/api-client.ts
```

`api-client.ts` handles HTTP, the response envelope (`{ data, meta }` / `{ data, meta.pagination }`), and errors. It builds URLs and **validates the request only** — it MUST NOT runtime-validate (`.parse`) responses: legacy cells are dirty by backend decision (`api/CLAUDE.md` — cell values are never validated), so a strict parse would throw on dirty rows and break the whole list. Derive response types with `z.infer` and pass the data through; reach for `safeParse` + degrade only behind a specific guard.

Write the customer service as `customer.service.ts` inside the feature, directly on `api-client` — **list-only for this round**. Do not add a `createResourceService` factory or `createResourceStore` yet; extract a factory only after a second enveloped feature proves the same pattern (`invoices` returns a different non-enveloped shape and is out of scope). The service must not map DTO fields.

## List State & Filtering

The endpoint returns **all customers in one request** (backend `perPage` default = max), so search, type filtering, and counts all run **in memory** — no server round-trip per keystroke, no infinite scroll, no page state. This mirrors the legacy `useCustomerStore` (load once, filter locally), just sourced from the clean API.

- The store loads the full list **once** (cache it; refetch only on explicit invalidate) and holds **results only** (customers, loading, error).
- The URL query string is the single source of truth for the active filter (`keyword`, `customerType`) — reuse the invoices pattern (`src/features/invoices/composables/useInvoiceFilterRoute.ts`) as `useCustomerFilterRoute`. `filter` is a `computed` derived from `route.query`; `updateFilter` writes a clean query back. Do not keep the filter in a store (that would be a second source of truth).
- Search/type-filter apply the URL filter to the in-memory list (a `computed`), **not** a re-fetch. On refresh the full list reloads and the URL restores the filter — nothing is lost.
- Type tabs (`CustomerTypeTabs`) show a **total-per-type count** computed in memory from the full list (e.g. `customers.filter(c => c.customerType === t).length`). Because the whole dataset is present this is the true total per type, independent of the active search — a trivial count of API data, not re-derived business logic.

## Booking Handoff

Create shared cross-feature state:

```text
src/shared/stores/selected-customer.store.ts
```

This store is shared because customers selects a customer and booking consumes it. It should store the customer contract DTO or minimal contract-derived booking fields, especially `customerId`.

Update:

```text
src/components/forms/AppointmentScheduleForm.vue
```

The booking form must read selected customer data from the shared selected-customer store and use contract field names such as `customerId`, `customerName`, and `address`.

Only the new `CustomerCard` may write the new selected-customer store. While legacy files remain, ensure no legacy path launches booking against the new (empty) store.

## Routing

Update:

```text
src/router/index.js
```

Route `/customers` to the new customer feature page/routes instead of `src/pages/CustomersPage.vue`.

Do not touch `features/invoices` in this refactor.

## Migration Steps

1. Add shared `api-client.ts` (request validation + envelope unwrap; no response `.parse`).
2. Create list-only `customer.service.ts` on `api-client` using contract schemas.
3. Create customer Pinia store that loads the full list once and holds results only (contract DTO types).
4. Add `useCustomerFilterRoute` (URL = filter single source of truth; reuse the invoices pattern). Search/type-filter/counts are computed in memory from the full list.
5. Create customer page and components in `src/features/customers`.
6. Create selected-customer shared store.
7. Route `/customers` to the new feature.
8. Update booking form to consume `customerId` from the selected customer DTO.
9. Verify the new customer list, search, type tabs, swipe actions, and booking handoff.
10. Remove or isolate old customer frontend paths after the new flow is proven.

## Acceptance Criteria

- `/customers` renders the new customer feature page.
- Customer feature code imports no legacy customer-specific page/component/composable files.
- Customer services/stores derive types from `contracts`.
- Customer list renders and searches using contract DTO fields.
- Customer components use `customerId`, `customerIndex`, `customerName`, `phone`, `address`, `location`, and `customerType` directly.
- Booking receives `customerId` from the selected customer DTO.
- Booking no longer depends on `src/composables/useSelectedCustomer.js`.
- No frontend mappers or frontend-owned API response type copies are introduced.

---

## Decisions (2026-06-14)

All points resolved and folded into the plan above.

### Frontend (folded into plan)
- **No FE response validation** → Shared API Infrastructure. Validate request only; responses via `z.infer`, never `.parse()`.
- **No `createResourceService` factory** → `customer.service.ts` calls `api-client` directly; defer the factory.
- **List-only service** → only `list` this round.
- **Path pattern** → `@contracts/<feature>/<m>-api.schema` (file `customer-api.schema`, folder `customers`).
- **Transition guard** → only the new `CustomerCard` writes the new selected-customer store.
- **Load all + in-memory filter** → List State & Filtering: the endpoint returns every customer in one request; search / type-filter / counts run in memory (no server pagination, no infinite scroll, no `page` state). Tab counts are computed from the full list — no stats endpoint.

### Backend (implemented in this branch)
- ✅ **`phone` is now a string** — `customer-api.schema.ts` (request + list/detail response) and `customer-db.schema.ts` (row + append/update payloads) changed `number` → `string`; `customer.module.ts` adds after-hooks that normalize the legacy integer phone back to a zero-padded string (`0812345678`). New writes store it as text. `typecheck:api` passes.
- ✅ **Endpoint returns all customers** — `MAX_CUSTOMERS_PER_PAGE` raised to 2000 and the list-query `perPage` default set to it, so `GET /api/customers` returns the whole list (engine pagination is in-memory slicing; the GViz read has no LIMIT).

No backend tasks remain.
