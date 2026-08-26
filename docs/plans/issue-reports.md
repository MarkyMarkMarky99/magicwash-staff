# Issue Reports — implementation plan

Branch: `feature/issue-reports`. First file under `docs/plans/`; future plans follow `docs/plans/<feature>.md`.

## Scope

Staff-facing bug/problem reporting. New physical sheet `IssueReports`, backend module `issue-reports` (list / get / create / update), frontend feature `src/features/issue-reports/` (submit form, list, detail with status change).

No delete. No auth. No file upload.

---

## Naming (fixed)

| Thing | Value |
|---|---|
| Registry file | `IssueReport.json` (singular filename, plural `title` — matches `Payment.json`→`Payments`, `InvoiceItem.json`→`InvoiceItems`) |
| Sheet tab | `IssueReports` |
| Sheet folder | `server/sheets/IssueReports/` |
| DB contract exports | `issueReportsRowSchema`, `issueReportsDbContract` |
| Repository getter | `getIssueReportsRepository` |
| Env var | `ISSUE_REPORTS_SPREADSHEET_ID` |
| API contract | `contracts/issue-reports/issue-report-api.schema.ts` → `issueReportApiContract` |
| Module | `server/modules/issue-reports/issue-report.module.ts` → `issueReportRoutes` |
| Route registry key / URL | `issue-reports` → `/api/issue-reports` |
| Frontend feature | `src/features/issue-reports/` → `issueReportRoutes` |

---

## Decisions (decided — do not re-open)

| Decision | Reason (one line) |
|---|---|
| `BaseCrudService` + `createCrudRoutes`, no named service class | Single sheet, no cross-sheet orchestration; matches `customer.module.ts`. |
| Module-local repository wrapper implementing `SheetRepositoryContract` | Server must own `IssueReportID` and initial `Status`; this is the `price-list.module.ts` pattern, cheaper than a named service. |
| `IssueReportID` = `ISS-` + `generateShortId()`, no pre-read for collisions | 8 hex chars ≈ 4.3e9 space; `SheetRepository.append` already rejects a duplicate PK before writing (`DuplicatePrimaryKeyError`, nothing written), so a full-sheet read per submission buys nothing. |
| `Status` is server-set to `OPEN` on create; absent from the create schema | Every new report starts OPEN; a client-chosen initial status invites `RESOLVED`-on-create. |
| Any status → any status on PATCH, no state machine | No workflow requirement was given; 4 values, staff-only. |
| `audit: { onAppend: ['CreatedAt'], onUpdate: ['UpdatedAt'] }` | add-sheet rule 6: `UpdatedAt` empty is the only signal that nobody has touched the row. Do **not** copy `Appointments`, which stamps both on append. |
| No `valueInput` key at all | `CreatedAt`/`UpdatedAt` are Plain-Text columns by design (see registry description); add-sheet rule 5 says a plain-text timestamp column stays undeclared, with a comment recording that. |
| No `preserveNullValues` option on the repository | Default `false` serializes `null` **and** absent keys to `''`, which is the wanted blank cell; `PriceList` only needs the flag because it opts into JSON `null`. |
| No nullable-defaults helper in the wrapper | Consequence of the line above — absent keys already write `''`. |
| `CreatedBy` / `UpdatedBy` required in the API request schemas, `nullable` in the DB row | add-sheet rule 3: actor columns never go in `audit`, they ride on the payload; the row schema stays nullable because legacy/blank cells must not break a read. |
| `screenshotUrl` = free string, no `z.string().url()` | Drive/shortener links vary; a strict URL check adds a 400 failure mode with no benefit. |
| `response.detail` declared (so item `GET` exists) and equal to `response.list` | The sheet is small and every field is safe to expose; a narrower list DTO would add a shape with no consumer. |
| Frontend list filters by status in memory, filter kept in a local `ref` (not a route query) | List returns everything in one page; the route-query rules exist for dismissible overlays, and a triage filter has no deep-link requirement. |
| Form page is a **route** (`/issue-reports/new`) rendering `FormOverlay :open="true"` | Project rule: an overlay that Back must dismiss is a route; this is the `PriceListFormPage.vue` template. No `pushState` anywhere. |
| Staff identity typed once and cached in `localStorage`, via feature-local composable | There is no auth; `appointments` hardcodes `'admin'` (loses attribution) and `customer-packages` retypes it every time (friction). Caching one field gets attribution without inventing auth. |
| No new error-mapping layer; repository write errors surface as HTTP 500 `INTERNAL_ERROR` | `ApiHandler` maps any non-`ApiError` to 500, and `DuplicatePrimaryKeyError` / `WriteTransportError` / `WriteCommittedUnreadableError` are not `ApiError`s. Mapping them is a cross-module change to shared HTTP code, out of this feature's scope. |
| Validation failures are **422**, not 400 | `parseOrThrow` throws `ApiError.validation` → `VALIDATION_ERROR` → 422 (`server/shared/http/api-error.ts:9`). |
| `NavSidebar.vue` gets one new `<li>` | The shared-component freeze exists to protect **prop contracts**; `NavSidebar` has no item prop, its menu is hardcoded, and it is the only entry point — a new `<li>` cannot break another page. Reported under Shared gaps. |
| No entry in `service-wiring.dry-test.ts` | Verified: that file is a stubbed-transport characterization suite for orders/appointments/invoices/customer-packages only — it is **not** a per-sheet registry (`add-sheet` SKILL.md step 8 is wrong about this; neither `customers` nor `price-list` appear there). Coverage comes from a new `issue-report-wiring.dry-test.ts` instead. |

