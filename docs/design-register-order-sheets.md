# DESIGN — Register `OrderItemForms` and `OrderImages` in the sheet layer (append-enabled)

Branch `feat/register-order-sheets`, worktree `C:\MagicwashGemini\webapp-vue\.worktrees\register-order-sheets`.
All paths are relative to that worktree root unless prefixed with `G:`.

## Scope

Register two existing tabs of `ORDERS_SPREADSHEET_ID` into the sheet layer: 2 new
`server/sheets/<Name>/` directories (db-contract + repository), **5** additive test-enumeration
edits, 1 new registry JSON on `G:`. Both contracts are
`writes: { append: true, update: false, delete: false }` with an `audit.onAppend` stamp.
No API contract, no module, no route, no `src/` change, no new env var.

### Read this before starting: what `append: true` does and does not deliver

The goal is "เพิ่ม sheet layer ใหม่ให้บันทึกลง sheet ได้". This task makes the sheet layer
**capable** of appending rows to both tabs. It does not make anything call it: there is no module,
no service and no route in scope, so after this task no HTTP request writes a row. The callable
path is a later task that adds `contracts/<feature>/*-api.schema.ts` +
`server/modules/<m>/<m>.module.ts` + a `route-registry.ts` entry. State that in the handoff so the
capability is not mistaken for a working endpoint.

What `append: true` changes concretely, from `server/shared/repositories/sheet.repository.ts`:

```
new SheetRepository({ contract })          # constructor, at first getter call
 L if (!writes.append && !writes.update) -> no client, no header loader, return   # the read-only path, no longer taken
 L require contract.spreadsheetId is a non-empty string                            # else throws at construction
 L new SheetsApiClient({ spreadsheetId: requireEnv('ORDERS_SPREADSHEET_ID'), sheetName })
    L stores fetch + accessTokenProvider only                                      # no token fetched, no network at construction
 L new SheetHeaderMapResolver(...)                                                 # lazy; first load happens on the first append
```

So construction needs only `ORDERS_SPREADSHEET_ID`. `GOOGLE_SERVICE_ACCOUNT_KEY` and the service
account's Editor grant are needed at the first real `append()`, not before — both already exist for
this workbook (`1tfgJvjXMkH8MIoJ38No9-1DBdG7o0lcPG8dVhPCGw-E` is already a writable workbook via
`OrderForm`), so **no new env var and no new sharing change is required**.

## Constraints — with the reason each exists

