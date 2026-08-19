# PriceList Backend v1 Plan

Status: approved planning baseline. This document does not authorize frontend work,
Google Sheets writes, or schema-registry changes.

## Objective

Expose the `PriceList` worksheet through a read-only, list-only backend API while
following the existing contract, sheet repository, module, and route conventions.

The v1 endpoint returns raw catalog rows mapped to camelCase. It does not resolve
current prices, select one version per item, or interpret effective-date ranges.

## Scope

- Add a camelCase shared API contract.
- Add a DB contract matching the physical worksheet.
- Add a lazy, memoized, read-only `SheetRepository`.
- Add a list-only backend module.
- Register `GET /api/price-list` lazily.
- Document the environment binding.
- Add focused unit, workflow, and live column-parity coverage.

## Non-scope

- Frontend work.
- `GET /api/price-list/:id`.
- POST, PATCH, DELETE, or any Google Sheets write.
- `active` or `creditEligible` query filters.
- Implicit `active=true`.
- `asOf`, current-price resolution, or date-range overlap logic.
- Selecting one version per `itemCode`.
- Custom service classes or custom repository methods.
- Custom transformers, `jsonColumns`, or data caching.
- Changes to the shared GViz query builder.
- New files under `api/`.
- Changes to `.env.local`.
- Changes to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`.
- Date parsing, normalization, or formatting.
- New business rules such as positive-price requirements.

## Resolved v1 decisions

| Decision | v1 |
| --- | --- |
| Spreadsheet environment key | `PRICE_LIST_SPREADSHEET_ID` |
| Worksheet | `PriceList` |
| Primary key | `id` |
| Read transport | GViz |
| Write capabilities | Disabled |
| Public route | `GET /api/price-list` |
| Item route | None |
| Response semantics | Raw catalog rows |
| Active default | None |
| Boolean filters | None |
| Service | Existing `BaseCrudService` |
| Route wiring | Existing `createCrudRoutes` |
| Date handling | Preserve the GViz string value |
| Data cache | None |
| Schema registry | Read-only source of truth |

## Public API contract

Create:

```text
contracts/price-list/price-list-api.schema.ts
```

The contract contains only:

```text
query.list
response.list
```

It must not contain create/update requests or detail/create/update responses.

### Response item

The API key set and order are:

```text
id
itemCode
category
subcategory
itemType
variant
displayNameTh
washDryIronPrice
ironOnlyPrice
dryCleanPrice
creditEligible
effectiveFrom
effectiveTo
active
```

Types:

| Field | Type |
| --- | --- |
| `id` | `string` |
| `itemCode` | `string` |
| `category` | `string` |
| `subcategory` | `string` |
| `itemType` | `string` |
| `variant` | `string \| null` |
| `displayNameTh` | `string` |
| `washDryIronPrice` | `number \| null` |
| `ironOnlyPrice` | `number \| null` |
| `dryCleanPrice` | `number \| null` |
| `creditEligible` | `boolean` |
| `effectiveFrom` | `string` |
| `effectiveTo` | `string \| null` |
| `active` | `boolean` |

Dates remain strings. Do not parse, coerce, or require ISO formatting because GViz
may return values such as `Date(...)`.

### List query

Supported query parameters:

```text
keyword
itemCode
category
subcategory
itemType
page
perPage
sortBy
sortOrder
```

Defaults and constraints:

| Query | Default or constraint |
| --- | --- |
| `keyword` | `''` |
| `itemCode` | `null` |
| `category` | `null` |
| `subcategory` | `null` |
| `itemType` | `null` |
| `page` | default `1`, integer, minimum `1` |
| `perPage` | default `20`, integer, minimum `1`, maximum `100` |
| `sortBy` | default `itemCode` |
| `sortOrder` | default `asc`; enum `asc \| desc` |

Allowed sort fields:

```text
itemCode
category
subcategory
itemType
displayNameTh
effectiveFrom
```

`keyword` searches with `contains` across:

```text
itemCode
category
subcategory
itemType
variant
displayNameTh
```

Equality filters are limited to:

```text
itemCode
category
subcategory
itemType
```

`active` and `creditEligible` are intentionally not filters in v1. The shared
GViz builder currently quotes boolean values, whereas GViz requires unquoted boolean
literals. Boolean filtering is a separate shared-engine follow-up.

### Response envelope

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "perPage": 20
    }
  }
}
```

The v1 response does not include `total` or `totalPages`.

## DB contract

Create:

```text
server/sheets/PriceList/PriceList.db-contract.ts
```

Physical keys must remain in the worksheet order:

```text
id
item_code
category
subcategory
itemtype
variant
display_name_th
wash_dry_iron_price
iron_only_price
dry_clean_price
credit_eligible
effective_from
effective_to
active
```