---

## 1. Registry draft — `IssueReport.json`

Human-only file. Paste to `G:\My Drive\Magicwash\Database\GoogleSheets\IssueReport.json`. **No agent writes to that path.**

```json
{
  "spreadsheetIdProp": "ISSUE_REPORTS_SPREADSHEET_ID",
  "spreadsheetId": "<PENDING_SPREADSHEET_ID>",
  "primaryKey": "IssueReportID",
  "title": "IssueReports",
  "type": "object",
  "required": [
    "IssueReportID",
    "Title",
    "Description",
    "Status",
    "CreatedAt"
  ],
  "additionalProperties": false,
  "properties": {
    "IssueReportID": {
      "type": "string",
      "description": "Primary key. Format 'ISS-' + the first hyphen-delimited group of a UUID v4 (8 lowercase hex characters), e.g. ISS-3f8a1c92."
    },
    "Title": {
      "type": "string",
      "description": "Short summary of the problem, entered by staff."
    },
    "Description": {
      "type": "string",
      "description": "Full description of the problem, entered by staff."
    },
    "Status": {
      "type": "string",
      "enum": ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      "description": "Triage state. Set to OPEN by the server on create; changed only through PATCH."
    },
    "ScreenshotUrl": {
      "type": ["string", "null"],
      "description": "Optional link to a screenshot or recording. Free-form URL text; no upload pipeline writes this column."
    },
    "CreatedAt": {
      "type": "string",
      "description": "Creation timestamp written as plain text in 'YYYY-MM-DD HH:mm:ss' (24-hour, project timezone Asia/Bangkok, UTC+07:00), produced by format_timestamp(). The sheet column must be formatted as Plain Text so the value stays text and is not coerced into a Google Sheets date serial."
    },
    "CreatedBy": {
      "type": ["string", "null"],
      "description": "Staff identifier who filed the report. Supplied in the write payload; never auto-stamped."
    },
    "UpdatedAt": {
      "type": ["string", "null"],
      "description": "Last-update timestamp written as plain text in 'YYYY-MM-DD HH:mm:ss' (24-hour, Asia/Bangkok, UTC+07:00), produced by format_timestamp(); blank until the row is first updated. Same Plain-Text column requirement as CreatedAt."
    },
    "UpdatedBy": {
      "type": ["string", "null"],
      "description": "Staff identifier who last updated the report. Supplied in the write payload; never auto-stamped."
    }
  }
}
```

Physical column order (load-bearing everywhere below): `A IssueReportID`, `B Title`, `C Description`, `D Status`, `E ScreenshotUrl`, `F CreatedAt`, `G CreatedBy`, `H UpdatedAt`, `I UpdatedBy`.

---

## 2. `server/sheets/IssueReports/IssueReports.db-contract.ts`

Exactly two files in this folder. No index, no barrel, no service. Every relative import carries `.js`.

```ts
import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const issueReportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

/** KEY ORDER = physical IssueReports sheet column order. */
export const issueReportsRowSchema = z
  .object({
    IssueReportID: z.string().min(1),
    Title: z.string().min(1),
    Description: z.string().min(1),
    Status: issueReportStatusSchema,
    ScreenshotUrl: z.string().nullable(),
    CreatedAt: z.string(),
    CreatedBy: z.string().nullable(),
    UpdatedAt: z.string().nullable(),
    UpdatedBy: z.string().nullable(),
  })
  .strict()

// CreatedAt/UpdatedAt are Plain-Text columns by design (measured requirement, not
// an observation): they hold 'YYYY-MM-DD HH:mm:ss' text, never a Sheets datetime
// serial. They are therefore deliberately absent from `valueInput` — switching
// them would be a data migration, not a contract change.
export const issueReportsDbContract = {
  row: issueReportsRowSchema,
  primaryKey: 'IssueReportID',
  sheetName: 'IssueReports',
  spreadsheetId: 'ISSUE_REPORTS_SPREADSHEET_ID',
  audit: {
    onAppend: ['CreatedAt'],
    onUpdate: ['UpdatedAt'],
  },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract
```

## 3. `server/sheets/IssueReports/IssueReports.repository.ts`

