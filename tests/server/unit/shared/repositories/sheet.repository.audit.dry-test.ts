import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import {
  DuplicatePrimaryKeyError,
  SheetsApiClient,
  type SheetsApiAppendResponse,
  WriteRejectedError,
} from '../../../../../server/shared/repositories/sheets-api.client.js'
import { formatBangkokTimestamp } from '../../../../../server/shared/utils/bangkok-timestamp.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const rowSchema = z.object({
  RecordID: z.string(),
  CreatedAt: z.string(),
  UpdatedAt: z.string(),
  Label: z.string(),
  Unstamped: z.string(),
})

type AuditRow = z.infer<typeof rowSchema>

const auditContract = {
  row: rowSchema,
  primaryKey: 'RecordID',
  sheetName: 'AuditRows',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  valueInput: {
    RecordID: 'USER_ENTERED',
    CreatedAt: 'USER_ENTERED',
    UpdatedAt: 'USER_ENTERED',
    Label: 'USER_ENTERED',
    Unstamped: 'USER_ENTERED',
  },
  audit: {
    onAppend: ['CreatedAt', 'UpdatedAt'],
    onUpdate: ['UpdatedAt'],
  },
  writes: { append: true, update: true, delete: false },
} satisfies SheetContract

const headers = ['RecordID', 'CreatedAt', 'UpdatedAt', 'Label', 'Unstamped']
const headerMap = buildSheetHeaderMap(headers, Object.keys(rowSchema.shape), 'RecordID')
const fixedNow = new Date('2026-03-26T21:37:32.000Z')
const fixedTimestamp = formatBangkokTimestamp(fixedNow)

type Call =
  | { kind: 'readColumn'; args: Parameters<SheetsApiClient['readColumn']> }
  | { kind: 'appendRows'; args: Parameters<SheetsApiClient['appendRows']> }
  | { kind: 'updateCells'; args: Parameters<SheetsApiClient['updateCells']> }
  | { kind: 'readRange'; args: Parameters<SheetsApiClient['readRange']> }

interface ClientConfig {
  calls: Call[]
  existingKeys?: string[][]
  appendResponse?: SheetsApiAppendResponse
  readRangeResponse?: string[][]
}

function mockClient(config: ClientConfig): SheetsApiClient {
  const client = new SheetsApiClient({
    spreadsheetId: 'spreadsheet-id',
    sheetName: 'AuditRows',
    fetchImpl: async () => {
      throw new Error('mock SheetsApiClient fetch should not be called')
    },
    accessTokenProvider: async () => 'test-access-token',
  })

  client.readColumn = async (...args: Parameters<SheetsApiClient['readColumn']>) => {
    config.calls.push({ kind: 'readColumn', args })
    return config.existingKeys ?? [['RecordID']]
  }
  client.appendRows = async (...args: Parameters<SheetsApiClient['appendRows']>) => {
    config.calls.push({ kind: 'appendRows', args })
    return config.appendResponse ?? {
      spreadsheetId: 'spreadsheet-id',
      updates: {
        updatedRows: args[0].length,
        updatedData: { values: args[0].map((row) => [...row]) },
      },
    }
  }
  client.updateCells = async (...args: Parameters<SheetsApiClient['updateCells']>) => {
    config.calls.push({ kind: 'updateCells', args })
    return { spreadsheetId: 'spreadsheet-id', responses: [] }
  }
  client.readRange = async (...args: Parameters<SheetsApiClient['readRange']>) => {
    config.calls.push({ kind: 'readRange', args })
    return config.readRangeResponse ?? []
  }

  return client
}

function repository(
  config: ClientConfig,
  contract: SheetContract = auditContract,
  loadHeaderMap: () => Promise<typeof headerMap> = async () => headerMap,
): SheetRepository<AuditRow> {
  return new SheetRepository<AuditRow>({
    contract,
    sheetsApiClient: mockClient(config),
    sheetHeaderMapLoader: { load: loadHeaderMap },
    now: () => fixedNow,
  })
}

function appendValues(
  call: Call,
): Parameters<SheetsApiClient['appendRows']>[0] {
  if (call.kind !== 'appendRows') {
    throw new Error('expected appendRows call')
  }
  return call.args[0]
}

function updateRanges(
  call: Call,
): Parameters<SheetsApiClient['updateCells']>[0] {
  if (call.kind !== 'updateCells') {
    throw new Error('expected updateCells call')
  }
  return call.args[0]
}

async function assertRejectedWrite(
  operation: () => Promise<unknown>,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof WriteRejectedError)
    assert.equal(error.certainty, 'rejected')
    return true
  })
}

