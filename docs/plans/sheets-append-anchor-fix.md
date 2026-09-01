# Sheets append anchor fix

> **⚠️ THIS PLAN'S DIAGNOSIS IS WRONG — read `NEXT-SESSION.md` first.**
> It blames a sheet-name-only append range and an untrimmed sheet grid. Both were disproven on
> 2026-09-02 by reproducing the call: with an explicit `OrderForm!A:U` range and a grid already
> trimmed to 21 columns, the row still landed at column O. The real cause is that columns I–N are
> empty on every row, so Google's table detection splits the sheet into an `A–H` and an `O–U`
> table and appends to the latter (`tableRange: "OrderForm!O7924:U8250"`).
> **The real fix shipped on 2026-09-02: the append search window is the literal `A:A`.** Narrow
> enough that column A is the only table in the window, so the row anchors at A. Verified end to
> end (`updatedRange: OrderForm!A8255:U8255`). See `NEXT-SESSION.md` for the measurements and the
> rejected alternatives.
> The landed-range assertion this plan introduced is what proved the real cause and is worth
> keeping — but do not re-derive anything from the reasoning below. The test lists and
> blast-radius notes remain accurate.

## Scope

`values:append` must target an explicit A1 column span instead of the bare sheet name, must assert
where Google says the row landed, and must stop reading the whole primary-key column before every
append. Files: `server/shared/repositories/sheets-api.client.ts`,
`server/shared/repositories/sheet.repository.ts`, their `tests/server/` dry-tests, `NEXT-SESSION.md`.
Blast radius: every append and update of all 17 sheets (Appointments, CustomerPackages,
CustomerPackageView, Customers, InvoiceItems, Invoices, InvoicesView, IssueReports, LaundryPhotos,
OrderForm, OrderImages, OrderItemForms, OrdersView, Packages, PackageTransactions, Payments,
PriceList).

## Functions

### `server/shared/repositories/sheets-api.client.ts`

```
columnLetterForWidth(width: number) -> string            private, module-level, new
 L if !Number.isInteger(width) || width < 1
    L throw WriteRejectedError('appendRows', `Cannot build an append range for column width ${String(width)}.`)
 L convert (width - 1) zero-based index -> letters        # same algorithm as columnLetterForIndex in sheet-header-map.ts
 L return letters
```

```
appendColumnSpan(width: number) -> string                private, module-level, new
 L return `A:${columnLetterForWidth(width)}`
```

```
parseLandedColumns(updatedRange: string) -> { start: string, end: string } | null   private, module-level, new
 L a1 = updatedRange.slice(updatedRange.lastIndexOf('!') + 1)   # sheet part discarded, quoted names included
 L match = /^([A-Z]+)\d+(?::([A-Z]+)\d+)?$/.exec(a1)
 L if match === null
    L return null
 L return { start: match[1]!, end: match[2] ?? match[1]! }       # single-cell form A2 means start === end
```

Insert all three verbatim, immediately after the existing `restoreTrailingBlanks` function (anchor:
the line `const SHEETS_API_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'` stays first in
the file; place the new helpers between `restoreTrailingBlanks`'s closing `}` and
`function buildUrl(`):

```ts
function columnLetterForWidth(width: number): string {
  if (!Number.isInteger(width) || width < 1) {
    throw new WriteRejectedError(
      'appendRows',
      `Cannot build an append range for column width ${String(width)}.`,
    )
  }

  let value = width
  let letter = ''
  while (value > 0) {
    value -= 1
    letter = String.fromCharCode(65 + (value % 26)) + letter
    value = Math.floor(value / 26)
  }
  return letter
}

function appendColumnSpan(width: number): string {
  return `A:${columnLetterForWidth(width)}`
}

function parseLandedColumns(
  updatedRange: string,
): { readonly start: string; readonly end: string } | null {
  const a1 = updatedRange.slice(updatedRange.lastIndexOf('!') + 1)
  const match = /^([A-Z]+)\d+(?::([A-Z]+)\d+)?$/.exec(a1)
  if (match === null) {
    return null
  }
  return { start: match[1]!, end: match[2] ?? match[1]! }
}
```

