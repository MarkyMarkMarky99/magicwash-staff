import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { DuplicateRowKeyError } from '../../../../../server/shared/repositories/sheet-row-lookup.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import {
  SheetsApiClient,
  WriteCommittedUnreadableError,
  WriteRejectedError,
  WriteTransportError,
  type SheetsApiValueRange,
  type SheetsApiValues,
} from '../../../../../server/shared/repositories/sheets-api.client.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const rowSchema = z.object({ ID: z.string(), Label: z.string(), UpdatedAt: z.string() })
type Row = z.infer<typeof rowSchema>
const contract = {
  row: rowSchema,
  primaryKey: 'ID',
  sheetName: 'BatchUpdates',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writes: { append: false, update: true, delete: false },
  audit: { onUpdate: ['UpdatedAt'] },
} satisfies SheetContract
const headerMap = buildSheetHeaderMap(['ID', 'Label', 'UpdatedAt'], Object.keys(rowSchema.shape), 'ID')
const changes = [
  { keyValue: 'c', patch: { Label: 'C changed' } },
  { keyValue: 'a', patch: { Label: 'A changed' } },
  { keyValue: 'b', patch: { Label: 'B changed' } },
] as const

function fixture(options: {
  column?: SheetsApiValues
  columnError?: Error
  readback?: SheetsApiValues[]
} = {}): {
  repository: SheetRepository<Row>
  calls: { columns: number; writes: number; reads: number; ranges: readonly SheetsApiValueRange[]; rowRanges: readonly string[]; options?: unknown }
} {
  const calls = { columns: 0, writes: 0, reads: 0, ranges: [] as readonly SheetsApiValueRange[], rowRanges: [] as readonly string[], options: undefined as unknown }
  const client = {
    readColumn: async (letter: string) => {
      assert.equal(letter, 'A')
      calls.columns += 1
      if (options.columnError !== undefined) {
        throw options.columnError
      }
      return options.column ?? [['ID'], ['a'], ['b'], ['c']]
    },
    updateCells: async (ranges: readonly SheetsApiValueRange[], option: string) => {
      calls.writes += 1
      calls.ranges = ranges
      assert.equal(option, 'USER_ENTERED')
      return { responses: ranges.map(() => ({})) }
    },
    readRanges: async (ranges: readonly string[], readOptions: unknown) => {
      calls.reads += 1
      calls.rowRanges = ranges
      calls.options = readOptions
      return options.readback ?? [
        [['c', 'C changed', '2026-09-24 09:00:00']],
        [['a', 'A changed', '2026-09-24 09:00:00']],
        [['b', 'B changed', '2026-09-24 09:00:00']],
      ]
    },
  } as unknown as SheetsApiClient
  return {
    repository: new SheetRepository<Row>({
      contract,
      sheetsApiClient: client,
      sheetHeaderMapLoader: { load: async () => headerMap },
      now: () => new Date('2026-09-24T02:00:00Z'),
    }),
    calls,
  }
}

async function rejectsBeforeWrite(
  name: string,
  updates: Parameters<SheetRepository<Row>['updateMany']>[0],
  options?: Parameters<typeof fixture>[0],
): Promise<void> {
  const { repository, calls } = fixture(options)
  await assert.rejects(() => repository.updateMany(updates), WriteRejectedError, name)
  assert.equal(calls.writes, 0, name)
  assert.equal(calls.reads, 0, name)
}

async function run(): Promise<void> {
  const { repository, calls } = fixture()
  const rows = await repository.updateMany(changes)
  assert.deepEqual(rows.map((row) => row.ID), ['c', 'a', 'b'])
  assert.deepEqual(rows.map((row) => row.Label), ['C changed', 'A changed', 'B changed'])
  assert.deepEqual([calls.columns, calls.writes, calls.reads], [1, 1, 1])
  assert.deepEqual(calls.rowRanges, ['A4:C4', 'A2:C2', 'A3:C3'])
  assert.deepEqual(calls.options, {
    valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  })
  assert.deepEqual(calls.ranges.map((range) => range.range), [
    'BatchUpdates!B4:B4', 'BatchUpdates!C4:C4',
    'BatchUpdates!B2:B2', 'BatchUpdates!C2:C2',
    'BatchUpdates!B3:B3', 'BatchUpdates!C3:C3',
  ])
  assert.deepEqual(calls.ranges.filter((range) => range.range.includes('!C')).map((range) => range.values), [
    [['2026-09-24 09:00:00']], [['2026-09-24 09:00:00']], [['2026-09-24 09:00:00']],
  ])

  await rejectsBeforeWrite('empty input', [])
  await rejectsBeforeWrite('duplicate input key', [changes[0], changes[0]])
  await rejectsBeforeWrite('missing row', [{ keyValue: 'missing', patch: { Label: 'x' } }])
  await rejectsBeforeWrite('unknown column', [{ keyValue: 'a', patch: { Unknown: 'x' } as Partial<Row> }])
  await rejectsBeforeWrite('invalid audit timestamp', [{
    keyValue: 'a', patch: { UpdatedAt: 'invalid' },
  }])
  const blankKey = fixture()
  await assert.rejects(
    () => blankKey.repository.updateMany([{ keyValue: ' ', patch: { Label: 'x' } }]),
    (error: unknown) => error instanceof Error && !(error instanceof WriteRejectedError) &&
      error.message === 'Repository update requires a non-empty id',
  )
  assert.equal(blankKey.calls.writes, 0)

  const transportError = new WriteTransportError('readColumn', 'simulated read failure')
  const transport = fixture({ columnError: transportError })
  await assert.rejects(
    () => transport.repository.updateMany([changes[0]]),
    (error: unknown) => {
      assert.strictEqual(error, transportError)
      assert.ok(!(error instanceof WriteRejectedError))
      return true
    },
  )
  assert.equal(transport.calls.columns, 1)
  assert.equal(transport.calls.writes, 0)

  const duplicate = fixture({ column: [['ID'], ['c'], ['c']] })
  await assert.rejects(
    () => duplicate.repository.updateMany([changes[0]]),
    (error: unknown) => error instanceof DuplicateRowKeyError && !(error instanceof WriteRejectedError),
  )
  assert.equal(duplicate.calls.columns, 1)
  assert.equal(duplicate.calls.writes, 0)

  const mismatch = fixture({ readback: [[['c', 'C changed', '2026-09-24 09:00:00']]] })
  await assert.rejects(() => mismatch.repository.updateMany(changes), WriteCommittedUnreadableError)
  assert.equal(mismatch.calls.writes, 1)

  const identity = fixture({ readback: [
    [['wrong', 'C changed', '2026-09-24 09:00:00']],
    [['a', 'A changed', '2026-09-24 09:00:00']],
    [['b', 'B changed', '2026-09-24 09:00:00']],
  ] })
  await assert.rejects(() => identity.repository.updateMany(changes), WriteCommittedUnreadableError)
  assert.equal(identity.calls.writes, 1)
  console.log('passed - updateMany dry tests')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
