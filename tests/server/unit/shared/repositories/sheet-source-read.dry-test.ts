import assert from 'node:assert/strict'
import { z } from 'zod'
import { SheetsApiClient } from '../../../../../server/shared/repositories/sheets-api.client.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { parseSheetGridValues } from '../../../../../server/shared/repositories/sheet-grid-values.js'

const string = (value: string) => ({ effectiveValue: { stringValue: value } })
const numeric = (value: number, type = 'NUMBER') => ({
  effectiveValue: { numberValue: value }, effectiveFormat: { numberFormat: { type } },
})
const grid = {
  properties: { timeZone: 'Asia/Bangkok' },
  sheets: [{ data: [{ rowData: [
    { values: [string('id'), string('date'), string('note')] },
    { values: [numeric(123), numeric(46298.5, 'DATE_TIME'), string('')] },
    {},
    { values: [string('00123'), numeric(46298, 'NUMBER')] },
    { values: [{ effectiveFormat: { numberFormat: { type: 'NUMBER' } } }] },
  ] }] }],
}
const cells = parseSheetGridValues(grid)
assert.equal(cells.length, 4, 'trim formatting-only trailing rows, preserve interior blanks')
assert.equal(cells[1]![0], 123)
assert.equal((cells[1]![1] as Date).toISOString(), '2026-10-03T05:00:00.000Z')
assert.equal(cells[3]![0], '00123')
assert.equal(cells[3]![1], 46298, 'a date-like number with numeric format remains a number')
assert.equal(cells[1]![2], '')
assert.throws(() => parseSheetGridValues({ sheets: [] }))
assert.throws(() => parseSheetGridValues({ ...grid, sheets: [{ data: [{ rowData: [{ values: [numeric(NaN)] }] }] }] }))
const millis = parseSheetGridValues({ ...grid, sheets: [{ data: [{ rowData: [{ values: [numeric(46298 + 0.123 / 86400, 'DATE_TIME')] }] }] }] })
assert.equal((millis[0]![0] as Date).toISOString(), '2026-10-02T17:00:00.123Z')

let requests = 0
const client = new SheetsApiClient({
  spreadsheetId: 'workbook', sheetName: "Source's rows", accessTokenProvider: async () => 'token',
  fetchImpl: async (input, init) => {
    requests++
    const url = new URL(String(input))
    assert.equal(init?.method, 'GET')
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer token')
    assert.equal(url.searchParams.get('ranges'), "'Source''s rows'!A1:C")
    assert.ok(url.searchParams.get('fields')?.includes('effectiveValue'))
    assert.equal(init?.body, undefined)
    return new Response(JSON.stringify(grid), { status: 200 })
  },
})
const repository = new SheetRepository({
  contract: {
    row: z.object({ id: z.string(), date: z.string(), note: z.string() }),
    primaryKey: 'id', sheetName: "Source's rows", spreadsheetId: 'SOURCE_TEST_ID',
    writes: { append: true, update: false, delete: false },
  },
  sheetsApiClient: client,
})
const first = await repository.readSourceRows()
assert.equal(first[0]!.id, 123)
assert.equal((first[0]!.date as Date).toISOString(), '2026-10-03T05:00:00.000Z')
assert.deepEqual(first[1], { id: '', date: '', note: '' })
assert.deepEqual(first[2], { id: '00123', date: 46298, note: '' })
await repository.readSourceRows()
assert.equal(requests, 2, 'source rows are fetched every time')
const wrongHeader = new SheetRepository({
  contract: { row: z.object({ renamed: z.string(), date: z.string(), note: z.string() }), primaryKey: 'renamed', sheetName: "Source's rows", spreadsheetId: 'SOURCE_TEST_ID', writes: { append: true, update: false, delete: false } },
  sheetsApiClient: client,
})
await assert.rejects(wrongHeader.readSourceRows(), /Source header mismatch/)
console.log('Authenticated source cells: mixed types, dates, milliseconds, blanks, headers, and fresh GET-only transport passed')