```
class WriteMisalignedAppendError extends WriteFailure    exported, new
 L constructor(operation: string, message: string)
    L super(operation, 'unknown', message)               # NOT a WriteCommittedUnreadableError subclass
```

Insert verbatim between the `WriteCommittedUnreadableError` class and the
`DuplicatePrimaryKeyError` class:

```ts
export class WriteMisalignedAppendError extends WriteFailure {
  constructor(operation: string, message: string) {
    super(operation, 'unknown', message)
  }
}
```

```
appendRows(rows, valueInputOption, knownWidth?) -> Promise<SheetsApiAppendResponse>   signature UNCHANGED
 L existing empty-rows / isSheetsApiValues guards           unchanged
 L option = requireValueInputOption(valueInputOption)       unchanged
 L requestedWidth = Math.max(...rows.map((row) => row.length))   unchanged
 L if knownWidth !== undefined and (!Number.isInteger(knownWidth) || knownWidth < 1)
    L throw WriteRejectedError('appendRows', `Cannot build an append range for column width ${String(knownWidth)}.`)
 L responseWidth = knownWidth === undefined ? requestedWidth : Math.max(requestedWidth, knownWidth)   unchanged for valid knownWidth
 L body = requestJson('appendRows', 'POST', buildUrl(spreadsheetId, `${encodeRange(this.sheetName, appendColumnSpan(responseWidth))}:append`, {...unchanged query}), {...unchanged body}, true)
 L existing updates / updatedRows / returnedValues guards   unchanged, still throw WriteCommittedUnreadableError first
 L landedRange = isRecord(updates) && typeof updates.updatedRange === 'string' ? updates.updatedRange : undefined
 L landed = landedRange === undefined ? null : parseLandedColumns(landedRange)
 L expectedEnd = columnLetterForWidth(requestedWidth)       # requestedWidth, not responseWidth
 L if landed === null
    L throw WriteMisalignedAppendError('appendRows', `The append committed but Google did not report a readable updatedRange (${String(landedRange)}); the row's location is unverified. Do not retry.`)
 L if landed.start !== 'A' || landed.end !== expectedEnd
    L throw WriteMisalignedAppendError('appendRows', `The append committed at ${landedRange} instead of columns A:${expectedEnd}; the row was written to the wrong columns. Do not retry: remove the misplaced row manually.`)
 L normalizedValues = restoreTrailingBlanks(returnedValues, responseWidth)   unchanged
 L return { spreadsheetId, tableRange, updates: { updatedRows, updatedData: { values: normalizedValues } } }   unchanged
