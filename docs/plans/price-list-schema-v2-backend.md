# Brief: PriceList schema v2 — backend only

Branch: `feat/price-list-schema-v2` (already created from `origin/main`)

## Goal

Replace the three price columns on the PriceList sheet with a single `price` +
`service_type` pair, and add `display_name_en`, `price_group`, `unit`.
One row now means **one item × one service × one price group**, instead of one
item carrying three prices.

## Scope — backend + contracts ONLY

**Do not touch `src/` at all.** The frontend keeps reading the old fields and will
break at runtime until a separate follow-up task; that is the user's deliberate
staging decision, not a bug for you to fix. Do not "helpfully" update any Vue file,
frontend store, service, or `tests/web/` test.

**Do not touch other backend modules.** `order-items`, `work-orders`, `orders`,
`OrderForm`, `OrderItemForms`, `OrdersView` stay exactly as they are — including
their existing duplicated service-type enums. Report them under FOLLOW-UPS, do not
migrate them.

**Never write to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`.** That
registry is the shared source of truth for the Python project at the repo root and
is updated by the user by hand. If the registry and the code disagree, the code
changes. Read it if useful; writing to it silently corrupts the source of truth.
The user updates `PriceList.json`, the live sheet header row, and the sheet grid
width (14 → 16 columns) separately.

## Target column order (16, physical sheet order = row shape key order)

| col | column | type |
|---|---|---|
| A | `id` | `z.string().regex(/^[a-z0-9]{8}$/)` — PK, server-minted |
| B | `item_code` | `z.string().regex(/^ITM-[0-9]{4,}$/)` — **NOT unique**, repeats across price options |
| C | `category` | `z.string().min(1)` |
| D | `subcategory` | `z.string().min(1)` |
| E | `itemtype` | `z.string().min(1)` |
| F | `variant` | `z.string().min(1).nullable()` |
| G | `display_name_th` | `z.string().min(1)` |
| H | `display_name_en` | `z.string().min(1).nullable()` — NEW |
| I | `service_type` | enum `WSIR \| IRON \| DRCL \| WASH` — NEW |
| J | `price_group` | `z.string().min(1)` — NEW, required, no null |
| K | `unit` | `z.string().min(1).nullable()` — NEW |
| L | `price` | `z.number()` — NEW, required, **not nullable** |
| M | `credit_eligible` | `z.boolean()` |
| N | `effective_from` | `z.string()`, `valueInput: 'USER_ENTERED'` |
| O | `effective_to` | `z.string().nullable()`, `valueInput: 'USER_ENTERED'` |
| P | `active` | `z.boolean()` |

Removed: `wash_dry_iron_price`, `iron_only_price`, `dry_clean_price`.
Everything else keeps its current type, `valueInput`, and `preserveNullValues: true`.

`price_group` example values (free string, no enum): `DEFAULT`, `DEFAULT2026`,
`CRYO`, `MAISON`. It is a per-customer-group / per-year price table key.

## Files to change

### 1. NEW `contracts/shared/service-type.schema.ts`

```ts
export const serviceTypeSchema = z.enum(['WSIR', 'IRON', 'DRCL', 'WASH'])
```

Single source of truth going forward. Price-list is the only importer in this task.
Do **not** edit `contracts/order-items/order-item-api.schema.ts:6` or
`server/sheets/OrderForm/OrderForm.db-contract.ts:11` to import it — out of scope.

### 2. `server/sheets/PriceList/PriceList.db-contract.ts`

Rewrite the row shape to the 16 columns above, in order. Import `serviceTypeSchema`
for `service_type`. Sheet name `'PriceList'`, env `PRICE_LIST_SPREADSHEET_ID`,
`writes: { append: true, update: true, delete: false }` — all unchanged.

### 3. `server/modules/price-list/price-list.module.ts`

- `priceListFieldMap`: drop the three price entries, add
  `display_name_en: 'displayNameEn'`, `service_type: 'serviceType'`,
  `price_group: 'priceGroup'`, `unit: 'unit'`, `price: 'price'`, keeping DB column
  order. The `satisfies Record<keyof PriceListDbRow & string, string>` constraint
  must still hold.
- **Remove `item_code` minting on create.** The frontend now supplies `itemCode` in
  the create payload; the server writes it as given. `id` is still server-minted.
- `searchFields`: add `displayNameEn`; keep `displayNameTh`.
- Update the null/date transformer for the new nullable set (`variant`,
  `display_name_en`, `unit`, `effective_to`). `price` is never null.

### 4. `contracts/price-list/price-list-api.schema.ts`

- Response schema (shared by list/create/update): replace `washDryIronPrice` /
  `ironOnlyPrice` / `dryCleanPrice` with `serviceType` (enum), `priceGroup` (string),
  `unit` (string|null), `price` (number); add `displayNameEn` (string|null). Keep
  camelCase key order aligned with the DB column order.
- Create schema (strict): now **includes `itemCode`** (required, `ITM-` regex) since
  the client supplies it. Still excludes `id`. Add `displayNameEn` (nullable,
  optional), `serviceType` (required enum), `priceGroup` (required), `unit`
  (nullable, optional), `price` (required number). Remove the three price fields.
- Update schema: `.partial().strict()` of the same, as today.
- List query: add `serviceType` and `priceGroup` filters, same
  `string.trim().min(1).nullable().optional().default(null)` shape as the existing
  `category` / `subcategory` filters.
- `priceListSortFieldSchema`: add `'serviceType'`, `'priceGroup'`, `'price'`. Sort
  fields map to physical GViz column letters — the letters all shift because of the
  new columns (`display_name_th` is now G→G, but H/I/J are new). Recompute them.

### 5. Tests to update (server only)

- `tests/server/unit/sheets/price-list-contract.dry-test.ts` — 14 → 16 cols, new types
- `tests/server/unit/sheets/column-order.dry-test.ts` — **only** the PriceList block
  (currently around :344-347, asserts G/H/I/J). Do not touch other sheets' blocks.
- `tests/server/unit/modules/price-list/price-list-wiring.dry-test.ts` — mapped row,
  key order, GViz sort-column letters
- `tests/server/unit/modules/price-list/price-list-writes.dry-test.ts` — create no
  longer mints `itemCode`; PATCH a `price` instead of `washDryIronPrice`
- `tests/server/unit/sheets/price-list.sheets-api.dry-test.ts` — append row shape
- `tests/server/unit/contracts/price-list/price-list-api.schema.dry-test.ts` — field
  lists, create now accepts `itemCode`, `price` rejects null and `'0'` string
- `tests/server/workflows/price-list/price-list-api.workflow.dry-test.ts` — mapped
  list row, sort column, dirty-cell passthrough

Tests that must keep passing **untouched**: everything under `tests/web/`, and every
test for another module. If a `tests/web/` test starts failing, that is expected
frontend drift — report it, do not fix it.

## Verify

```bash
npm run typecheck:api
```

plus each edited dry-test:

```bash
npx tsx <path-to-test>
```

Report the actual command output. Do not report PASS without running them.

## Report back (terse)

1. Files changed, one line each.
2. Test commands run + real results.
3. FOLLOW-UPS: what is now broken or inconsistent because of the deliberate scope
   limit (frontend fields, duplicated service-type enums elsewhere, registry JSON
   and live-sheet header still to be updated by the user).