Configuration:

```text
primaryKey: id
sheetName: PriceList
spreadsheetId: PRICE_LIST_SPREADSHEET_ID
writes.append: false
writes.update: false
writes.delete: false
```

Declared row schema:

| Physical field | Declaration |
| --- | --- |
| `id` | string matching `^[a-z0-9]{8}$` |
| `item_code` | string matching `^ITM-[0-9]{4,}$` |
| `category` | non-empty string |
| `subcategory` | non-empty string |
| `itemtype` | non-empty string |
| `variant` | non-empty string or null |
| `display_name_th` | non-empty string |
| `wash_dry_iron_price` | number or null |
| `iron_only_price` | number or null |
| `dry_clean_price` | number or null |
| `credit_eligible` | boolean |
| `effective_from` | string |
| `effective_to` | string or null |
| `active` | boolean |

The Zod row schema declares and tests the contract. It must not introduce runtime
coercion or parsing for every live row. Dirty legacy cells returned by the reader
must not cause an endpoint failure solely because they do not match the declaration.

## DB-to-API mapping

Declare the production field map in the PriceList module:

| DB | API |
| --- | --- |
| `id` | `id` |
| `item_code` | `itemCode` |
| `category` | `category` |
| `subcategory` | `subcategory` |
| `itemtype` | `itemType` |
| `variant` | `variant` |
| `display_name_th` | `displayNameTh` |
| `wash_dry_iron_price` | `washDryIronPrice` |
| `iron_only_price` | `ironOnlyPrice` |
| `dry_clean_price` | `dryCleanPrice` |
| `credit_eligible` | `creditEligible` |
| `effective_from` | `effectiveFrom` |
| `effective_to` | `effectiveTo` |
| `active` | `active` |

Use a compile-time completeness assertion and a runtime test that pins the exact
mapping values, especially `itemtype -> itemType`.

Do not add repository mappers, `jsonColumns`, or transformers.

## Repository design

Create:

```text
server/sheets/PriceList/PriceList.repository.ts
```

Requirements:

- Use the shared `SheetRepository`.
- Keep a module-scoped cached repository instance.
- Export `getPriceListRepository()`.
- Initialize only on the first getter call.
- Return the same instance on subsequent calls.
- Do not read the environment during module import.
- Do not add custom query methods.
- Do not add a data cache.
- Keep API and camelCase concerns out of the repository.
- Reject append/update/delete before sending a network request.

## Module design

Create:

```text
server/modules/price-list/price-list.module.ts
```

The module contains:

- `priceListFieldMap`
- `searchFields`
- Existing `BaseCrudService`
- Existing `createCrudRoutes`

Do not create `price-list.service.ts`.

Expected production route capabilities:

```text
routes.collection.GET = defined
routes.collection.POST = undefined
routes.item = undefined
```

## Exact files

### Create

```text
contracts/price-list/price-list-api.schema.ts
server/sheets/PriceList/PriceList.db-contract.ts
server/sheets/PriceList/PriceList.repository.ts
server/modules/price-list/price-list.module.ts

tests/server/unit/contracts/price-list/price-list-api.contract.dry-test.ts
tests/server/unit/sheets/price-list-contract.dry-test.ts
tests/server/workflows/price-list/price-list-api.workflow.dry-test.ts
```

### Modify

```text
.env.example
server/api/route-registry.ts
tests/server/unit/sheets/sheet-binding.dry-test.ts
tests/server/unit/sheets/column-order.dry-test.ts
tests/server/unit/sheets/repository-getters.dry-test.ts
tests/server/unit/sheets/module-laziness.dry-test.ts
tests/server/integration/sheet-column-parity.ts
```

### Explicitly unchanged

```text
api/[...path].ts
server/shared/repositories/sheet.repository.ts
server/shared/repositories/utils/gviz-query.builder.ts
server/shared/services/base-crud.service.ts
server/shared/http/crud-routes.ts
tests/server/unit/sheets/writing-workbook-binding.dry-test.ts
.env.local
G:\My Drive\Magicwash\Database\GoogleSheets\*.json
```

## Acceptance criteria