```

Edit anchors in `appendRows`, verbatim strings to replace:

- replace `buildUrl(this.spreadsheetId, \`${encodeSheetName(this.sheetName)}:append\`, {`
  with `buildUrl(this.spreadsheetId, \`${encodeRange(this.sheetName, appendColumnSpan(responseWidth))}:append\`, {`
- replace the three-line comment starting `// The header map lives in SheetRepository, which resolves ranges before calling`
  with:
  ```ts
      // Google's values:append detects the table from the supplied range and anchors
      // the new row at that range's first column. A sheet-name-only range lets it
      // guess, and a sheet whose grid is wider than its headers gets the row written
      // at the wrong column. The span is derived from the caller's width; the client
      // still knows nothing about SheetHeaderMap.
  ```
- insert the landed-range block immediately after the closing `}` of the
  `throw new WriteCommittedUnreadableError('appendRows')` guard and before the comment line
  `// A subset-column append can be narrower than the physical sheet. The caller`

- `SheetsApiAppendResponse` type: UNCHANGED. `updatedRange` is consumed inside the client only and
  never surfaced. `tableRange` stays declared, assigned, unread.

### `server/shared/repositories/sheet.repository.ts`

```
appendThroughSheetsApi(row)                                edit
 L delete the line `    await this.validateKeys(client, headerMap, [prepared.row])`
 L everything else unchanged                               # including the post-append parseRowValues + verifyRowIdentity block
```

```
validateKeys(client, headerMap, preparedRows)              DELETE the whole private method
```

```
validateBatchKeys(preparedRows: Array<Record<string, SheetsApiValue>>) -> Promise<void>   rewritten, params reduced
 L keyValues = preparedRows.map((row) => String(row[this.contract.primaryKey] ?? '').trim()).filter((value) => value !== '')
 L if keyValues.length === 0
    L return
 L uniqueKeyValues = new Set<string>()
 L for keyValue of keyValues
    L if uniqueKeyValues.has(keyValue)
       L throw DuplicatePrimaryKeyError('APPEND', this.contract.primaryKey, keyValue)
    L uniqueKeyValues.add(keyValue)
```

Replace the whole existing `validateBatchKeys` body with exactly:

```ts
  /**
   * In-batch duplicate keys only. The remote primary-key column read was removed:
   * it pulled the entire key column on every append and grew with the table, to
   * catch a randomUUID().slice(0, 8) collision at roughly 2-in-a-million odds.
   * Cross-row uniqueness inside one payload costs nothing and stays.
   */
  private async validateBatchKeys(
    preparedRows: Array<Record<string, SheetsApiValue>>,
  ): Promise<void> {
    const keyValues = preparedRows
      .map((row) => String(row[this.contract.primaryKey] ?? '').trim())
      .filter((value) => value !== '')
    if (keyValues.length === 0) {
      return
    }

    const uniqueKeyValues = new Set<string>()
    for (const keyValue of keyValues) {
      if (uniqueKeyValues.has(keyValue)) {
        throw new DuplicatePrimaryKeyError('APPEND', this.contract.primaryKey, keyValue)
      }
      uniqueKeyValues.add(keyValue)
    }
  }
```

```
batchAppendThroughSheetsApi(rows)                          edit
 L replace `    await this.validateBatchKeys(client, headerMap, sentRows)` with `    await this.validateBatchKeys(sentRows)`
 L everything else unchanged
```

```
imports                                                    edit
 L LEAVE the `import { DuplicateRowKeyError, findRowNumberByKey } from './sheet-row-lookup.js'` line UNCHANGED
    L `DuplicateRowKeyError` is still constructed at `sheet.repository.ts:422` in the UPDATE row-lookup path, which this plan does not touch. Removing it from the import breaks the build.
 L keep DuplicatePrimaryKeyError, WriteRejectedError, WriteCommittedUnreadableError, WriteTransportError imports
 L do NOT import WriteMisalignedAppendError here          # the append recovery path must not catch it
```

```
appendThroughSheetsApi catch block                          UNCHANGED
 L `error instanceof WriteTransportError || error instanceof WriteCommittedUnreadableError` stays exactly as written
 L WriteMisalignedAppendError is neither, so verifyAppendedRow never runs for a misplaced row
```

### Duplicate-key guarantees after this change

```
still guarded
 L two identical keys inside one batchAppend payload -> DuplicatePrimaryKeyError, no write
 L an UPDATE targeting a key that appears twice in the sheet -> DuplicateRowKeyError via findRowNumberByKey (untouched)
 L a contract column missing from sheet row 1 -> SheetHeaderMapError from buildSheetHeaderMap -> WriteRejectedError
no longer guarded
 L a newly generated key that already exists in the sheet -> written, no error
 L a key column holding pre-existing duplicate rows -> not detected at append time
```

### `tests/server/unit/shared/repositories/sheets-api.client.dry-test.ts`

```
edit URL assertions                                        # exact replacement per test, by test name
 L 'appendRows sends the required append query and body'            -> '/values/Orders!A:B:append'
 L 'appendRows does not cap the request at 26 columns'              -> '/values/Orders!A:AA:append'
 L 'HTTP 400/403/404/409 is a rejected write' (all 4)               -> '/values/Orders!A:A:append'
 L 'HTTP 500/503 is an unknown transport result' (both)             -> '/values/Orders!A:A:append'
 L 'network failure is an unknown transport result'                 -> '/values/Orders!A:A:append'
 L 'timeout is an unknown transport result and uses the 15 second signal' -> '/values/Orders!A:A:append'
 L 'a successful append without updates is committed but unreadable'      -> '/values/Orders!A:A:append'
 L 'a successful append with the wrong row count is committed but unreadable' -> '/values/Orders!A:A:append'
 L 'append restores trailing blank cells as null'                   -> '/values/Orders!A:B:append'
 L 'append uses known header width when restoring trailing blank cells' -> '/values/Orders!A:D:append'
```

```
edit success fixtures                                      # add updatedRange inside updates
 L 'appendRows sends the required append query and body'            -> updatedRange: 'Orders!A2:B2'
 L 'appendRows does not cap the request at 26 columns'              -> updatedRange: 'Orders!A2:AA2'
 L 'append restores trailing blank cells as null'                   -> updatedRange: 'Orders!A2:B2'
 L 'append uses known header width when restoring trailing blank cells' -> updatedRange: 'Orders!A2:A2'
 L do NOT add updatedRange to the two committed-but-unreadable fixtures   # they must keep failing on the earlier guard
```

```
new test 'appendRows derives the append span from the known header width'
 L responder returns 200 { spreadsheetId, updates: { updatedRows: 1, updatedRange: 'Orders!A2:B2', updatedData: { values: [['order-1', 'Ready']] } } }
 L await client.appendRows([['order-1', 'Ready']], 'USER_ENTERED', 21)
 L assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders!A:U:append')
```

```
new test 'an append that lands outside column A is rejected as misaligned'
 L responder returns 200 { spreadsheetId, updates: { updatedRows: 1, updatedRange: 'Orders!O7981:P7981', updatedData: { values: [['order-1', 'Ready']] } } }
 L expectFailure(client.appendRows([['order-1', 'Ready']], 'USER_ENTERED', 2), module.WriteMisalignedAppendError, 'unknown')
 L assert the message matches /O7981:P7981/
```

```
new test 'an append that lands narrower than the sent row is rejected as misaligned'
 L responder returns updatedRange: 'Orders!A2:A2' with updatedData.values [['order-1', 'Ready']]
 L expectFailure(..., module.WriteMisalignedAppendError, 'unknown')
```

```
new test 'an append with no updatedRange is rejected as misaligned'
 L responder returns 200 { spreadsheetId, updates: { updatedRows: 1, updatedData: { values: [['order-1', 'Ready']] } } }
 L expectFailure(..., module.WriteMisalignedAppendError, 'unknown')
```

```
edit 'all public write failure classes expose their certainty'
 L add `const misaligned = new module.WriteMisalignedAppendError('appendRows', 'landed at O1:P1')`
 L assert misaligned.certainty === 'unknown'
```

### `tests/server/unit/shared/repositories/sheet.repository.sheets-api-append.dry-test.ts`

```
edit appendResponse helper                                 # sheet part is ignored by the assertion
 L add `updatedRange: 'AppendSheet!A2:D2',` inside the `updates` object, next to `updatedRows: 1,`
```

```
delete test 'Sheets API append looks up the primary key before writing'
 L delete the whole test(...) call including its trailing `})`
 L keep the `lookupResponse` helper and every `if (init?.method === 'GET') return lookupResponse()` branch   # header-row GET still uses them
```

