---
name: add-sheet
description: Register an existing Google Sheet with the backend API end to end — db-contract, repository, API contract, module, route registration, env var, and the six tests that do not auto-discover a new sheet. Use when adding any new physical sheet (photos, or any future tab) or a new module over an existing sheet.
---

# Registering a sheet with the backend

**This never creates or alters a Google Sheet.** The sheet, its tabs, and its columns already
exist and belong to the business. Registering one means reading what is there and declaring a
contract that describes it. Adding a column, renaming one, or reordering them is out of bounds —
for you and for any agent you delegate to. If a contract seems to need a column the sheet does
not have, that is a decision for the project owner, not a fix to apply.

Physical column names do not affect behaviour. Everything downstream reads the contract, so a
sheet whose column is called `Timestamp` works exactly as well as one calling it `created_at`.
Naming consistency belongs in `fieldMap`, where the API field names are chosen — not in the
sheet.

Seven files, in this order. Skipping the order costs rework: the row schema's key order is
derived from the live sheet, and everything downstream is derived from the row schema.

## 1. Establish the physical truth first — never from the registry

Before writing any code, get the real tab name, the real header row, and the real workbook id.

**The registry is documentation and it can be stale; the sheet is the truth.** `Appointment.json`
once declared 15 columns against a live sheet of 17 — believing it took production down, and
typecheck, 25 dry-tests and `npm run build` all stayed green.

Two traps that have already bitten:
- **A logical name is not the tab name.** The photos feature's targets are `LaundryPhotos` (BEF)
  and `after` — lowercase — not what the old code called them.
- **Related sheets can live in different workbooks.** Check each one's spreadsheet id separately.

Read the live header row before writing the row schema.

## 2. `server/sheets/<Sheet>/<Sheet>.db-contract.ts`

A sheet folder holds **exactly two files** — this contract and the repository getter. No index,
no barrel, no service. `server/sheets/` imports neither `contracts/` nor `server/modules/`.

```ts
import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

/** KEY ORDER = physical <Sheet> sheet column order. */
export const fooRowSchema = z
  .object({
    foo_id: z.string().length(8),
    name: z.string().min(1),
    note: z.string().nullable(),
    created_at: z.string(),
  })
  .strict()

export const fooDbContract = {
  row: fooRowSchema,
  primaryKey: 'foo_id',
  sheetName: 'Foos',
  spreadsheetId: 'FOOS_SPREADSHEET_ID',
  valueInput: { created_at: 'USER_ENTERED' },
  audit: { onAppend: ['created_at'], onUpdate: [] },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract
```

`SheetContract` fields — `row`, `primaryKey`, `sheetName`, `writes` are required;
`spreadsheetId`, `valueInput`, `audit` are optional.

| Field | Meaning |
|---|---|
| `row` | Zod object. **Key order = physical column order.** |
| `primaryKey` | The physical DB column name, never the API field name. |
| `sheetName` | The Google Sheets tab name, exactly as it appears. |
| `spreadsheetId` | The **name of the env var** holding the id — not the id itself. |
| `valueInput` | Intent + guard only. See below. |
| `audit` | Physical column names to stamp with a timestamp on append / update. |
| `writes` | `append` / `update` / `delete` capability flags. A false flag refuses before any request. |

**Key order is load-bearing.** `deriveGVizColumns` maps `Object.keys(row.shape)` by *index* to
column letters A, B, C… Swap two keys and every read silently returns the wrong column.
Reordering is never cosmetic.

**`valueInput` does not choose the wire value.** The write path always sends `USER_ENTERED` for
the whole request. This map exists only to *reject* a column that declares anything else, so a
contract and the transport can never disagree silently. A column that declares nothing still goes
out as `USER_ENTERED` — it is not sent as `RAW`. Adding a column here fixes no wire-level bug;
that mistake has already produced one wrong diagnosis. Declare a column here to record that its
cell must stay a real Sheets datetime/number, and to trip the guard if someone changes it.

