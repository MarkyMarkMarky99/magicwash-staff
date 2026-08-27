import assert from 'node:assert/strict'
import { z } from 'zod'
import { packagesDbContract, packagesRowSchema } from '../../../../server/sheets/Packages/Packages.db-contract.js'
import { buildSheetHeaderMap } from '../../../../server/shared/repositories/sheet-header-map.js'
import { SheetRepository } from '../../../../server/shared/repositories/sheet.repository.js'
import {
  SheetsApiClient,
  type SheetsApiAppendResponse,
  type SheetsApiValueRange,
} from '../../../../server/shared/repositories/sheets-api.client.js'
import { formatBangkokTimestamp } from '../../../../server/shared/utils/bangkok-timestamp.js'

type PackagesRow = z.infer<typeof packagesRowSchema>
type Cell = string | number | boolean | null

const headers = [
  'package_code',
  'name',
  'eligible_service',
  'included_credit',
  'price',
  'notes',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'deleted_at',
  'deleted_by',
]
const headerMap = buildSheetHeaderMap(headers, Object.keys(packagesRowSchema.shape), 'package_code')
const fixedNow = new Date('2026-08-27T05:00:00.000Z')
const fixedTimestamp = formatBangkokTimestamp(fixedNow)

type AppendCall = { kind: 'append'; values: readonly (readonly unknown[])[] }
type UpdateCall = { kind: 'update'; ranges: readonly SheetsApiValueRange[] }
type Call = AppendCall | UpdateCall

function repository(config: {
  calls: Call[]
  existingKeys?: string[][]
  readRange?: Cell[][]
}): SheetRepository<PackagesRow> {
  const client = new SheetsApiClient({
    spreadsheetId: 'packages-test-spreadsheet',
    sheetName: 'Packages',
    fetchImpl: async () => {
      throw new Error('unexpected Sheets API fetch')
    },
    accessTokenProvider: async () => 'test-token',
  })
  client.readColumn = async () => config.existingKeys ?? [['package_code']]
  client.appendRows = async (values): Promise<SheetsApiAppendResponse> => {
    config.calls.push({ kind: 'append', values })
    return {
      spreadsheetId: 'packages-test-spreadsheet',
      updates: { updatedRows: values.length, updatedData: { values } },
    }
  }
  client.updateCells = async (ranges) => {
    config.calls.push({ kind: 'update', ranges })
    return { spreadsheetId: 'packages-test-spreadsheet', responses: ranges.map(() => ({})) }
  }
  client.readRange = async () => config.readRange ?? []

  return new SheetRepository<PackagesRow>({
    contract: packagesDbContract,
    sheetsApiClient: client,
    sheetHeaderMapLoader: { load: async () => headerMap },
    now: () => fixedNow,
  })
}

function appendCall(calls: Call[]): AppendCall {
  const call = calls.find((current): current is AppendCall => current.kind === 'append')
  assert.ok(call)
  return call
}

function updateCall(calls: Call[]): UpdateCall {
  const call = calls.find((current): current is UpdateCall => current.kind === 'update')
  assert.ok(call)
  return call
}

const appendCalls: Call[] = []
const appended = await repository({ calls: appendCalls }).append({
  package_code: 'PKG-10',
  name: 'Ten credits',
  eligible_service: 'wash_iron',
  included_credit: 10,
  price: 100,
  created_by: 'staff-1',
})

assert.deepEqual(appendCall(appendCalls).values, [[
  'PKG-10',
  'Ten credits',
  'wash_iron',
  10,
  100,
  '',
  fixedTimestamp,
  'staff-1',
  '',
  '',
  '',
  '',
]])
assert.equal(appended.created_at, fixedTimestamp)
assert.equal(appended.updated_at, '')

for (const value of ['2026-08-27T12:00:00.000Z', '2026-8-27 12:00:00']) {
  const calls: Call[] = []
  await assert.rejects(
    () => repository({ calls }).append({ package_code: `BAD-${value}`, created_at: value }),
    (error: unknown) => error instanceof Error && error.name === 'WriteRejectedError',
  )
  assert.equal(calls.some((call) => call.kind === 'append'), false)
}

const updateCalls: Call[] = []
const updated = await repository({
  calls: updateCalls,
  existingKeys: [['package_code'], ['PKG-10']],
  readRange: [[
    'PKG-10',
    'Updated name',
    'wash_iron',
    10,
    100,
    '',
    '2026-08-26 12:00:00',
    'staff-1',
    fixedTimestamp,
    '',
    '',
    '',
  ]],
}).update('PKG-10', { name: 'Updated name' })

const ranges = updateCall(updateCalls).ranges
assert.equal(ranges.some((range) => range.range.includes('B2')), true)
assert.equal(ranges.some((range) => range.range.includes('I2')), true)
assert.equal(ranges.some((range) => range.range.includes('G2')), false)
assert.equal(ranges.find((range) => range.range.includes('I2'))?.values[0]?.[0], fixedTimestamp)
assert.equal(updated.created_at, '2026-08-26 12:00:00')
assert.equal(updated.updated_at, fixedTimestamp)

const invalidUpdateCalls: Call[] = []
await assert.rejects(
  () => repository({ calls: invalidUpdateCalls, existingKeys: [['package_code'], ['PKG-10']] }).update(
    'PKG-10',
    { updated_at: '2026-08-27T12:00:00.000Z' },
  ),
  (error: unknown) => error instanceof Error && error.name === 'WriteRejectedError',
)
assert.equal(invalidUpdateCalls.some((call) => call.kind === 'update'), false)

console.log('packages repository audit dry test passed')