```
edit stale comment in 'a contract without a transport declaration appends through the Sheets API'
 L replace the two comment lines starting `      // Today: one POST call. After the duplicate-key guard lands: one` with `      // One POST call: the duplicate-key lookup GET is gone and this repository`
   `      // injects its header map, so nothing reads before the write.`
 L keep `assert.ok(calls.length === 1 || calls.length === 2)` unchanged
```

```
MUST PASS UNTOUCHED
 L 'Sheets API append sends a full-width row with middle blanks preserved'   # values: [['append-2', 'before', '', 'after']]
 L 'a contract without a transport declaration appends through the Sheets API'   # values: [['append-7', '', '', '']]
 L 'append returns the sent full-width row instead of the echoed row'
 L 'an append echo with a different primary key is rejected'
```

### `tests/server/unit/shared/repositories/sheet.repository.sheets-api-batch-append.dry-test.ts`

```
edit appendResponse helper
 L add `updatedRange: 'BatchAppendSheet!A2:D4',` inside the `updates` object
 L row numbers are not asserted; only the column letters are
```

```
edit call-count assertions                                 # this file injects sheetHeaderMapLoader, so its only GET was the key lookup
 L both occurrences of `assert.deepEqual(calls.map((call) => call.init?.method), ['GET', 'POST'])` -> `assert.deepEqual(calls.map((call) => call.init?.method), ['POST'])`
 L both occurrences of `assert.equal(calls.length, 2)` -> `assert.equal(calls.length, 1)`
 L in 'Sheets API batchAppend issues exactly one appendRows request with all rows' and 'a contract without a transport declaration batchAppends through the Sheets API'
