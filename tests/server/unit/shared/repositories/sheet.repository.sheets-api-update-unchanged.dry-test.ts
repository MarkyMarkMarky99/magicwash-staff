import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import {
  SheetsApiClient,
  WriteCommittedUnreadableError,
  WriteTransportError,
} from '../../../../../server/shared/repositories/sheets-api.client.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const updateRowSchema = z.object({
  UpdateID: z.string(),
  Label: z.string(),
})

type UpdateRow = z.infer<typeof updateRowSchema>

const updateContract = {
  row: updateRowSchema,
  primaryKey: 'UpdateID',
  sheetName: 'UpdateCertainty',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writes: { append: false, update: true, delete: false },
} satisfies SheetContract

const headerMap = buildSheetHeaderMap(
  ['UpdateID', 'Label'],
  Object.keys(updateRowSchema.shape),
  'UpdateID',
)

interface FetchCall {
  url: string
  init?: RequestInit
}

async function withFetchSpy(
  run: (calls: FetchCall[]) => Promise<void>,
): Promise<void> {
  const calls: FetchCall[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response('{}', { status: 200 })
  }

  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function updateClient(
  updateCells: SheetsApiClient['updateCells'],
): SheetsApiClient {
  return {
    readColumn: async () => [['UpdateID'], ['update-1']],
    updateCells,
    readRange: async () => {
      throw new Error('readRange must not run after updateCells rejects')
    },
  } as unknown as SheetsApiClient
}

function updateRepository(
  updateCells: SheetsApiClient['updateCells'],
): SheetRepository<UpdateRow> {
  return new SheetRepository<UpdateRow>({
    contract: updateContract,
    sheetsApiClient: updateClient(updateCells),
    sheetHeaderMapLoader: { load: async () => headerMap },
  })
}

async function assertUpdateErrorUnchanged(
  error: WriteTransportError | WriteCommittedUnreadableError,
): Promise<void> {
  const repository = updateRepository(async () => {
    throw error
  })

  await withFetchSpy(async (calls) => {
    await assert.rejects(
      () => repository.update('update-1', { Label: 'changed' }),
      (received: unknown) => {
        assert.strictEqual(received, error)
        return true
      },
    )
    assert.equal(calls.length, 0)
  })
}

async function run(): Promise<void> {
  await assertUpdateErrorUnchanged(
    new WriteTransportError('UPDATE', 'simulated timeout'),
  )
  console.log('ok - UPDATE transport error propagates unchanged without GViz verification')

  await assertUpdateErrorUnchanged(
    new WriteCommittedUnreadableError('UPDATE', 'unreadable response'),
  )
  console.log('ok - UPDATE committed unreadable error propagates unchanged without GViz verification')

  console.log('passed - UPDATE unchanged dry tests')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