```ts
import { z } from 'zod'
import { issueReportsDbContract, issueReportsRowSchema } from './IssueReports.db-contract.js'
import { SheetRepository } from '../../shared/repositories/sheet.repository.js'

type IssueReportsRow = z.infer<typeof issueReportsRowSchema>

let repository: SheetRepository<IssueReportsRow> | undefined

export function getIssueReportsRepository(): SheetRepository<IssueReportsRow> {
  return repository ??= new SheetRepository({ contract: issueReportsDbContract })
}
```

## 4. `contracts/issue-reports/issue-report-api.schema.ts`

camelCase only. The status enum is declared here and nowhere else on the API side.

```ts
import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const issueReportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

// Free-form link text: Drive/shortener URLs vary, so no .url() check.
const screenshotUrlSchema = z.string().trim().min(1)

// Create: client sends the problem + who is reporting it. The server owns
// IssueReportID, Status (always OPEN) and CreatedAt.
export const issueReportCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  screenshotUrl: screenshotUrlSchema.nullish(),
  createdBy: z.string().trim().min(1),
})

// Update: PATCH — every mutable field optional, updatedBy required, at least one change.
export const issueReportUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    status: issueReportStatusSchema.optional(),
    screenshotUrl: screenshotUrlSchema.nullable().optional(),
    updatedBy: z.string().trim().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

export const issueReportSortFieldSchema = z.enum(['createdAt'])

// The sheet is a low-volume internal log; the UI filters and paginates in
// memory, so the default page size equals the cap.
export const MAX_ISSUE_REPORTS_PER_PAGE = 500

export const issueReportListQuerySchema = z.object({
  // Free-text search across issueReportId / title / description / createdBy.
  keyword: z.string().default(''),
  status: issueReportStatusSchema.nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_ISSUE_REPORTS_PER_PAGE)
    .default(MAX_ISSUE_REPORTS_PER_PAGE),
  sortBy: issueReportSortFieldSchema.default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Key order = DTO key order. Every column is exposed; there is no field the UI
// must not see, so detail/create/update reuse this shape.
export const issueReportListResponseSchema = z.object({
  issueReportId: z.string(),
  title: z.string(),
  description: z.string(),
  status: issueReportStatusSchema,
  screenshotUrl: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
})

export const issueReportDetailResponseSchema = issueReportListResponseSchema
export const issueReportCreateResponseSchema = issueReportListResponseSchema
export const issueReportUpdateResponseSchema = issueReportListResponseSchema

export const issueReportApiContract = {
  query: {
    list: issueReportListQuerySchema,
  },
  request: {
    create: issueReportCreateSchema,
    update: issueReportUpdateSchema,
  },
  response: {
    list: issueReportListResponseSchema,
    detail: issueReportDetailResponseSchema,
    create: issueReportCreateResponseSchema,
    update: issueReportUpdateResponseSchema,
  },
} satisfies ModuleApiContract
```

`sortOrder: 'desc'` on a `'YYYY-MM-DD HH:mm:ss'` text column is chronological, because that format sorts lexicographically.

## 5. `server/modules/issue-reports/issue-report.module.ts`

One file: field map, wrapper repository, service, routes.

```ts
import { z } from 'zod'
import { issueReportApiContract } from '../../../contracts/issue-reports/issue-report-api.schema.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getIssueReportsRepository } from '../../sheets/IssueReports/IssueReports.repository.js'
import { issueReportsRowSchema } from '../../sheets/IssueReports/IssueReports.db-contract.js'
import { generateShortId } from '../../shared/utils/id.js'

type IssueReportDbRow = z.infer<typeof issueReportsRowSchema>

export const issueReportFieldMap = {
  IssueReportID: 'issueReportId',
  Title: 'title',
  Description: 'description',
  Status: 'status',
  ScreenshotUrl: 'screenshotUrl',
  CreatedAt: 'createdAt',
  CreatedBy: 'createdBy',
  UpdatedAt: 'updatedAt',
  UpdatedBy: 'updatedBy',
} as const satisfies Record<keyof IssueReportDbRow & string, string>

export const searchFields = ['issueReportId', 'title', 'description', 'createdBy'] as const

type IssueReportApiRow = ApiRowFromFieldMap<IssueReportDbRow, typeof issueReportFieldMap>
type IssueReportListQuery = z.infer<typeof issueReportApiContract.query.list>
type IssueReportCreate = z.infer<typeof issueReportApiContract.request.create>
type IssueReportUpdate = z.infer<typeof issueReportApiContract.request.update>
type IssueReportListResponse = z.infer<typeof issueReportApiContract.response.list>
type IssueReportDetailResponse = z.infer<typeof issueReportApiContract.response.detail>
type IssueReportCreateResponse = z.infer<typeof issueReportApiContract.response.create>
type IssueReportUpdateResponse = z.infer<typeof issueReportApiContract.response.update>

type IssueReportService = BaseCrudService<
  IssueReportApiRow,
  IssueReportListQuery,
  IssueReportCreate,
  IssueReportUpdate,
  IssueReportListResponse,
  IssueReportDetailResponse,
  IssueReportCreateResponse,
  IssueReportUpdateResponse,
  IssueReportDbRow,
  typeof issueReportFieldMap
>

/** 'ISS-' + 8 lowercase hex. Duplicate keys are rejected by append before any write. */
export function createIssueReportId(): string {
  return `ISS-${generateShortId()}`
}

// Server-owned columns are filled here, not in the request schema: the client
// never picks an id and never picks the initial status.
const issueReportRepository: SheetRepositoryContract<IssueReportDbRow> = {
  read: (query) => getIssueReportsRepository().read(query),
  append: (row) =>
    getIssueReportsRepository().append({
      ...row,
      IssueReportID: createIssueReportId(),
      Status: 'OPEN',
    }),
  batchAppend: (rows) => getIssueReportsRepository().batchAppend(rows),
  update: (keyValue, patch) => getIssueReportsRepository().update(keyValue, patch),
  delete: (keyValue, deletedBy) => getIssueReportsRepository().delete(keyValue, deletedBy),
}

export const issueReportService: IssueReportService = new BaseCrudService({
  repository: issueReportRepository,
  api: issueReportApiContract,
  searchFields,
  fieldMap: issueReportFieldMap,
})

export const issueReportRoutes = createCrudRoutes(issueReportService, issueReportApiContract)
```