```

```
MUST PASS UNTOUCHED
 L 'every batch row is full header width with blanks at omitted middle columns'
 L the `assert.equal(calls.length, 0)` in the conflicting-valueInput test
```

### `tests/server/unit/shared/repositories/sheet.repository.sheets-api-append-duplicate-key.dry-test.ts`

```
delete whole test blocks, by exact name
 L 'an existing primary key rejects the append before any write happens'
 L 'a header map missing the primary key column converts to a rejected write, mirroring UPDATE'
 L 'a duplicated existing key in corrupt sheet data propagates unchanged, mirroring UPDATE'
 L 'an existing primary key rejects batchAppend before any write happens'
```

```
edit 'no existing primary key proceeds to append normally'
 L assert.equal(calls.length, 2)          -> assert.equal(calls.length, 1)
 L delete the two lines asserting calls[0] is readColumn with args ['A']
 L assert.equal(calls[1]?.method, 'appendRows')  -> assert.equal(calls[0]?.method, 'appendRows')
```

```
edit 'two matching primary keys in one batch reject before any write happens'
 L assert.deepEqual(calls, [{ method: 'readColumn', args: ['A'] }])  -> assert.deepEqual(calls, [])
```

```
MUST PASS UNTOUCHED
 L 'an empty primary key value skips the duplicate check entirely'
 L 'an empty primary key value is written by batchAppend'
```

```
cleanup after the deletions
 L delete the now-unused const headerMapMissingPrimaryKeyLetter and its comment block
 L for each of DuplicateRowKeyError, WriteRejectedError, SheetHeaderMap: run `grep -c '<Symbol>' <file>`; if the only remaining occurrence is its import line, remove that symbol from the import
```

### `tests/server/unit/shared/repositories/sheet.repository.sheets-api-batch-append-preflight.dry-test.ts`

```
delete whole test blocks, by exact name
 L 'batch key validation consumes the returned key collection linearly overall as incoming keys grow'
 L 'one existing data-row match rejects with DuplicatePrimaryKeyError before append'
 L 'multiple existing matches preserve the dirty duplicate-row error'
 L 'unrelated duplicate existing keys do not reject a nonmatching batch'
 L 'header-only matches and existing numeric keys preserve current normalization semantics'
```

```
rename + edit 'a keyed batch performs one primary-key-column read, no per-key reads, and one append'
 L new name: 'a keyed batch appends once and never reads the primary-key column'
 L assert.deepEqual(calls.map((call) => call.method), ['readColumn', 'appendRows'])  -> assert.deepEqual(calls.map((call) => call.method), ['appendRows'])
 L delete assert.deepEqual(calls[0]?.args, ['A'])
 L assert.equal(calls.filter((call) => call.method === 'readColumn').length, 1)  -> assert.equal(calls.filter((call) => call.method === 'readColumn').length, 0)
 L keep the appendRows filter length 1 assertion