**`audit` stamps timestamps only, never actor columns.** The repository fills a listed column
when the caller leaves it `undefined`. If the caller supplies one, it must already match
`yyyy-MM-dd HH:mm:ss` (Asia/Bangkok) or the write is rejected — the Appointments workbook locale
is `en_US`, and any other format either stays text or parses with day and month transposed. 373
cells once had to be repaired because of this. A listed column missing from the live header row
is also a rejection. See the **Metadata columns — declare roles, never names** section below for
the complete role rules.

**`.strict()`** is used on the newer sheets (InvoiceItems, Invoices, Payments) and not on the
older ones. Use it.

Column names mirror the physical headers as-is — snake_case, PascalCase, or camelCase, whatever
the sheet actually uses. Do not normalize them.

A JSON-in-cell column is `z.string()` at this layer. Parsing happens in the module.

## Metadata columns — declare roles, never names

Audit metadata is a set of **roles**. A contract declares which of the sheet's existing columns
fill them. Physical names differ across sheets and that is fine: `Invoices` declares `created_at`
for the created-timestamp role, while `OrderForm` has `timestamp` and `Customers` has `Timestamp`
as corresponding physical columns that are not currently auto-stamped on append. The contract
determines which role behavior is wired; matching names alone do not make those declarations
equivalent.

| Role | What it holds |
|---|---|
| created-timestamp | when the row was appended |
| created-actor | who appended it |
| updated-timestamp | when the row was last patched |
| updated-actor | who patched it |
| deleted-timestamp | when the row was soft-deleted |
| deleted-actor | who soft-deleted it |

A sheet may fill none, some, or all six. **An unfilled role stays unfilled** — never add a column
to complete the set.

Declaration rules, the same for every sheet:

1. `audit.onAppend` lists the created-timestamp column and nothing else.
2. `audit.onUpdate` lists the updated-timestamp column and nothing else.
3. **Actor columns never appear in `audit`.** The repository cannot know who is calling until API
   authentication exists, so actors arrive in the row payload.
4. **Declare `audit` and `valueInput` only for a write the contract actually allows.** An
   `onUpdate` entry on a sheet with `writes.update: false` is a claim the code never honours.
5. `valueInput: 'USER_ENTERED'` goes on a timestamp column **measured** to hold a real Sheets
   datetime. A column measured as plain text is left undeclared, with a comment recording what
   was measured and when — switching it is a data migration, not a contract change.
6. **Never stamp the updated-timestamp on append.** A row nobody has edited must show an empty
   updated-timestamp, because that emptiness is the only thing answering "has anyone touched this
   row?". Filling it on append destroys that answer for every row, permanently.
7. deleted-timestamp and deleted-actor are never stamped automatically. `delete` is closed; when
   it opens it is an explicit soft delete.

Naming lands in `fieldMap`, which is free to be consistent because it never touches the sheet:
map whatever the physical column is called to `createdAt` / `createdBy` / `updatedAt` /
`updatedBy` / `deletedAt` / `deletedBy` on the API side.

Two sheets predate these rules. **Do not copy them:**
- `Appointments` lists `UpdatedAt` in `onAppend`, against rule 6.
- `Customers` declares `audit.onUpdate` while every `writes` flag is `false`, against rule 4.

## 3. `server/sheets/<Sheet>/<Sheet>.repository.ts`

The only site that constructs this repository, behind a lazy memoized getter. Constructing at
import time would drag an unrelated sheet's env var into every cold start.

```ts
import { z } from 'zod'
import { fooDbContract, fooRowSchema } from './Foos.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type FooRow = z.infer<typeof fooRowSchema>

let repository: SheetRepository<FooRow> | undefined

export function getFoosRepository(): SheetRepository<FooRow> {
  return repository ??= new SheetRepository({ contract: fooDbContract })
}
```

What the repository gives the caller:

| Method | Behaviour worth knowing |
|---|---|
| `read(query?)` | GViz. Returns `Partial<TDbRow>[]`. Cell values are not runtime-validated — dirty legacy rows must not 500. |
| `append(row)` | Stamps audit columns, rejects a duplicate primary key before writing, verifies the PK on the echoed row. |
| `batchAppend(rows)` | Also rejects a key duplicated *within* the batch. A returned-count mismatch becomes committed-unreadable — do not retry. |
| `update(key, patch)` | Strips the PK from the patch, patches only the changed columns, reads the row back and verifies the PK. |
| `delete(key, by)` | Checks the capability flag, then always throws `delete is not supported yet`. |

Error classes and what they mean for a retry:

| Class | Certainty | Retry? |
|---|---|---|
| `DuplicatePrimaryKeyError` (extends `WriteRejectedError`) | rejected | Safe — nothing was written |
| `WriteRejectedError` | rejected | Safe — nothing was written |
| `WriteTransportError` | unknown | **No** |
| `WriteCommittedUnreadableError` | unknown | **No — the write committed**, only the response was unreadable |
| `WriteRowIdentityMismatchError` | unknown | **No** |

**Never auto-retry a write that was already sent.** 429 and 401 are observable only after the
request goes out. Retry is allowed for token acquisition only.

## 4. `contracts/<feature>/<m>-api.schema.ts`

camelCase only. DB shape never crosses this line. Feature enums are declared here and nowhere
else.

```ts
export const fooApiContract = {
  query: { list: fooListQuerySchema },
  request: { create: fooCreateSchema, update: fooUpdateSchema },
  response: {
    list: fooListResponseSchema,
    detail: fooDetailResponseSchema,
    create: fooCreateResponseSchema,
    update: fooUpdateResponseSchema,
  },
} satisfies ModuleApiContract
```

`query.list` and `response.list` are required; everything else is optional — and the optional
slots are what switch routes on:

| Slot present | Route enabled |
|---|---|
| `response.detail` | item `GET` |
| `request.create` + `response.create` | collection `POST` |
| `request.update` + `response.update` | item `PATCH` |

`request` is all-or-nothing: declaring it requires both `create` and `update`.

`query.list` must include `keyword` (`z.string().default('')` is the standard no-op) because
`ReadQueryDTO.fromQuery` requires it.

The smallest real example is `contracts/orders/order-api.schema.ts` — list-only, no writes.
The full-CRUD example is `contracts/customers/customer-api.schema.ts`.

## 5. `server/modules/<module>/<m>.module.ts`

For a plain single-sheet CRUD module, one file: field map, service, routes. Copy
`server/modules/customers/customer.module.ts` — it is the cleanest.

```ts
export const fooFieldMap = {
  foo_id: 'fooId',
  name: 'name',
  note: 'note',
  created_at: 'createdAt',
} as const satisfies Record<keyof FooDbRow & string, string>

export const fooService = new BaseCrudService({
  repository: getFoosRepository,
  api: fooApiContract,
  searchFields: ['fooId', 'name'],
  fieldMap: fooFieldMap,
  jsonColumns: fooJsonColumns, // only if a column stores JSON text
})

export const fooRoutes = createCrudRoutes(fooService, fooApiContract)
```

`fieldMap` maps **DB column → API field**. `jsonColumns` maps **DB column →
`{ field, kind: 'array' | 'object' }`**, where `field` is the API field that receives the decoded
value; a malformed cell falls back to `[]` or `null` rather than 500.

What breaks, and how quietly:

| Mistake | Symptom |
|---|---|
| DB key missing from `fieldMap` | The key passes through unrenamed, so the response field is `undefined` — and filters/sorts query the wrong GViz column |
| Two DB columns mapped to one API field | Throws at construction: `Field map is not bijective` |
| Wrong `jsonColumns` DB key | Decoding never runs; the field stays a raw JSON string |
| Wrong `jsonColumns.field` | The decoded value lands on a name no response schema reads |
| No `fieldMap`/`jsonColumns`/`transformer` at all | The service takes the API-shaped repository path and the shape is wrong at runtime |

`satisfies Record<keyof DbRow & string, string>` checks keys and types, not the string *values* —
a test must pin the values.