| Constraint | Why |
|---|---|
| `.js` extension on every relative import in a `.ts` source | `@vercel/node` does not bundle extensionless relative imports. Omitting it took production fully down once; typecheck, dry-tests and `vercel dev` all passed while the deployed function 500s. |
| `writes.append: true` | Creating an order item and recording a captured image are both appends. This is what the user asked for. |
| `writes.update: false` | No edit-item or edit-image screen has been specified. Enabling a write path nobody calls is unrequested surface area. Flipping it later is one line here plus the `audit.onUpdate` entry and its `audit-declarations` expectation. |
| `writes.delete: false` | Deletion has never been requested for any sheet in this project, and `SheetRepository.delete` throws `delete is not supported yet` regardless. |
| `audit: { onAppend: ['<created-timestamp column>'] }`, **no `onUpdate` key** | `prepareAuditRow` stamps only the listed columns for the operation in progress. `add-sheet` rule 4: declare `audit` only for a write the contract actually allows — an `onUpdate` entry under `update: false` is a claim the code never honours (`Customers` violates this and is flagged as "do not copy"). Exact precedent: `CustomerPackages` and `PackageTransactions`, both `append: true / update: false`, both `audit: { onAppend: ['created_at'] }` with no `onUpdate` key. |
| **No** `valueInput` on either contract | See the finding in §9.2. The wire always sends `USER_ENTERED`; `valueInput` is an intent/guard declaration only, and `add-sheet` rule 5 permits the declaration only for a column *measured* to be a real Sheets datetime cell. Our measurement does not establish that for either column. Precedent for omitting it while append-enabled: `IssueReports`, `CustomerPackages`, `PackageTransactions`, `Packages`. |
| No normaliser, no enum, no URL validator on `image_type`, `image_path`, `category`, `service_type` | The live values are inconsistent (13 spellings of `image_type`, Thai/English mixed `service_type`). An enum would be a claim the data does not support and would be a false contract; the sheet layer returns what is in the cell. Normalising belongs in a module mapper, out of scope. |
| No `z.date()`, no coercion, no format check on `timestamp` / `updated_at` / `created_at` | The live values are `dd/MM/yyyy HH:mm:ss` and ISO `…Z`, neither of which is the project's Bangkok `yyyy-MM-dd HH:mm:ss` standard. Typing them as dates would misrepresent them and the read path never validates anyway. |
| Do not infer a zod type from the GViz `type` field | A string column whose values look numeric comes back from GViz as `number`. Column types come from the measured profile in §0 only. |
| Key order in the row schema = physical column order | `deriveGVizColumns` maps `Object.keys(row.shape)` to column letters **by index**. Wrong order silently misreads every row. (Note the asymmetry: the *append* path addresses columns by header **name** via `buildRowValues(headerMap.orderedHeaders)`, so a key-order bug corrupts reads while writes still look fine.) |
| `.strict()` on both row schemas | Convention on the newer sheets (`InvoiceItems`, `Invoices`, `Payments`, `IssueReports`, `LaundryPhotos`). |
| No `contracts/**` api schema, no `server/modules/**`, no `route-registry.ts` entry, no `api/**` route, nothing under `src/` | Deciding the API shape over dirty data is a separate decision the user has not made. The sheet layer is the reversible half. |
| Do not edit `.env.example` or add an env var | Both tabs live in the workbook already bound to `ORDERS_SPREADSHEET_ID`. |
| Do not edit `writing-workbook-binding.dry-test.ts`, `module-laziness.dry-test.ts`, `service-wiring.dry-test.ts` | See §5.6 — each was checked against its real contents. |
| No existing assertion may be weakened, deleted, skipped or `.only`-ed | A silently deleted test still shows green. Permitted test edits are exactly the additive entries in **§5**. |
| `G:\My Drive\Magicwash\Database\GoogleSheets\` — create `OrderItemForms.json` only; never modify or delete any other file, including `OrderImages.json` | Shared schema registry, also consumed by the Python project at the repo root; an accidental overwrite there is unrecoverable and silent. `OrderImages.json` was corrected by hand by the user on 2026-08-30 and is human-owned. If `OrderItemForms.json` already exists, stop and report — do not overwrite. |
| Any probe script you write must pass `headers=1` | GViz reports `parsedNumHeaders: 0` on both tabs; without `headers=1` it merges the header and the first data rows into one column label and drops those rows. `sheet-column-parity.ts` already sends `headers=1`, and so does `fetchGVizRows` — no change needed in either. |
| Cleaning the sheet data is out of scope | The user has ruled it out. Do not propose deleting rows, clearing the column-E fill-down, or normalising values — not as a step and not as future work. |

## §0. Measured ground truth — full-tab profile, 2026-08-30

Every row of both tabs was profiled (not sampled). These numbers supersede all earlier samples.
Column order below **is** the physical column order; do not reorder and do not "correct" a name.

Typing rule applied: **0 measured nulls → non-nullable; ≥1 measured null → `.nullable()`**, with
exactly one documented exception (`OrderItemForms.id`, see §0.3).

### 0.1 `OrderItemForms` — 23,165 rows, 15 columns (A–O), `ORDERS_SPREADSHEET_ID`

| Col | Name | nulls | zod | notes |
|---|---|---|---|---|
| A | `id` | **1,074** | `z.string()` | primary key — exception, see §0.3 |
| B | `order_id` | 1,087 | `z.string().nullable()` | |
| C | `item_id` | 3,532 | `z.string().nullable()` | |
| D | `description` | 1,151 | `z.string().nullable()` | Thai text |
| E | `quantity` | 0 | `z.number()` | float; the 0-null count includes 1,074 phantom rows reading `0.0` |
| F | `price` | 2,495 | `z.number().nullable()` | float |
| G | `credits_used` | 5,619 | `z.number().nullable()` | float — 169 rows non-integer |
| H | `timestamp` | 1,074 | `z.string().nullable()` | `dd/MM/yyyy HH:mm:ss`; created-timestamp role |
| I | `category` | 2,274 | `z.string().nullable()` | 5 values: `Tops`(11734), `Bottoms`(5510), `Home Textile`(2237), `Others`(1409), `Bedding`(1) |
| J | `service_type` | 3,369 | `z.string().nullable()` | 8 values, Thai + English: `ซักรีด`(11350), `WSIR`(5522), `รีดผ้า`(846), `ซักแห้ง`(648), `ซักพับ`(579), `IRON`(366), `DRCL`(258), `WASH`(227) |
| K | `special_instructions` | 23,155 | `z.string().nullable()` | |
| L | `created_by` | 23,162 | `z.string().nullable()` | |
| M | `updated_at` | 2,483 | `z.string().nullable()` | `dd/MM/yyyy HH:mm:ss` |
| N | `updated_by` | 2,482 | `z.string().nullable()` | |
| O | `invoice_item_id` | **23,165** | `z.string().nullable()` | entirely empty column |

### 0.2 `OrderImages` — 17,376 rows, 10 columns (A–J), `ORDERS_SPREADSHEET_ID`

| Col | Name | nulls | zod | notes |
|---|---|---|---|---|
| A | `id` | 0 | `z.string()` | primary key |
| B | `customer_id` | 546 | `z.string().nullable()` | |
| C | `delivery_id` | 17,365 | `z.string().nullable()` | |
| D | `order_id` | **0** | `z.string()` | **not nullable** — corrects the earlier 2-row sample |
| E | `image_type` | 1,329 | `z.string().nullable()` | 13 distinct values, see below |
| F | `image_path` | 2 | `z.string().nullable()` | two incompatible formats, see below |
| G | `notes` | 16,680 | `z.string().nullable()` | Thai text |
| H | `quantity` | 13,258 | `z.number().nullable()` | float — weights like `20.5`, `8.7` |
| I | `created_at` | 3 | `z.string().nullable()` | two formats; created-timestamp role |
| J | `created_by` | 17,365 | `z.string().nullable()` | |

`image_type` live values: `BAG`(8772), `WEIGHT`(3986), `DOCUMENT`(2282), `FORM`(295), `PICKUP`(271),
`HANGERS`(146), `HANGER`(132), `DELIVERED`(120), `PickupConfirmation`(32), `BAGS / BASKETS`(6),
`DELIVERY`(2), `GARMENT`(2), `Document`(1), plus 1,329 blanks. Casing and singular/plural are
inconsistent → free string, no enum, no validator.

`image_path` holds full Firebase Storage download URLs on newer rows and legacy relative paths such
as `OrderForm_Images/<id>.form_image.<n>.jpg` on older rows → plain nullable string, no URL
validator (it would reject a large share of existing rows), no discriminated union.

`created_at` reads back as ISO with a `Z` suffix on newer rows and `dd/MM/yyyy HH:mm:ss` on older
rows → plain nullable string, no `z.date()`, no coercion.

### 0.3 Phantom rows on `OrderItemForms` — 1,074 of 23,165

1,074 rows are blank in every column except `quantity`, which GViz reports as `0.0`; the values
originate in a column-E fill-down that extends past the real data. They are **scattered, row
indexes 5 to 20,640, not contiguous at the end**, so truncation cannot remove them. They are the
same 1,074 rows counted as nulls in `id` and `timestamp`.

Verified against the code — this is why they are recorded, not filtered:

```
read(query?)                                                       # sheet.repository.ts
 L fetchGVizRows(...)                                              # utils/gviz-reader.ts
    L tableToRows(table, letterToField, decodeJsonCells)
       L table.rows.map(...)                                       # no filter, no skipEmpty -> phantom rows ARE returned
 L returns Array<Partial<TDbRow>>                                  # contract.row is NEVER .parse()d on this path