```

```
rename + edit 'an intra-batch duplicate reads the key column before rejecting with the existing error class'
 L new name: 'an intra-batch duplicate rejects with the existing error class before any read or write'
 L assert.deepEqual(calls, [{ method: 'readColumn', args: ['A'] }])  -> assert.deepEqual(calls, [])
 L keep the DuplicatePrimaryKeyError assertion and the appendRows assert.fail guard
```

```
edit 'a nonmatching batch appends unchanged full-width rows once after the key read'
 L new name: 'a nonmatching batch appends unchanged full-width rows once'
 L assert.deepEqual(calls.map((call) => call.method), ['readColumn', 'appendRows'])  -> assert.deepEqual(calls.map((call) => call.method), ['appendRows'])
 L keep assert.equal(valueInputOption, 'USER_ENTERED') and assert.deepEqual(rows, [['new-1', 'one'], ['new-2', 'two']])
```

```
MUST PASS UNTOUCHED
 L 'an empty batch performs zero primary-key-column reads'
 L 'a batch whose incoming keys are all blank performs zero primary-key-column reads'
```

```
cleanup after the deletions
 L apply the same grep-then-prune rule to imports and to any const only the deleted tests used
```

### `tests/server/unit/shared/repositories/sheet.repository.audit.dry-test.ts`

```
edit call-sequence assertions
 L both occurrences of `assert.deepEqual(config.calls.map((call) => call.kind), ['readColumn', 'appendRows'])` -> `assert.deepEqual(config.calls.map((call) => call.kind), ['appendRows'])`
 L in 'a duplicate key inside a batch is rejected before the single append request': `assert.equal(config.calls.filter((call) => call.kind === 'readColumn').length, 1)` -> `..., 0)`
 L keep every audit-timestamp and padded-row assertion untouched
```

### `tests/server/unit/shared/repositories/sheet.repository.sheets-api-append-certainty.dry-test.ts`

```
edit stale comment only
 L replace the comment lines starting `// The pre-write duplicate-key guard reads the primary key column before` with `// The pre-write duplicate-key column read was removed; this stub only exists`
   `// to satisfy the SheetsApiClient cast and is never called.`
 L keep the readColumn stub and every assertion untouched