1. API contract declares the exact 14-key camelCase response shape.
2. The contract has only list query and list response capabilities.
3. Query defaults are page 1, perPage 20, max 100, itemCode ascending.
4. The query does not support `active` or `creditEligible`.
5. DB contract keys exactly match the 14 physical columns and order.
6. Binding uses `PRICE_LIST_SPREADSHEET_ID`, `PriceList`, and primary key `id`.
7. All write capabilities are disabled.
8. Repository creation is lazy and memoized.
9. Importing the module without the PriceList environment value does not fail.
10. Production wiring uses `BaseCrudService` and `createCrudRoutes`.
11. There is no dedicated service, transformer, or `jsonColumns`.
12. The collection exposes only GET; item routes are absent.
13. POST returns 405 and `GET /api/price-list/:id` returns 404 through the gateway.
14. The exact field map is tested, especially `itemtype -> itemType`.
15. Generated GViz queries use physical fields, not API field names.
16. Responses contain no snake_case fields.
17. `null`, `false`, numeric `0`, and raw `Date(...)` values are preserved.
18. No truthy fallback loses `false` or `0`.
19. No date parsing or formatting is introduced.
20. Representative dirty legacy cells do not cause a 500 solely due to the declaration.
21. Route registration is lazy and uses a literal dynamic import with `.js`.
22. Other routes do not require `PRICE_LIST_SPREADSHEET_ID`.
23. Live header names and order match all 14 columns.
24. No frontend, shared-engine, environment-secret, registry, or sheet-data mutation occurs.

## Focused tests

### API contract

`tests/server/unit/contracts/price-list/price-list-api.contract.dry-test.ts`

- Exact response keys/order and nullability.
- Query defaults, maximums, and allowed sort fields.
- Invalid page/perPage/sort rejection.
- Absence of boolean filters, write requests, and detail response.

### Sheet contract

`tests/server/unit/sheets/price-list-contract.dry-test.ts`

- Exact physical keys/order.
- Primary key, environment binding, and worksheet.
- Write capabilities.
- Declared nullability and patterns.

### Production workflow

`tests/server/workflows/price-list/price-list-api.workflow.dry-test.ts`

Import the production module/gateway and mock only the external GViz boundary.

- Successful collection GET and exact response envelope.
- No `total` or `totalPages`.
- Query defaults and physical filter/sort columns.
- Exact DB-to-API mapping.
- Preserve `null`, `false`, numeric `0`, and raw `Date(...)`.
- Representative dirty cell does not cause a 500.
- No snake_case response keys.
- No item route.
- Collection POST returns 405.
- Item path returns 404 through the gateway.
- Missing environment/upstream failures use standard error handling.

Do not duplicate generic repository, mapping, or CRUD-route suites.

### Existing inventories

Add PriceList to the existing:

- Sheet binding inventory.
- Column-order inventory.
- Repository getter inventory.
- Module-laziness inventory.

### Live parity

Add PriceList to `tests/server/integration/sheet-column-parity.ts`.

Verify access, 14 headers, exact names/order, and presence of the primary-key header.
Do not pin row count, null counts, category values, or prices.

## Verification gates

```powershell
npm run typecheck:api
npx tsx tests/server/unit/contracts/price-list/price-list-api.contract.dry-test.ts
npx tsx tests/server/unit/sheets/price-list-contract.dry-test.ts
npx tsx tests/server/workflows/price-list/price-list-api.workflow.dry-test.ts
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
npm run build
git diff --check
```

`npm run build` is a Vite frontend build and is not sufficient for Vercel ESM
tracing. Before merge or deploy, run the repository's established
deployment-equivalent API/Vercel bundle gate. Do not invent a new deployment or
credential workflow.

## Implementation order

1. Confirm the clean `webapp-vue-pricelist` worktree and branch.
2. Perform a read-only GViz audit of headers and representative values.
3. Add the list-only API contract and focused contract test.
4. Add the DB contract in exact physical column order.
5. Add the sheet contract test.
6. Add the lazy repository getter.
7. Update getter and module-laziness inventory tests.
8. Add the production PriceList module with `BaseCrudService`.
9. Add the production workflow test.
10. Add the lazy route-registry entry with a literal `.js` import.
11. Add `PRICE_LIST_SPREADSHEET_ID=` to `.env.example`.
12. Update sheet-binding and column-order inventories.
13. Add live column parity.
14. Run typecheck and focused dry tests.
15. Run live parity with the local environment.
16. Run Vite build and `git diff --check`.
17. Run the established deployment-equivalent API/Vercel gate.
18. Inspect the final diff for out-of-scope changes.

## Follow-ups and unresolved product decisions

Boolean filtering is a separate shared-engine task. If `active` or
`creditEligible` filters are required, update the shared GViz builder to emit
unquoted boolean literals and add shared query-builder tests. Do not implement a
PriceList-specific query path.

Product decisions intentionally deferred from v1:

- Whether inactive or historical rows should be visible.
- Whether the API should default to a current active catalog.
- Whether an `asOf` or current-price endpoint is needed.
- Inclusive/exclusive effective-date semantics.
- Whether effective periods may overlap.
- How to select among multiple versions of one `itemCode`.
- The business meaning of a zero price.
- Whether at least one service price is required.
- Whether an item detail endpoint is needed.