`CreatedAt` is deliberately **not** set in `append` — leaving it `undefined` is what makes the repository's `audit.onAppend` stamp fire.

## 6. `server/api/route-registry.ts`

Add, keeping the literal-string import (Vercel's file tracer reads it statically):

```ts
  'issue-reports': (): ReturnType<RouteLoader> =>
    import('../modules/issue-reports/issue-report.module.js').then((module) => module.issueReportRoutes),
```

Resulting endpoints: `GET|POST /api/issue-reports`, `GET|PATCH /api/issue-reports/:id`.

## 7. Environment

- `.env.example` — add:
  ```
  # IssueReports workbook id, used by the IssueReports sheet contract.
  ISSUE_REPORTS_SPREADSHEET_ID=
  ```
- `.env.local` — add the real id.
- Vercel **Production and Preview** — add the real id.
- Writes also need `GOOGLE_SERVICE_ACCOUNT_KEY` (already present) and the service account must have **Editor** on the new workbook.

---

## 8. Tests

### Existing files that need an entry

`tests/server/unit/sheets/sheet-binding.dry-test.ts`
- import `issueReportsDbContract`
- `expectedSheetCount`: `14` → `15`
- add `'IssueReports'` to `expectedSheetDirectories` (both sides are `.sort()`ed, so position is free)
- add:
  ```ts
  { name: 'IssueReports', contract: issueReportsDbContract,
    expectedSpreadsheetId: 'ISSUE_REPORTS_SPREADSHEET_ID', expectedSheetName: 'IssueReports' },
  ```

`tests/server/unit/sheets/column-order.dry-test.ts`
- import the contract, add:
  ```ts
  { name: 'IssueReports', contract: issueReportsDbContract,
    expected: { IssueReportID: 'A', Title: 'B', Description: 'C', Status: 'D', ScreenshotUrl: 'E',
                CreatedAt: 'F', CreatedBy: 'G', UpdatedAt: 'H', UpdatedBy: 'I' },
    primaryKeyColumn: 'A' },
  ```

`tests/server/unit/sheets/repository-getters.dry-test.ts`
- add `'ISSUE_REPORTS_SPREADSHEET_ID'` to `environmentKeys`
- add `import('../../../../server/sheets/IssueReports/IssueReports.repository.js')` to the `Promise.all` and destructure `issueReportsModule`
- add `process.env.ISSUE_REPORTS_SPREADSHEET_ID = 'issue-reports-spreadsheet-id'`
- add `['IssueReports', issueReportsModule.getIssueReportsRepository]` to `getters`

`tests/server/unit/sheets/module-laziness.dry-test.ts`
- add `'ISSUE_REPORTS_SPREADSHEET_ID'` to `relevantEnvironmentKeys`
- add `'../../../../server/modules/issue-reports/issue-report.module.js'` to `modulePaths`
- the final `console.log('7 module laziness checks passed')` is hardcoded — change `7` → `8`

`tests/server/unit/sheets/audit-declarations.dry-test.ts`
- import the contract, add:
  ```ts
  { name: 'IssueReports', contract: issueReportsDbContract,
    expected: { onAppend: ['CreatedAt'], onUpdate: ['UpdatedAt'] } },
  ```

`tests/server/integration/sheet-column-parity.ts`
- import the contract, add to `readableSheets`:
  ```ts
  { name: 'IssueReports', sheetName: issueReportsDbContract.sheetName,
    spreadsheetIdEnv: issueReportsDbContract.spreadsheetId!, rowSchema: issueReportsDbContract.row },
  ```

`tests/server/unit/sheets/writing-workbook-binding.dry-test.ts` — **no edit**; it walks `server/sheets/*` and only forbids a writable contract bound to `PORTAL_SPREADSHEET_ID`.

`tests/server/unit/sheets/service-wiring.dry-test.ts` — **no edit**; see Decisions.

### New files

`tests/server/unit/contracts/issue-reports/issue-report-api.schema.dry-test.ts`
- `issueReportListQuerySchema.parse({})` yields `{ keyword: '', status: null, page: 1, perPage: 500, sortBy: 'createdAt', sortOrder: 'desc' }`
- create rejects empty `title` / empty `description` / missing `createdBy`
- create accepts `screenshotUrl` omitted, `null`, and a string
- create has **no** `status` key in its parsed output when one is supplied
- update rejects `{ updatedBy: 'x' }` alone (the `refine`)
- update accepts `{ status: 'RESOLVED', updatedBy: 'x' }`
- `issueReportStatusSchema.options` deep-equals `['OPEN','IN_PROGRESS','RESOLVED','CLOSED']`
- contract capability slots present: `request.create`, `request.update`, `response.detail`

`tests/server/unit/modules/issue-reports/issue-report-wiring.dry-test.ts`
Copy `tests/server/unit/modules/price-list/price-list-wiring.dry-test.ts` (mock `globalThis.fetch`, GViz body with 9 columns). Read path only — that file contains no write test:
- `issueReportFieldMap` values pinned literally, all 9 pairs (`satisfies` checks keys, not values)
- `list()` maps a GViz row to the camelCase DTO with the right column→field alignment
- `getById()` returns the detail DTO for a known id

`tests/server/unit/modules/issue-reports/issue-report-writes.dry-test.ts`
Copy `tests/server/unit/modules/price-list/price-list-writes.dry-test.ts` (Sheets header-read + append/batchUpdate fetch mocks, `GOOGLE_SERVICE_ACCOUNT_KEY` stub):
- `create()` sends `IssueReportID` matching `/^ISS-[0-9a-f]{8}$/` and `Status === 'OPEN'`
- `create()` sends a `CreatedAt` cell matching `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/` — the audit stamp runs **inside** `append`, before the HTTP body is built, so the value is present on the wire. Do not assert it is absent.
- `create()` sends an empty string for `ScreenshotUrl` when the payload omits it
- `update()` sends `UpdatedBy` from the payload, a stamped `UpdatedAt`, and no `IssueReportID` in the patch

`tests/server/unit/api/route-registry-issue-reports.dry-test.ts`
Copy `route-registry-price-list.dry-test.ts`, swapping the two regexes to `issue-reports/issue-report\.module\.js`.

`tests/web/unit/features/issue-reports/composables/use-issue-report-actor.dry-test.ts`
- `readStoredActor(fakeStorage)` returns `''` for missing / whitespace values
- `writeStoredActor` then `readStoredActor` round-trips a trimmed value

`tests/web/unit/features/issue-reports/components/issue-report-status.dry-test.ts`
- `ISSUE_REPORT_STATUS_OPTIONS.map((o) => o.value)` deep-equals `issueReportStatusSchema.options` — the tab/option keys must stay the enum values, never the labels
- `ISSUE_REPORT_TABS[0].key === 'ALL'` and no status option uses the key `'ALL'`

### Commands

```bash
npx tsx tests/server/unit/sheets/sheet-binding.dry-test.ts
npx tsx tests/server/unit/sheets/column-order.dry-test.ts
npx tsx tests/server/unit/sheets/repository-getters.dry-test.ts
npx tsx tests/server/unit/sheets/module-laziness.dry-test.ts
npx tsx tests/server/unit/sheets/audit-declarations.dry-test.ts
npx tsx tests/server/unit/sheets/writing-workbook-binding.dry-test.ts
npx tsx tests/server/unit/contracts/issue-reports/issue-report-api.schema.dry-test.ts
npx tsx tests/server/unit/modules/issue-reports/issue-report-wiring.dry-test.ts
npx tsx tests/server/unit/modules/issue-reports/issue-report-writes.dry-test.ts
npx tsx tests/server/unit/api/route-registry-issue-reports.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/issue-reports/composables/use-issue-report-actor.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/issue-reports/components/issue-report-status.dry-test.ts
npm run typecheck:api
npm run build
node --env-file=.env.local --import=tsx/esm tests/server/integration/sheet-column-parity.ts
```

The last one only runs once the sheet and the env value exist.

---

## 9. Frontend — `src/features/issue-reports/`

Template throughout: `src/features/price-list/`. Service owns `z.infer`; pages never import `@contracts/*`.

```
src/features/issue-reports/
├── routes.ts
├── services/issue-report.service.ts
├── stores/issue-report.store.ts
├── composables/use-issue-report-actor.ts
├── components/issue-report-status.ts
├── components/IssueReportCard.vue
├── components/IssueReportStatusBadge.vue
└── pages/
    ├── IssueReportListPage.vue
    ├── IssueReportFormPage.vue
    └── IssueReportDetailPage.vue
```

### `routes.ts`

```ts
import type { RouteRecordRaw } from 'vue-router'

export const issueReportRoutes: RouteRecordRaw[] = [
  { path: '/issue-reports', name: 'issue-reports',
    component: () => import('./pages/IssueReportListPage.vue') },
  { path: '/issue-reports/new', name: 'issue-report-create',
    component: () => import('./pages/IssueReportFormPage.vue'),
    meta: { parent: 'issue-reports' } },
  { path: '/issue-reports/:id', name: 'issue-report-detail',
    component: () => import('./pages/IssueReportDetailPage.vue'),
    meta: { parent: 'issue-reports' }, props: true },
]
```

No nested `children`. `meta.parent` drives the shared back button (`use-go-back.ts`).

### `services/issue-report.service.ts`

```ts
export type IssueReportDto = z.infer<typeof issueReportListResponseSchema>
export type IssueReportListQuery = z.infer<typeof issueReportListQuerySchema>
export type IssueReportCreatePayload = z.infer<typeof issueReportCreateSchema>
export type IssueReportUpdatePayload = z.infer<typeof issueReportUpdateSchema>
export type IssueReportStatus = z.infer<typeof issueReportStatusSchema>

const ISSUE_REPORTS_ENDPOINT = '/api/issue-reports'

listIssueReports(query?: Partial<IssueReportListQuery>): Promise<IssueReportDto[]>   // apiGetList, returns .items
getIssueReport(id: string): Promise<IssueReportDto>                                  // apiGet
createIssueReport(payload: IssueReportCreatePayload): Promise<IssueReportDto>        // apiPost
updateIssueReport(id, payload: IssueReportUpdatePayload): Promise<IssueReportDto>    // apiPatch
```

`apiGetList` needs `querySchema`; `apiPost`/`apiPatch` need `requestSchema` — pass the imported contract schemas.

### `stores/issue-report.store.ts`

Setup store `defineStore('issue-reports', ...)`, mirroring `price-list.store.ts`:

```
state:  items: Ref<IssueReportDto[]>, loading, error: Ref<string|null>, loaded
load()          -> once-guard + in-flight promise dedupe; listIssueReports({ perPage: 500 })
reload()        -> clears `loaded`, then load()
create(payload) -> createIssueReport, unshift into items
update(id, p)   -> updateIssueReport, replace in items by issueReportId
```

`reload()` exists because a report list gets stale while triage happens; `load()`'s once-guard would otherwise never refetch.

### `composables/use-issue-report-actor.ts`

```
STORAGE_KEY = 'issue-reports.actor'
readStoredActor(storage: Pick<Storage,'getItem'>): string        // trimmed, '' when absent
writeStoredActor(storage: Pick<Storage,'setItem'>, value): void  // trimmed
useIssueReportActor(): { actor: Ref<string>, persist(): void }   // defaults to window.localStorage
```

Pure functions take the storage so the dry-test can pass a fake. **Both** pages call `persist()` after a successful write, so a staff member who only triages also seeds the cache.

### Shared status option list — `components/issue-report-status.ts`

One feature-local source for both the tabs and the option grid; keys are the enum values, never the labels.

```ts
export const ISSUE_REPORT_STATUS_OPTIONS = [
  { value: 'OPEN', label: 'เปิด' },
  { value: 'IN_PROGRESS', label: 'กำลังแก้ไข' },
  { value: 'RESOLVED', label: 'แก้ไขแล้ว' },
  { value: 'CLOSED', label: 'ปิด' },
] as const

export const ISSUE_REPORT_TABS = [
  { key: 'ALL', label: 'ทั้งหมด' },
  ...ISSUE_REPORT_STATUS_OPTIONS.map((option) => ({ key: option.value, label: option.label })),
]
```

### Components

`IssueReportCard.vue` — `defineProps<{ report: IssueReportDto }>()`, `defineEmits<{ select: [id: string] }>()`. Renders title, truncated description, `IssueReportStatusBadge`, `createdAt`, `createdBy`.

`IssueReportStatusBadge.vue` — `defineProps<{ status: string }>()`. Prop is `string`, **not** the enum, so a legacy out-of-enum cell renders as raw text instead of breaking. Colour lookup falls back to a neutral style for an unknown value.

### Pages

Each page declares `defineOptions({ name: '<PascalCase page name>' })` — `KeepAlive` matches component names, not paths.

`IssueReportListPage.vue`
- `AppLayout` > `GenericTabs :tabs="ISSUE_REPORT_TABS" :active-key="activeKey" @select="activeKey = $event"` with `const activeKey = ref('ALL')`
- filter: `activeKey === 'ALL' ? items : items.filter((r) => r.status === activeKey)`
- `ListContainer` requires `title`, `icon`, `countLabel`; pass `title="แจ้งปัญหา"`, `icon="bug_report"`, `:count="filtered.length"`, `countLabel="รายการ"`, `:loading`, `:error`, `:empty="filtered.length === 0"`
- `onMounted(() => void store.load())`
- "แจ้งปัญหาใหม่" button → `router.push({ name: 'issue-report-create' })`
- card `@select` → `router.push({ name: 'issue-report-detail', params: { id } })`

`IssueReportFormPage.vue`
```
<FormOverlay
  :open="true"
  title="แจ้งปัญหา"
  submit-label="ส่ง"
  :is-submitting="submitting"
  :is-submit-disabled="!canSubmit"
  @close="goBack"
  @submit="submit"
>
  <FormInput    id="issue-report-title"       v-model="form.title"         label="หัวข้อ" />
  <FormTextarea id="issue-report-description" v-model="form.description"   label="รายละเอียด" />
  <FormInput    id="issue-report-screenshot"  v-model="form.screenshotUrl" label="ลิงก์ภาพหน้าจอ (ถ้ามี)" placeholder="วางลิงก์" />
  <FormInput    id="issue-report-actor"       v-model="actor"              label="ชื่อ/รหัสพนักงาน" />
</FormOverlay>
```
- `id` and `label` are required props on both controls — never omit them
- field state is a local `reactive({ title: '', description: '', screenshotUrl: '' })` plus `actor` from the composable
- `canSubmit = !submitting && title.trim() && description.trim() && actor.trim()`
- `createPayload()` is the one place the payload is built; it trims everything and maps `screenshotUrl: '' → null` (the API rejects `''` with 422)
- on success: `persist()`, then `router.replace({ name: 'issue-reports' })` — `replace`, so Back from the list does not resurrect the form
- `@close` calls the shared `useGoBack()`

`IssueReportDetailPage.vue`
- `const props = defineProps<{ id: string }>()`
- page-owned state: `report = ref<IssueReportDto | null>(null)`, `loading = ref(false)`, `loadError = ref<string | null>(null)`, `notFound = ref(false)`, `actionError = ref<string | null>(null)`. Two error refs on purpose: a failed load has no content to show, a failed status change must keep the row on screen.
- `watch(() => props.id, () => void loadDetail(), { immediate: true })` — **not** `onMounted`. This page is `KeepAlive`-cached, so `onMounted` fires once and opening a second report would keep showing the first. Same pattern as `CustomerPackageDetailPage.vue:118`.
- `loadDetail()` — mirrors `CustomerPackageDetailPage.vue:58-73`: set `loading = true`, reset `loadError`/`notFound`/`actionError`, `await store.load()`, take `store.items.find((r) => r.issueReportId === props.id)`; if missing, `await getIssueReport(props.id)` inside a `try/catch`; `finally` clears `loading`. Never let the promise reject unhandled — the store's `error` is not set by a page-level call.
- the catch splits on status, because `apiGet` throws `ApiError` for 404 rather than returning null:
  ```ts
  catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound.value = true
    else loadError.value = err instanceof Error ? err.message : String(err)
  }
  ```
- template branches in this order: `loading` -> skeleton, `loadError` -> message, `notFound` -> "ไม่พบรายการ", `report` -> content. Nothing dereferences `report.` outside the last branch. `actionError` is **not** a branch: it renders as an inline banner inside the content branch, above the option grid.
- content renders all nine fields plus `IssueReportStatusBadge :status="report.status"`
- `const actorReady = computed(() => actor.value.trim().length > 0)`
- `const statusOptions = computed(() => ISSUE_REPORT_STATUS_OPTIONS.map((option) => ({ ...option, disabled: !actorReady.value })))` — `FormOptionGrid` has **no** grid-level `disabled` prop; per-option `disabled` is the only mechanism it supports.
- status change: `FormOptionGrid label="สถานะ" variant="compact" :model-value="report.status" :options="statusOptions" @update:model-value="changeStatus"`
- `changeStatus(next)`: return immediately if `!actorReady.value`; otherwise clear `actionError`, then `report.value = await store.update(props.id, { status: next, updatedBy: actor.value.trim() })` and `persist()`. Assigning the returned DTO back to `report` is what refreshes the screen. A `catch` sets `actionError` only — never `loadError`, or a failed status change would blank the row it was changing.
- while `actor` is blank: render `<FormInput id="issue-report-detail-actor" v-model="actor" label="ชื่อ/รหัสพนักงาน" />` above the grid (`label` is a required prop)

### Application-level registration (3 edits, all required)

1. `src/router/index.js` — `import { issueReportRoutes } from '@/features/issue-reports/routes'` and spread `...issueReportRoutes` into `routes`.
2. `src/App.vue` — add `'IssueReportFormPage'` to the `KeepAlive` `:exclude` array. Non-negotiable: the form holds component-local refs, and a cached page would carry one staff member's half-typed report into the next.
3. `src/shared/components/NavSidebar.vue` — one new `<li>`, copying an existing item verbatim: same `<button>` classes, `:class="route.path.startsWith('/issue-reports') ? 'text-primary font-semibold' : ''"`, `@click="navigate('/issue-reports')"`, `<span class="material-symbols-outlined">bug_report</span>`, `<span>แจ้งปัญหา</span>`. Nothing else in that file changes.

Do **not** touch `SEARCHABLE_ROUTES` in `AppHeader.vue`; there is no header search for this feature.

---

## 10. Shared gaps (report, do not fix here)

- No badge/chip/pill component in `src/shared/components/` — `IssueReportStatusBadge.vue` is built feature-locally.
- `NavSidebar.vue` hardcodes its menu instead of taking an items prop or reading a nav registry; every new feature must edit a shared file to become reachable.
- `AppHeader.vue` hardcodes `SEARCHABLE_ROUTES`, so search cannot be opted into without editing a shared component.
- `FormInput.vue` / `FormTextarea.vue` / `FormOptionGrid.vue` are untyped runtime `defineProps` with no `lang="ts"`; `FormOptionGrid`'s `options` is a bare `Array`. There is no frontend type-check, so misuse ships green.

Current `src/shared/components/`: `AppHeader.vue`, `BaseSwipeCard.vue`, `CardLeadingIcon.vue`, `FormInput.vue`, `FormLabel.vue`, `FormOptionGrid.vue`, `FormSwitch.vue`, `FormTextarea.vue`, `GenericTabs.vue`, `ListContainer.vue`, `NavSidebar.vue`.
Current `src/shared/layouts/`: `AppLayout.vue`, `BaseFullOverlay.vue`, `BaseOverlay.vue`, `BaseSlideOverlay.vue`, `FormLayout.vue`, `FormOverlay.vue`, `use-page-scroll-lock.ts`.

---

## 11. Edge cases

**create**
- blank `title` / `description` after trim -> 422 `VALIDATION_ERROR`
- `screenshotUrl` omitted or `null` -> blank cell
- `screenshotUrl: ''` -> 422 (`.trim().min(1)`); the form normalizes `'' -> null` before sending
- `createdBy` missing -> 422; never silently `'admin'`
- client sends `status` -> not in the schema, stripped; row is written `OPEN`
- duplicate `IssueReportID` -> `DuplicatePrimaryKeyError`, nothing written, reaches the client as 500 `INTERNAL_ERROR`; no auto-retry
- append committed but the echoed row is unparseable -> `append` re-reads the sheet for that PK; found -> 201 with the prepared row, not found -> `WriteCommittedUnreadableError` reaches the client as 500, **no retry**, UI shows a generic failure and the staff member refreshes the list to check

**update**
- `{ updatedBy }` only -> 422 from the `refine`
- unknown `id` -> 404 from the repository read-back
- `status` set to its current value -> allowed, `UpdatedAt` still stamped
- `screenshotUrl: null` -> cell cleared to `''`
- caller supplies `updatedAt` / `createdBy` -> not in the schema, stripped; audit owns `UpdatedAt`

**list / get**
- empty sheet -> `items: []`, page 1
- legacy row with a `Status` cell outside the enum -> reads are not runtime-validated, value passes through; `IssueReportStatusBadge` takes a `string` and renders it raw
- `perPage > 500` -> 422 from the query schema

**frontend**
- store `load()` already loaded -> no refetch; use `reload()` after a write from another page
- deep link to `/issue-reports/:id` on a cold app -> detail page falls back to `getIssueReport(id)`
- `actor` blank on the detail page -> option grid disabled, staff input shown
- second report opened from a cached detail page -> handled by `watch(props.id, ..., { immediate: true })`
- `ApiError` from a store call -> store `error` set, page renders it; from a page-level `getIssueReport` -> the page's own `loadError` / `notFound`, never unhandled; no retry loop either way

---

## 12. Out of scope

- Delete / soft delete (`writes.delete` stays `false`)
- Screenshot **upload** (only a pasted link is stored)
- Severity, page/feature tag, resolution notes, assignee, comments
- Notifications, email, LINE alerts
- Authentication and real actor identity
- Header search for issue reports
- A shared badge component or a data-driven `NavSidebar`
- Python-side (`scripts/`) integration

---

## 13. Blockers before implementation

1. Human creates the Google Sheet with tab name `IssueReports` and exactly these 9 columns in this order — `IssueReportID, Title, Description, Status, ScreenshotUrl, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy` — with `CreatedAt` and `UpdatedAt` formatted as **Plain Text**, and grants the service account **Editor**.
2. Human fills the real id into the `IssueReport.json` draft above (replacing `<PENDING_SPREADSHEET_ID>`) and saves it to `G:\My Drive\Magicwash\Database\GoogleSheets\IssueReport.json`. No agent writes to that path.
3. Human adds `ISSUE_REPORTS_SPREADSHEET_ID` with that id to `.env.local` and to Vercel **Production** and **Preview**.

Sections 2–9 are executable now; only `sheet-column-parity.ts` and any live request wait on the three items above.

## Status

FINAL