```

## Corrections recorded after the initial implementation

The following corrections supersede the original fixture labels and width rule above:

- The eight files below construct the real Sheets repository/client with stubbed fetch responses;
  their successful append fixtures must include a truthful `updates.updatedRange` beginning at
  column A and ending at the width of the row that stub appends. They are not fake repositories
  and are not untouched fixtures:
  `tests/server/unit/modules/appointments/appointment.transport.dry-test.ts`,
  `tests/server/unit/modules/issue-reports/issue-report-writes.dry-test.ts`,
  `tests/server/unit/modules/packages/package.module.dry-test.ts`,
  `tests/server/unit/modules/price-list/price-list-writes.dry-test.ts`,
  `tests/server/unit/sheets/price-list.sheets-api.dry-test.ts`,
  `tests/server/unit/sheets/service-wiring.dry-test.ts`,
  `tests/server/workflows/invoices/invoice-api.workflow.dry-test.ts`, and
  `tests/server/workflows/invoices/invoice-sheets-api.workflow.dry-test.ts`.
- A provided `knownWidth` is validated before `Math.max`; `0`, negative, and fractional values
  throw `WriteRejectedError` before fetch. A valid `knownWidth` smaller than the sent-row width
  still yields the sent-row width through `Math.max`.

### Other untouched test files (verify, do not edit)

```
 L tests/server/unit/sheets/packages.repository.audit.dry-test.ts       # stubs readColumn, never asserts it was called
 L tests/server/unit/shared/repositories/sheet.repository.sheets-api-update-unchanged.dry-test.ts   # UPDATE path keeps its readColumn lookup
 L tests/server/unit/modules/** outside the eight files listed above     # no Sheets-client fixture correction required
 L tests/server/workflows/** outside the two invoice files listed above, and tests/server/modules/appointments/**
                                                                         # error-message strings only
```

### `NEXT-SESSION.md`

```
insert a new section immediately BEFORE the line `## Still open`   # that heading occurs exactly once
```

```md
## Sheets append landed in the wrong columns — fixed

- A real order on 2026-09-01 was appended 14 columns right of A on OrderForm, then broke
  `GET /api/work-orders` for everyone. `values:append` was posted with the sheet name as its range,
  so Google guessed the anchor across the 9 blank grid columns past the 21 headers. Fix, tests and
  blast radius: `docs/plans/sheets-append-anchor-fix.md`. The sheet grid was trimmed by hand
  already; the plan is what stops any sheet reaching that state again.
- The pre-append primary-key column read is gone: an already-existing generated key is no longer
  detected. In-batch duplicate keys still are.
- Post-write read-back verification with rollback is deferred to a separate round. Rollback is
  blocked first: `OrderForm.db-contract.ts` declares `writes: { append: true, update: true,
  delete: false }`, and deleting a row needs `batchUpdate` + `deleteDimension`, which takes a
  numeric sheetId rather than a sheet name — a capability this codebase does not have.
- Staleness is not the obstacle to that round: GViz reflects a newly appended row within
  milliseconds (established by direct testing on 2026-09-01).

```

### Gates

```
run, in this order, all must pass
 L npm run typecheck:api
 L for each file under tests/server/ matching *.dry-test.ts: npx tsx <path>     # no runner exists; one invocation per file
 L git diff --check
```

## Edge Cases

`appendRows`
- `knownWidth` omitted -> span derived from the widest sent row, never the bare sheet name
- `knownWidth` < widest sent row -> span uses the widest sent row (`responseWidth` is already the max)
- `knownWidth` present and wider than the sent row -> request span uses `knownWidth`, landed-range check uses the sent-row width
- width < 1 or non-integer -> `WriteRejectedError`, thrown before fetch
- width > 26 -> multi-letter span (`A:AA`), no 26-column ceiling anywhere
- sheet name with spaces/quotes -> `encodeRange` handles it, same as the existing `readColumn` path
- `updates.updatedRange` missing or unparsable -> `WriteMisalignedAppendError`, certainty `unknown`
- `updatedRange` single-cell form (`Sheet!A2`) -> treated as start === end, accepted when width is 1
- `updatedRange` starts at any column other than A -> `WriteMisalignedAppendError`
- `updatedRange` end letter != sent-row width -> `WriteMisalignedAppendError`
- `updatedRows` mismatch or unreadable values -> `WriteCommittedUnreadableError` as today, checked before the range
- misaligned append -> row stays in the sheet, no rollback, message says do not retry

`SheetRepository.appendThroughSheetsApi`
- `WriteMisalignedAppendError` -> propagates; `verifyAppendedRow` (GViz) must not run for it
- echoed values still parsed and `verifyRowIdentity` still run -> keep; Google echoes values relative to where it wrote them, so identity can never see a column shift; it checks a different dimension and is not the failure

`SheetRepository.validateBatchKeys`
- every incoming key blank -> return early, append proceeds
- empty batch -> return early
- two identical keys in one payload -> `DuplicatePrimaryKeyError`, no write
- key already present in the sheet -> written, not detected
- key column absent from sheet row 1 -> `WriteRejectedError` from the header-map load, before any of this

## Out of Scope

- `server/shared/repositories/utils/gviz-reader.ts` and `tests/server/unit/shared/repositories/utils/gviz-reader.dry-test.ts` — no edits of any kind, including its `shifted-value` fixture
- `SheetHeaderMapResolver`, `buildSheetHeaderMap`, the row-1 header read and its cache
- deriving column positions from `.db-contract.ts`
- post-write read-back verification, rollback, `deleteDimension`, `batchUpdate` row deletion
- the `updateCells` / `values:batchUpdate` path — its ranges are already explicit
- `SheetsApiAppendResponse.tableRange` — stays declared, assigned, unread
- Google Sheets grid edits, sheet sharing, column trimming
- `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`
- `src/api/photos.js` and the Apps Script write path
- frontend files, `contracts/`, retry/backoff, GViz read paths

## Status

FINAL