```

- `contract.row` is used at exactly two sites: `deriveGVizColumns(this.contract.row)` and
  `Object.keys(this.contract.row.shape)`. It is never `.parse()`d, so `id: z.string()` does **not**
  throw on a phantom row — `id` returns `null` under a type that lies.
- There is no `skipEmpty` option or per-row filter hook on `SheetContract`, `GVizFetchInput`, or
  `SheetRepositoryOptions`.
- The append key check cannot collide with them: `findRowNumberByKey` (and the inline scan in
  `validateBatchKeys`) skips a key cell that normalises to `''`.
- All 15 existing db-contracts declare `primaryKey` on a non-nullable `z.string()` column; none is
  nullable.

**Decision:** keep `id: z.string()`, matching all 15 existing contracts, and record the phantom rows
in the file header comment with counts and the 2026-08-30 date. Do not add a filter, do not make the
primary key nullable, do not touch the sheet. A consumer that must exclude them does it in a module
layer, which is out of scope.

## §1. New file — `server/sheets/OrderItemForms/OrderItemForms.db-contract.ts`

```ts
import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderItemForms sheet column order. */
export const orderItemFormsRowSchema = z
  .object({
    id: z.string(),
    order_id: z.string().nullable(),
    item_id: z.string().nullable(),
    description: z.string().nullable(),
    quantity: z.number(),
    price: z.number().nullable(),
    credits_used: z.number().nullable(),
    timestamp: z.string().nullable(),
    category: z.string().nullable(),
    service_type: z.string().nullable(),
    special_instructions: z.string().nullable(),
    created_by: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().nullable(),
    invoice_item_id: z.string().nullable(),
  })
  .strict()