Multi-sheet or non-CRUD business logic gets its own service instead
(`server/modules/invoices/`, `server/modules/appointments/`), not a hook in the generic engine.

## 6. `server/api/route-registry.ts`

```ts
photos: (): ReturnType<RouteLoader> =>
  import('../modules/photos/photo.module.js').then((module) => module.photoRoutes),
```

The registry key becomes the URL segment: this entry serves `/api/photos`.

**The import specifier must be a literal string.** Vercel's file tracer reads it statically to
decide what to bundle; a computed specifier drops the route from the deployment. It must never be
built from a request value.

## 7. Environment variable

The contract holds the **name**; the value lives in the environment.

- Add the value to `.env.local`
- Add the key to `.env.example` (`CUSTOMERS_SPREADSHEET_ID` is missing there today — don't copy
  that omission)
- Add it to Vercel **Production and Preview** — a missing var is invisible until the first live
  request
- Writes also need `GOOGLE_SERVICE_ACCOUNT_KEY`, and the service account needs Editor on that
  workbook

Env is read lazily: `requireEnv` fires when the getter first initializes, and on every `read()`.
Importing the module does not read it — which is why the laziness test exists.

**Only three workbooks are writable today**: `1tfgJvj` (OrderForm), `1CvVl6a` (Appointments),
`1zfhguJ` (Invoices/InvoiceItems). The portal workbook `1ucqeUq` is GViz-read and
Apps-Script-written only and must never be bound to a writable contract.

## 8. Tests — six need a manual entry, one finds you automatically

This is the step that gets forgotten. Only `writing-workbook-binding` discovers a new sheet on
its own. Six others need an entry, plus a seventh if the contract declares `audit`. Of all of
them only `sheet-binding` goes red on its own; the rest stay green while covering nothing.

| Test | New sheet needs |
|---|---|
| `tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` | nothing — walks every contract |
| `tests/server/unit/sheets/sheet-binding.dry-test.ts` | an entry — it counts the directory and asserts against a manual list, so it goes **red** until you add one |
| `tests/server/unit/sheets/column-order.dry-test.ts` | an entry pinning the column order |
| `tests/server/unit/sheets/repository-getters.dry-test.ts` | the getter and its env key |
| `tests/server/unit/sheets/module-laziness.dry-test.ts` | the module path |
| `tests/server/unit/sheets/service-wiring.dry-test.ts` | the production module import |
| `tests/server/unit/sheets/audit-declarations.dry-test.ts` | an entry **if** the contract declares `audit` |
| `tests/server/integration/sheet-column-parity.ts` | the sheet in `readableSheets` |

Run them:

```bash
npx tsx tests/server/unit/sheets/<name>.dry-test.ts
npm run typecheck:api
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
```

## 9. Verify

```bash
npm run typecheck:api
npm run build
```

Then know what those did **not** prove:

- Swapped row-schema key order stays type-correct. Only column parity against the live sheet
  catches it.
- A missing `.js` extension on a relative backend import typechecks clean —
  `api/tsconfig.json` uses `moduleResolution: "Bundler"`, and `vercel dev` misses it too. Only a
  real deploy catches it. This took production fully down on 2026-07-21.
- A fixture edited to match the code instead of the sheet pins the bug as correct. That is worse
  than having no test.

So: deploy to preview, `curl` the preview URL, then promote and `curl` the production alias.
Before touching a production sheet, exercise append/update/serialization/error paths against a
throwaway spreadsheet first.

## Rules that outrank convenience

- The sheet's structure is not yours to change. No added column, no rename, no reorder — the row
  schema describes what already exists.
- `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` is **read-only**. It is shared with the
  Python project at the repo root. When registry and code disagree, change the code or report it
   — never edit the registry to match. "Make them match" always has two solutions and the wrong
  one rewrites the business's source of truth.
- Every relative backend import/export carries an explicit `.js` extension.
- No barrel, index, or registry object under `server/sheets/`.
- `delete` stays `false`. If it is ever opened, it must be a soft delete (`deleted_at` /
  `deleted_by`), not a row removal.
