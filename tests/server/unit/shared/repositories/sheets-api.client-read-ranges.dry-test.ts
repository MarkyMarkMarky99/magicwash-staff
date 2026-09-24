import assert from 'node:assert/strict'
import {
  SheetsApiClient,
  WriteRejectedError,
  WriteTransportError,
} from '../../../../../server/shared/repositories/sheets-api.client.js'

type FetchCall = { url: string; init: RequestInit | undefined }

function createClient(body: unknown): { client: SheetsApiClient; calls: FetchCall[] } {
  const calls: FetchCall[] = []
  const client = new SheetsApiClient({
    spreadsheetId: 'spreadsheet-id',
    sheetName: 'Order Sheet',
    accessTokenProvider: async () => 'token',
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init })
      return new Response(JSON.stringify(body), { status: 200 })
    },
  })
  return { client, calls }
}

async function run(): Promise<void> {
  const { client, calls } = createClient({
    valueRanges: [
      { range: "'Order Sheet'!A2:C2", values: [['first', 1]] },
      { range: "'Order Sheet'!A4:C4", values: [['second', 2]] },
    ],
  })
  assert.deepEqual(await client.readRanges(['A2:C2', 'A4:C4'], {
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  }), [[['first', 1]], [['second', 2]]])
  assert.equal(calls.length, 1)
  const url = new URL(calls[0]!.url)
  assert.equal(url.pathname, '/v4/spreadsheets/spreadsheet-id/values:batchGet')
  assert.deepEqual(url.searchParams.getAll('ranges'), ['Order Sheet!A2:C2', 'Order Sheet!A4:C4'])
  assert.equal(url.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE')
  assert.equal(url.searchParams.get('dateTimeRenderOption'), 'FORMATTED_STRING')
  assert.equal(calls[0]!.init?.method, 'GET')
  assert.equal(calls[0]!.init?.body, undefined)
  assert.equal(new Headers(calls[0]!.init?.headers).get('Authorization'), 'Bearer token')

  const mismatch = createClient({ valueRanges: [{ values: [['only one']] }] })
  await assert.rejects(
    () => mismatch.client.readRanges(['A2:A2', 'A3:A3']),
    (error: unknown) => error instanceof WriteTransportError && error.operation === 'readRanges',
  )
  assert.equal(mismatch.calls.length, 1)

  const empty = createClient({ valueRanges: [] })
  await assert.rejects(
    () => empty.client.readRanges([]),
    (error: unknown) => error instanceof WriteRejectedError && error.operation === 'readRanges',
  )
  assert.equal(empty.calls.length, 0)
  console.log('passed - readRanges dry tests')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