// Append-only: update stays closed until an edit-item screen is specified, and delete has never
// been requested. `timestamp` is the created-timestamp role and is stamped by the repository on
// append; `updated_at` is left unstamped because update is disabled.
//
// Measured 2026-08-30 over all 23,165 rows:
//   - `timestamp` and `updated_at` hold DD/MM/YYYY HH:mm:ss. Appended rows will carry the
//     project's Bangkok yyyy-MM-dd HH:mm:ss instead — the audit stamp format is not negotiable in
//     SheetRepository. New rows therefore differ from historical rows in this column.
//   - Neither timestamp column is declared in valueInput: their cell type (real Sheets datetime vs
//     plain text) was not measured, and the request-wide input option is USER_ENTERED regardless.
//   - `category` (5 spellings) and `service_type` (8 spellings, Thai and English mixed) are free
//     strings on purpose; an enum would be a claim the data does not support.
//   - `invoice_item_id` is empty in all 23,165 rows.
//   - 1,074 rows are blank in every column except `quantity`, which reads 0.0 — a column-E
//     fill-down extends past the real data. They are scattered (row indexes 5 to 20,640) and are
//     returned by read(); `id` comes back null on them. The row schema is never parsed on reads, so
//     nothing throws, and the append key lookup skips blank key cells. Filtering them belongs to a
//     consumer, not to this layer.
export const orderItemFormsDbContract = {
  row: orderItemFormsRowSchema,
  primaryKey: 'id',
  sheetName: 'OrderItemForms',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: { onAppend: ['timestamp'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
```

## §2. New file — `server/sheets/OrderItemForms/OrderItemForms.repository.ts`

```ts
import { z } from 'zod'
import { orderItemFormsDbContract, orderItemFormsRowSchema } from './OrderItemForms.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type OrderItemFormsRow = z.infer<typeof orderItemFormsRowSchema>

let repository: SheetRepository<OrderItemFormsRow> | undefined

export function getOrderItemFormsRepository(): SheetRepository<OrderItemFormsRow> {
  return repository ??= new SheetRepository({ contract: orderItemFormsDbContract })
}
```

## §3. New file — `server/sheets/OrderImages/OrderImages.db-contract.ts`

```ts
import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical OrderImages sheet column order. */
export const orderImagesRowSchema = z
  .object({
    id: z.string(),
    customer_id: z.string().nullable(),
    delivery_id: z.string().nullable(),
    order_id: z.string(),
    image_type: z.string().nullable(),
    image_path: z.string().nullable(),
    notes: z.string().nullable(),
    quantity: z.number().nullable(),
    created_at: z.string().nullable(),
    created_by: z.string().nullable(),
  })
  .strict()

// Append-only: update stays closed until an edit-image screen is specified, and delete has never
// been requested. `created_at` is the created-timestamp role and is stamped by the repository on
// append.
//
// Measured 2026-08-30 over all 17,376 rows:
//   - `created_at` reads back as ISO with a Z suffix on newer rows and DD/MM/YYYY HH:mm:ss on
//     older ones. Appended rows will carry the project's Bangkok yyyy-MM-dd HH:mm:ss, a third
//     shape. It is not declared in valueInput: the column is demonstrably mixed, so it cannot be
//     called a measured Sheets datetime cell, and the request-wide input option is USER_ENTERED
//     regardless.
//   - `image_type` is a free string, not an enum: 13 spellings occur, including BAG/BAGS / BASKETS,
//     HANGER/HANGERS and DOCUMENT/Document, plus 1,329 blanks.
//   - `image_path` holds two incompatible formats: full Firebase Storage download URLs on newer
//     rows and legacy relative paths such as OrderForm_Images/<id>.form_image.<n>.jpg. Kept a plain
//     nullable string; a URL validator would reject a large share of existing rows and normalising
//     belongs in a module mapper.
//   - `quantity` is a decimal weight (20.5, 8.7), blank on 13,258 rows.
//   - `order_id` has zero nulls across all rows and is therefore not nullable.
export const orderImagesDbContract = {
  row: orderImagesRowSchema,
  primaryKey: 'id',
  sheetName: 'OrderImages',
  spreadsheetId: 'ORDERS_SPREADSHEET_ID',
  audit: { onAppend: ['created_at'] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
```

## §4. New file — `server/sheets/OrderImages/OrderImages.repository.ts`

```ts
import { z } from 'zod'
import { orderImagesDbContract, orderImagesRowSchema } from './OrderImages.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type OrderImagesRow = z.infer<typeof orderImagesRowSchema>

let repository: SheetRepository<OrderImagesRow> | undefined

export function getOrderImagesRepository(): SheetRepository<OrderImagesRow> {
  return repository ??= new SheetRepository({ contract: orderImagesDbContract })
}
```

`SheetContract` (`server/shared/contracts/sheet-contract.ts`) requires exactly `row`, `primaryKey`,
`sheetName`, `writes`. Optional: `spreadsheetId`, `valueInput`, `audit`. The four files above are
complete — enabling `append` adds no further required field.

## §5. Test edits — exact insertions

### 5.1 `tests/server/unit/sheets/sheet-binding.dry-test.ts`

Write capability is not asserted by this file; the edits are identical to what a read-only sheet
would need.

**(a) imports.** The block is not alphabetised — the last entries were appended in order, ending
with `issueReportsDbContract` on line 19. Append two, before the blank line preceding
`const expectedSheetCount`:

```ts
import { issueReportsDbContract } from '../../../../server/sheets/IssueReports/IssueReports.db-contract.js'
import { orderImagesDbContract } from '../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import { orderItemFormsDbContract } from '../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
```

**(b) count.**

```ts
const expectedSheetCount = 17
```

**(c) `expectedSheetDirectories`.** This literal has no real ordering convention — it is neither
ASCII-sorted nor case-insensitively sorted (`CustomerPackages` precedes `CustomerPackageView`, but
`PackageTransactions` precedes `Packages`). Its order is not load-bearing: both consuming assertions
call `.sort()` on it. Insert between `'OrderForm',` and `'OrdersView',`:

```ts
  'OrderForm',
  'OrderImages',
  'OrderItemForms',
  'OrdersView',
```

**(d) `bindings`.** Append after the `PriceList` entry, immediately before the closing `] as const`:

```ts
  {
    name: 'OrderImages',
    contract: orderImagesDbContract,
    expectedSpreadsheetId: 'ORDERS_SPREADSHEET_ID',
    expectedSheetName: 'OrderImages',
  },
  {
    name: 'OrderItemForms',
    contract: orderItemFormsDbContract,
    expectedSpreadsheetId: 'ORDERS_SPREADSHEET_ID',
    expectedSheetName: 'OrderItemForms',
  },
] as const
```

Nothing below `const sheetRoot = ...` changes.

### 5.2 `tests/server/unit/sheets/repository-getters.dry-test.ts`

**Do not touch `environmentKeys`** — `ORDERS_SPREADSHEET_ID` is already listed (line 4) and no new
env var is introduced. Do not touch the `process.env.* = '…'` assignment block.

This test deletes the env vars, imports every repository module, then sets fake ids and calls each
getter. Write-enabled contracts are safe here: the getter now reaches
`requireEnv('ORDERS_SPREADSHEET_ID')` and constructs a `SheetsApiClient`, but that constructor only
validates two non-empty strings and stores a token provider — it fetches no token and makes no
request, so the absence of `GOOGLE_SERVICE_ACCOUNT_KEY` in this test's environment does not matter.

**(a) destructuring + dynamic imports.** The destructured names and the `Promise.all` array are
positional — append to BOTH in the SAME order. `issueReportsModule` is currently last in both.

```ts
  issueReportsModule,
  orderItemFormsModule,
  orderImagesModule,
] = await Promise.all([
```

```ts
  import('../../../../server/sheets/IssueReports/IssueReports.repository.js'),
  import('../../../../server/sheets/OrderItemForms/OrderItemForms.repository.js'),
  import('../../../../server/sheets/OrderImages/OrderImages.repository.js'),
])
```

**(b) getters.** Append after the `['IssueReports', …]` pair, before `] as const`:

```ts
  ['IssueReports', issueReportsModule.getIssueReportsRepository],
  ['OrderItemForms', orderItemFormsModule.getOrderItemFormsRepository],
  ['OrderImages', orderImagesModule.getOrderImagesRepository],
] as const
```

### 5.3 `tests/server/unit/sheets/column-order.dry-test.ts`

**(a) imports.** Append after line 16 (`issueReportsDbContract`), before the `deriveGVizColumns`
import:

```ts
import { issueReportsDbContract } from '../../../../server/sheets/IssueReports/IssueReports.db-contract.js'
import { orderItemFormsDbContract } from '../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { orderImagesDbContract } from '../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import { deriveGVizColumns } from '../../../../server/shared/repositories/utils/gviz-query.builder.js'
```

**(b) `tests[]`.** Append after the `PriceList` entry, immediately before the closing `]`:

```ts
  {
    name: 'OrderItemForms',
    contract: orderItemFormsDbContract,
    expected: {
      id: 'A',
      order_id: 'B',
      item_id: 'C',
      description: 'D',
      quantity: 'E',
      price: 'F',
      credits_used: 'G',
      timestamp: 'H',
      category: 'I',
      service_type: 'J',
      special_instructions: 'K',
      created_by: 'L',
      updated_at: 'M',
      updated_by: 'N',
      invoice_item_id: 'O',
    },
    primaryKeyColumn: 'A',
  },
  {
    name: 'OrderImages',
    contract: orderImagesDbContract,
    expected: {
      id: 'A',
      customer_id: 'B',
      delivery_id: 'C',
      order_id: 'D',
      image_type: 'E',
      image_path: 'F',
      notes: 'G',
      quantity: 'H',
      created_at: 'I',
      created_by: 'J',
    },
    primaryKeyColumn: 'A',
  },
]
```

### 5.4 `tests/server/unit/sheets/audit-declarations.dry-test.ts` — NEW in this revision

Required because both contracts now declare `audit`. **This test will not go red without the
entries** — it only iterates the contracts listed in `declaredAudits`, so a missing entry means the
declaration is simply uncovered, and a later change to it passes silently. That is exactly what the
entry prevents.

**(a) imports.** Append after line 10 (`issueReportsDbContract`):

```ts
import { issueReportsDbContract } from '../../../../server/sheets/IssueReports/IssueReports.db-contract.js'
import { orderItemFormsDbContract } from '../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { orderImagesDbContract } from '../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
```

**(b) `declaredAudits`.** The assertion is `assert.deepEqual(contract.audit, expected)`, so
`expected` must have exactly the keys the contract declares — `onAppend` only, no `onUpdate`, mirroring
the `CustomerPackages` and `PackageTransactions` entries already in the file. Append after the
`Packages` entry, immediately before the closing `] as const`:

```ts
  {
    name: 'OrderItemForms',
    contract: orderItemFormsDbContract,
    expected: { onAppend: ['timestamp'] },
  },
  {
    name: 'OrderImages',
    contract: orderImagesDbContract,
    expected: { onAppend: ['created_at'] },
  },
] as const
```

Do not touch the `InvoiceItems` negative assertion below the loop.

### 5.5 `tests/server/integration/sheet-column-parity.ts`

**(a) imports.** Append after line 23 (`issueReportsDbContract`). Note the depth here is
`../../../server/…` (three levels), NOT `../../../../` as in the four unit tests — this file sits
one directory shallower:

```ts
import { issueReportsDbContract } from '../../../server/sheets/IssueReports/IssueReports.db-contract.js'
import { orderItemFormsDbContract } from '../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { orderImagesDbContract } from '../../../server/sheets/OrderImages/OrderImages.db-contract.js'
```

**(b) `readableSheets`.** Append after the `IssueReports` entry, before the closing `]`:

```ts
  {
    name: 'OrderItemForms',
    sheetName: orderItemFormsDbContract.sheetName,
    spreadsheetIdEnv: orderItemFormsDbContract.spreadsheetId!,
    rowSchema: orderItemFormsDbContract.row,
  },
  {
    name: 'OrderImages',
    sheetName: orderImagesDbContract.sheetName,
    spreadsheetIdEnv: orderImagesDbContract.spreadsheetId!,
    rowSchema: orderImagesDbContract.row,
  },
]
```

### 5.6 Tests deliberately NOT edited — re-verified 2026-08-30 under `append: true`

| File | Why no entry |
|---|---|
| `writing-workbook-binding.dry-test.ts` | Auto-discovers every `*.db-contract.ts` on disk. Its only assertion is that a writable contract is not bound to `PORTAL_SPREADSHEET_ID`; both new contracts use `ORDERS_SPREADSHEET_ID`. Its printed counter changes — see §7. |
| `module-laziness.dry-test.ts` | Enumerates `server/modules/**` paths. No module is created. |
| `service-wiring.dry-test.ts` | Imports production modules and the row schemas they use. No module is created. |
| `order-form.sheets-api.dry-test.ts`, `price-list.sheets-api.dry-test.ts`, `packages.repository.audit.dry-test.ts` | Per-sheet write-behaviour tests, not enumerations. Writing equivalents for these two sheets is a separate task and is not in scope; no existing test references them. |

## §6. Registry JSON on `G:` — one file only

Create **only** `G:\My Drive\Magicwash\Database\GoogleSheets\OrderItemForms.json`. Verified
2026-08-30: it does not exist. If it does exist when you run, stop and report — do not overwrite.

`OrderImages.json` in that folder was corrected by hand by the user on 2026-08-30 and already
matches the live tab. **Do not read it as a spec, do not re-derive it, do not add write-related
fields to it, do not touch it.** No other file in that folder may be modified or deleted, however
wrong it looks — report a discrepancy instead of fixing it (`BeforePhoto.json`, for example, still
declares `BEFORE_PHOTOS_SPREADSHEET_ID` and a `created_at` column against a tab the code reads via
`ORDERS_SPREADSHEET_ID` with a `timestamp` column).

Registry conventions applied: `title` = exact physical tab name; `properties` key order = physical
column order; `required` lists only columns with zero measured nulls; a decimal column is `number`,
never `integer`. Nullability is decided per column by the measured null count, independently of the
base type — 0 nulls → `"type": "number"` / `"string"`; ≥1 null → `["number","null"]` /
`["string","null"]`. That is why `quantity` below is `"number"` and `price` is `["number","null"]`
though both are floats. Datetime columns are `["string","null"]` with **no**
`"format": "date-time"`, because the live values are not all ISO and claiming that format would be
false; no `enum` on inconsistent columns; a `description` records the measurement on each dirty
column, matching the style the user established in `OrderImages.json`.

`required` here is `["id", "quantity"]`: `id` has 1,074 nulls in the raw tab, but every one is a
phantom row, and every other registry file declares its primary key required. `quantity` has zero
nulls. Both facts are recorded in their `description`.

### Complete final content — `OrderItemForms.json`

```json
{
  "spreadsheetIdProp": "ORDERS_SPREADSHEET_ID",
  "spreadsheetId": "1tfgJvjXMkH8MIoJ38No9-1DBdG7o0lcPG8dVhPCGw-E",
  "primaryKey": "id",
  "title": "OrderItemForms",
  "type": "object",
  "required": ["id", "quantity"],
  "additionalProperties": false,
  "properties": {
    "id": {
      "type": "string",
      "description": "Primary key. Measured 2026-08-30 over 23165 rows: blank on 1074 of them, and every blank belongs to a phantom row that is empty in all columns except quantity (0.0), produced by a column-E fill-down extending past the real data. Row indexes 5 to 20640, not contiguous."
    },
    "order_id": {
      "type": ["string", "null"],
      "description": "Blank on 1087 of 23165 rows."
    },
    "item_id": {
      "type": ["string", "null"],
      "description": "Blank on 3532 of 23165 rows."
    },
    "description": {
      "type": ["string", "null"],
      "description": "Thai free text. Blank on 1151 of 23165 rows."
    },
    "quantity": {
      "type": "number",
      "description": "Decimal, not integer. No blanks, but 1074 of the values belong to phantom rows and read 0.0."
    },
    "price": {
      "type": ["number", "null"],
      "description": "Decimal, not integer. Blank on 2495 of 23165 rows."
    },
    "credits_used": {
      "type": ["number", "null"],
      "description": "Decimal, not integer - 169 rows hold a non-integer value. Blank on 5619 of 23165 rows."
    },
    "timestamp": {
      "type": ["string", "null"],
      "description": "Created-timestamp role. Existing values are dd/MM/yyyy HH:mm:ss, so no format is declared. Rows appended through the Sheets API carry the project's Asia/Bangkok yyyy-MM-dd HH:mm:ss instead. Blank on 1074 of 23165 rows, all of them phantom rows."
    },
    "category": {
      "type": ["string", "null"],
      "description": "Free string, not an enum. Measured 2026-08-30: Tops(11734), Bottoms(5510), Home Textile(2237), Others(1409), Bedding(1), plus 2274 blanks."
    },
    "service_type": {
      "type": ["string", "null"],
      "description": "Free string, not an enum. Thai and English coexist. Measured 2026-08-30: ซักรีด(11350), WSIR(5522), รีดผ้า(846), ซักแห้ง(648), ซักพับ(579), IRON(366), DRCL(258), WASH(227), plus 3369 blanks."
    },
    "special_instructions": {
      "type": ["string", "null"],
      "description": "Blank on 23155 of 23165 rows."
    },
    "created_by": {
      "type": ["string", "null"],
      "description": "Blank on 23162 of 23165 rows."
    },
    "updated_at": {
      "type": ["string", "null"],
      "description": "Updated-timestamp role, currently unstamped: the contract enables append only. Existing values are dd/MM/yyyy HH:mm:ss, so no format is declared. Blank on 2483 of 23165 rows."
    },
    "updated_by": {
      "type": ["string", "null"],
      "description": "Blank on 2482 of 23165 rows."
    },
    "invoice_item_id": {
      "type": ["string", "null"],
      "description": "Empty in all 23165 rows as of 2026-08-30."
    }
  }
}
```

## §7. Verification

Run from the worktree root. Report the actual final line of each.

```bash
npx tsx tests/server/unit/sheets/sheet-binding.dry-test.ts
npx tsx tests/server/unit/sheets/repository-getters.dry-test.ts
npx tsx tests/server/unit/sheets/column-order.dry-test.ts
npx tsx tests/server/unit/sheets/audit-declarations.dry-test.ts
npx tsx tests/server/unit/sheets/writing-workbook-binding.dry-test.ts
npm run typecheck:api
```

| Command | Before | After — must match exactly |
|---|---|---|
| `sheet-binding` | `sheet binding dry test passed (15 sheets)` | `sheet binding dry test passed (17 sheets)` |
| `repository-getters` | `sheet repository getter dry tests passed` | `sheet repository getter dry tests passed` |
| `column-order` | `15 column-order dry tests passed` | `17 column-order dry tests passed` |
| `audit-declarations` | `sheet audit declarations dry test passed` | `sheet audit declarations dry test passed` |
| `writing-workbook-binding` | `writing workbook binding dry test passed (9/15 writable contracts checked)` | `writing workbook binding dry test passed (11/17 writable contracts checked)` |
| `npm run typecheck:api` | no output, exit 0 | no output, exit 0 |

Derivation of `11/17`: that test counts `contracts.filter(c => Object.values(c.writes).some(Boolean))`
— any true flag, not append specifically. The 9 today are `Appointments`, `CustomerPackages`,
`InvoiceItems`, `Invoices`, `IssueReports`, `OrderForm` (update-only), `PackageTransactions`,
`Packages`, `PriceList`. Both new contracts have `append: true`, so the numerator rises by exactly 2.
A numerator of 9 means both `append` flags were left false.

**That counter cannot detect `update` or `delete`.** It counts contracts, not flags, so a contract
with `update: true` or `delete: true` still prints `11/17`. No test in this task asserts those
stayed false. Check them directly and report the output:

```bash
grep -n "writes:" server/sheets/OrderItemForms/OrderItemForms.db-contract.ts server/sheets/OrderImages/OrderImages.db-contract.ts
```

Both lines must read exactly `  writes: { append: true, update: false, delete: false },`

Live parity check — the only check that proves the declared columns match the real tab:

```bash
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
```

Use that command, not bare `npx tsx`: `requireEnv` reads `process.env` and `tsx` does not load
`.env.local` on its own, so a bare run fails with `Missing required environment variable: …` on the
first sheet — an environment failure, not a contract failure. Expected new lines:

```
OrderItemForms: 15 columns — PASS
OrderImages: 10 columns — PASS
```

A `FAIL` line names the mismatch (`expected N columns [...], got M [...]`). Report it literally; do
not edit a contract to match a garbled label without first confirming the request carried
`headers=1` (it does).

If the sandbox has no network, say so explicitly. Do not report it as passed and do not omit it.

### 7.1 Registry write check — no test covers `G:`

`G:` is outside the repo, so every command above passes even if the registry file was never
written. Run this and report the output:

```bash
ls -l "G:/My Drive/Magicwash/Database/GoogleSheets/OrderItemForms.json"
node -e "const j=JSON.parse(require('fs').readFileSync('G:/My Drive/Magicwash/Database/GoogleSheets/OrderItemForms.json','utf8'));console.log(j.title, j.spreadsheetIdProp, Object.keys(j.properties).length, Object.keys(j.properties).join(','))"
```

Expected: `OrderItemForms ORDERS_SPREADSHEET_ID 15 id,order_id,item_id,description,quantity,price,credits_used,timestamp,category,service_type,special_instructions,created_by,updated_at,updated_by,invoice_item_id`

Also confirm nothing else in that folder changed — report the output of:

```bash
ls -l "G:/My Drive/Magicwash/Database/GoogleSheets/OrderImages.json"
```

Its modification time must be the user's hand-edit, not yours.

If the sandbox cannot write to `G:`, do not work around it: write the file to
`registry-pending/OrderItemForms.json` inside the worktree, run the same `node -e` check against
that path, and say so plainly in the report so the human can copy it across. Reporting the
sheet-layer tests green while no registry file exists anywhere is a failed task, not a partial one.

## §8. Commit and post-checks

One commit on `feat/register-order-sheets`. Do not run `git worktree`, `git merge` or `git push`,
and do not touch `main`.

```bash
git status --short
git diff --stat main...HEAD
git diff --diff-filter=D --name-only main...HEAD
```

The third must be empty — nothing is deleted by this task.

Expected `git diff --stat main...HEAD` file list, exactly:

- 4 new files under `server/sheets/OrderItemForms/` and `server/sheets/OrderImages/`
- 5 modified test files (`sheet-binding`, `repository-getters`, `column-order`,
  `audit-declarations`, `sheet-column-parity`)
- `docs/design-register-order-sheets.md`
- `registry-pending/OrderItemForms.json` — **only** on the `G:`-unwritable fallback path; absent
  when the file was created on `G:` as intended

Nothing else. State in the report which of the two registry paths was taken.

## §9. Findings — report these, do not act on them

### 9.1 Appended timestamps will not match the historical format

`prepareAuditRow` fills a declared audit column with `formatBangkokTimestamp(now())`, i.e.
`yyyy-MM-dd HH:mm:ss` Asia/Bangkok, and rejects a caller-supplied value that fails
`/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/` with `Audit column '<c>' must use timestamp format
yyyy-MM-dd HH:mm:ss`. The existing cells are `dd/MM/yyyy HH:mm:ss` (`OrderItemForms.timestamp`,
`updated_at`) and mixed ISO/`dd/MM/yyyy` (`OrderImages.created_at`). So a caller **cannot** write a
matching `dd/MM/yyyy` value through this path, and appended rows will differ from historical rows in
those columns.

What the cell ends up looking like is not determined by this design: the request always sends
`valueInputOption: 'USER_ENTERED'`, so Sheets will coerce `2026-08-30 14:05:00` into a datetime
serial if the column accepts one — in which case it displays in the column's existing format and the
divergence is invisible — or keep it as literal text if the column is plain text, in which case it is
visible. The cell type was not measured. Exercise one append against a throwaway copy of the
workbook before the first production write, per `add-sheet` §9.

### 9.2 `valueInput` is omitted deliberately — and it is not a wire-level setting

`SheetRepository.appendRows` passes the literal `'USER_ENTERED'` for the whole request. The only
runtime use of `contract.valueInput` is `validateValueInputPolicy`, which iterates the **declared**
columns and rejects any whose resolved option is not `'USER_ENTERED'`. Consequences:
declaring `'USER_ENTERED'` is a no-op guard; declaring `'RAW'` — which `SheetContract`'s type still
permits — makes every append fail with `WriteRejectedError`; `resolveRowValueInputOptions` (whose
default is `'RAW'`) is dead code in production, used only by a unit test. `add-sheet` rule 5 allows
the declaration only for a column measured to be a real Sheets datetime cell; that was not measured
here, and `OrderImages.created_at` demonstrably holds ISO text on newer rows. Omitting it is
well-precedented on append-enabled sheets: `IssueReports` (with an explicit comment),
`CustomerPackages`, `PackageTransactions`, `Packages`. Never read a contract's `valueInput` as
evidence of a cell's type.

### 9.3 The user's `OrderImages.json` calls `created_at` a "Real Sheets datetime cell"

The same description also records that newer rows read back as ISO with a `Z` suffix, which is text,
not a datetime serial. Both statements cannot hold for every row. This is not blocking and the file
is human-owned — do not edit it. It is the reason §9.2 declines to declare `valueInput` for that
column.

### 9.4 Live append preconditions that no dry-test covers

The first `append()` loads a header map from the live sheet via
`SheetsApiClient.readHeader()` (`A1` row range, Sheets API, authenticated). `buildSheetHeaderMap`
then throws `SheetHeaderMapError` — surfaced as `WriteRejectedError` — if row 1 has a blank cell
*between* populated headers (trailing blanks are trimmed, interior ones are fatal), if a header name
is duplicated, or if any contract column name is missing from row 1. An audit column missing from
the header map is rejected the same way. Extra live columns beyond the contract are tolerated: they
widen the append payload and are filled with `''`. None of this is measured or asserted by any test
in this task, and none of it can be checked without a live authenticated call.

### 9.5 Capability without a caller

Enabling `append` does not create an endpoint. Until a module, an API schema and a route-registry
entry exist, nothing in the deployed app appends a row to either tab. Flag this when handing the
branch over so "บันทึกลง sheet ได้" is not reported as complete.

## Out of Scope

- `contracts/**` API schema pair
- `server/modules/**` service, mapper, or module contract
- `server/api/route-registry.ts`, `api/**` route handlers
- `src/**` (any frontend file)
- `.env.example`, new env vars, Vercel env changes, service-account permission changes
- `writing-workbook-binding.dry-test.ts`, `module-laziness.dry-test.ts`, `service-wiring.dry-test.ts`
- New per-sheet write-behaviour tests (`*.sheets-api.dry-test.ts`)
- Any `G:` file other than the single new `OrderItemForms.json`
- `update` / `delete` write paths
- Normalising `image_type`, `image_path`, `category`, `service_type`, or any timestamp column
- Any change to the sheet data itself, including the phantom rows and the column-E fill-down

## Status

FINAL