type DryTest = { name: string; run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('append stamps both declared columns once and returns the sent row', async () => {
  const config: ClientConfig = { calls: [] }
  const returned = await repository(config).append({ RecordID: 'R-1', Label: 'new' })

  assert.deepEqual(config.calls.map((call) => call.kind), ['readColumn', 'appendRows'])
  assert.deepEqual(appendValues(config.calls[1]!), [[
    'R-1',
    fixedTimestamp,
    fixedTimestamp,
    'new',
    '',
  ]])
  assert.deepEqual(returned, {
    RecordID: 'R-1',
    CreatedAt: fixedTimestamp,
    UpdatedAt: fixedTimestamp,
    Label: 'new',
    Unstamped: '',
  })
})

test('batchAppend stamps every row with one timestamp and performs one key read and one write', async () => {
  const config: ClientConfig = { calls: [] }
  const rows: Array<Partial<AuditRow>> = [
    { RecordID: 'R-1', Label: 'first' },
    { RecordID: 'R-2', CreatedAt: '2026-03-01 01:02:03', Label: 'second' },
    { RecordID: 'R-3', Label: 'third' },
  ]

  await repository(config).batchAppend(rows)

  assert.deepEqual(config.calls.map((call) => call.kind), ['readColumn', 'appendRows'])
  assert.deepEqual(config.calls[0], { kind: 'readColumn', args: ['A'] })
  assert.deepEqual(appendValues(config.calls[1]!), [
    ['R-1', fixedTimestamp, fixedTimestamp, 'first', ''],
    ['R-2', '2026-03-01 01:02:03', fixedTimestamp, 'second', ''],
    ['R-3', fixedTimestamp, fixedTimestamp, 'third', ''],
  ])
})

test('update stamps only onUpdate and leaves the stored CreatedAt column untouched', async () => {
  const config: ClientConfig = {
    calls: [],
    existingKeys: [['RecordID'], ['R-1']],
    readRangeResponse: [[
      'R-1',
      '2026-03-01 01:02:03',
      fixedTimestamp,
      'changed',
      '',
    ]],
  }

  await repository(config).update('R-1', { Label: 'changed' })

  const ranges = updateRanges(config.calls.find((call) => call.kind === 'updateCells')!)
  assert.deepEqual(
    ranges.map((range) => String(range.values[0]?.[0])).sort(),
    [fixedTimestamp, 'changed'].sort(),
  )
  assert.equal(ranges.some((range) => String(range.range).includes('B2')), false)
  assert.equal(ranges.some((range) => String(range.range).includes('C2')), true)
})

test('an explicit conforming audit value wins over the repository timestamp', async () => {
  const config: ClientConfig = { calls: [] }
  await repository(config).append({
    RecordID: 'R-4',
    CreatedAt: '2026-03-27 04:37:32',
    UpdatedAt: '2026-03-28 05:38:33',
    Label: 'historical',
  })

  assert.deepEqual(appendValues(config.calls[1]!), [[
    'R-4',
    '2026-03-27 04:37:32',
    '2026-03-28 05:38:33',
    'historical',
    '',
  ]])
})

test('an invalid caller-supplied audit value is rejected before append', async () => {
  for (const value of [
    '27/03/2026 04:37:32',
    '2026-03-27T04:37:32+07:00',
    '2026-3-7 4:5:6',
  ]) {
    const config: ClientConfig = { calls: [] }
    await assertRejectedWrite(() =>
      repository(config).append({ RecordID: `bad-${value}`, CreatedAt: value }),
    )
    assert.equal(config.calls.some((call) => call.kind === 'appendRows'), false)
  }
})

test('an invalid caller-supplied update audit value is rejected before update', async () => {
  const config: ClientConfig = {
    calls: [],
    existingKeys: [['RecordID'], ['R-8']],
  }

  await assertRejectedWrite(() =>
    repository(config).update('R-8', { UpdatedAt: '2026-3-7 4:5:6' }),
  )
  assert.equal(config.calls.some((call) => call.kind === 'updateCells'), false)
})

test('a declared audit column missing from the live header is rejected before append', async () => {
  const config: ClientConfig = { calls: [] }
  const contract = {
    ...auditContract,
    audit: { onAppend: ['MissingAt'], onUpdate: ['UpdatedAt'] },
  } satisfies SheetContract

  await assertRejectedWrite(() => repository(config, contract).append({ RecordID: 'R-5' }))
  assert.equal(config.calls.some((call) => call.kind === 'appendRows'), false)
})

test('an omitted audit declaration appends without adding a timestamp column', async () => {
  const { audit: _audit, ...contractWithoutAudit } = auditContract
  const noAuditContract = contractWithoutAudit satisfies SheetContract
  const emptyAuditContract = {
    ...contractWithoutAudit,
    audit: { onAppend: [], onUpdate: [] },
  } satisfies SheetContract

  const omittedConfig: ClientConfig = { calls: [] }
  await repository(omittedConfig, noAuditContract).append({ RecordID: 'R-6', Label: 'plain' })
  assert.deepEqual(appendValues(omittedConfig.calls[1]!), [[
    'R-6',
    '',
    '',
    'plain',
    '',
  ]])

  const emptyConfig: ClientConfig = { calls: [] }
  await repository(emptyConfig, emptyAuditContract).append({ RecordID: 'R-7', Label: 'plain' })
  assert.deepEqual(appendValues(emptyConfig.calls[1]!), [[
    'R-7',
    '',
    '',
    'plain',
    '',
  ]])
})

test('a duplicate key inside a batch is rejected before the single append request', async () => {
  const config: ClientConfig = { calls: [] }

  await assert.rejects(
    () => repository(config).batchAppend([
      { RecordID: 'same', Label: 'first' },
      { RecordID: 'same', Label: 'second' },
    ]),
    (error: unknown) => {
      assert.ok(error instanceof DuplicatePrimaryKeyError)
      assert.equal(error.certainty, 'rejected')
      return true
    },
  )
  assert.equal(config.calls.filter((call) => call.kind === 'readColumn').length, 1)
  assert.equal(config.calls.some((call) => call.kind === 'appendRows'), false)
})

let failures = 0
for (const currentTest of tests) {
  try {
    await currentTest.run()
    console.log(`ok - ${currentTest.name}`)
  } catch (error: unknown) {
    failures += 1
    console.error(`not ok - ${currentTest.name}`)
    console.error(error)
  }
}

if (failures !== 0) {
  throw new Error(`${failures} dry-test(s) failed.`)
}

console.log(`passed - ${tests.length} sheet repository audit dry-tests`)
