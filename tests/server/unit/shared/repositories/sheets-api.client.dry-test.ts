import assert from 'node:assert/strict'
import type { SheetsApiValueRange } from '../../../../../server/shared/repositories/sheets-api.client.js'

const clientModulePath = '../../../../../server/shared/repositories/sheets-api.client.js'
const spreadsheetId = 'test-spreadsheet-id'
const sheetName = 'Orders'
const accessToken = 'test-access-token'

type ClientModule = typeof import('../../../../../server/shared/repositories/sheets-api.client.js')
type FetchCall = { readonly url: string; readonly init: RequestInit | undefined }
type FetchResponder = (call: FetchCall) => Promise<Response>

async function loadClient(caseName: string): Promise<ClientModule> {
  return import(`${clientModulePath}?case=${caseName}`)
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getHeaders(init: RequestInit | undefined): Headers {
  if (init === undefined) {
    throw new Error('Expected a RequestInit object.')
  }

  return new Headers(init.headers)
}

function assertSheetsEndpoint(url: string, expectedPath: string): URL {
  const parsed = new URL(url)
  assert.equal(parsed.origin, 'https://sheets.googleapis.com')
  assert.equal(decodeURIComponent(parsed.pathname), `/v4/spreadsheets/${spreadsheetId}${expectedPath}`)
  return parsed
}

function assertAuthorizedRequest(call: FetchCall, method: string, expectedPath: string): URL {
  assert.equal(call.init?.method, method)
  const headers = getHeaders(call.init)
  assert.equal(headers.get('Authorization'), `Bearer ${accessToken}`)
  return assertSheetsEndpoint(call.url, expectedPath)
}

type WriteErrorClass =
  | ClientModule['WriteRejectedError']
  | ClientModule['WriteTransportError']
  | ClientModule['WriteCommittedUnreadableError']

function assertFailureShape(
  error: unknown,
  errorClass: WriteErrorClass,
  certainty: 'rejected' | 'unknown',
): boolean {
  assert.ok(error instanceof errorClass)
  assert.ok(error instanceof Error)
  assert.equal('certainty' in error && error.certainty, certainty)
  assert.equal(error.message.includes(accessToken), false)
  assert.equal(error.message.includes('Bearer'), false)
  return true
}

async function expectFailure(
  promise: Promise<unknown>,
  errorClass: WriteErrorClass,
  certainty: 'rejected' | 'unknown',
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => assertFailureShape(error, errorClass, certainty))
}

async function makeClient(
  caseName: string,
  responder: FetchResponder,
  accessTokenProvider: () => Promise<string> = async () => accessToken,
): Promise<{ readonly client: InstanceType<ClientModule['SheetsApiClient']>; readonly calls: FetchCall[]; readonly module: ClientModule }> {
  const module = await loadClient(caseName)
  const calls: FetchCall[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const call = { url: String(input), init }
    calls.push(call)
    return responder(call)
  }

  const client = new module.SheetsApiClient({
    spreadsheetId,
    sheetName,
    fetchImpl,
    accessTokenProvider,
  })

  return { client, calls, module }
}

type DryTest = { readonly name: string; readonly run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('readHeader sends the values:get request for row 1', async () => {
  const { client, calls } = await makeClient('read-header', async (call) => {
    const url = assertAuthorizedRequest(call, 'GET', '/values/Orders!1:1')
    assert.equal(url.search, '')
    assert.equal(call.init?.body, undefined)
    return jsonResponse(200, { values: [['OrderID', 'Name']] })
  })

  assert.deepEqual(await client.readHeader(), ['OrderID', 'Name'])
  assert.equal(calls.length, 1)
})

test('readColumn sends the values:get request for one column', async () => {
  const { client, calls } = await makeClient('read-column', async (call) => {
    const url = assertAuthorizedRequest(call, 'GET', '/values/Orders!A:A')
    assert.equal(url.search, '')
    assert.equal(call.init?.body, undefined)
    return jsonResponse(200, { values: [['OrderID'], ['order-1']] })
  })

  assert.deepEqual(await client.readColumn('A'), [['OrderID'], ['order-1']])
  assert.equal(calls.length, 1)
})

test('readRange sends the values:get request for an arbitrary range', async () => {
  const { client, calls } = await makeClient('read-range', async (call) => {
    const url = assertAuthorizedRequest(call, 'GET', '/values/Orders!B5:F5')
    assert.equal(url.search, '')
    assert.equal(call.init?.body, undefined)
    return jsonResponse(200, { values: [['order-1', 'Ready', 42, true, null]] })
  })

  assert.deepEqual(await client.readRange('B5:F5'), [['order-1', 'Ready', 42, true, null]])
  assert.equal(calls.length, 1)
})

test('readRange sends the requested render options', async () => {
  const { client, calls } = await makeClient('read-range-options', async (call) => {
    const url = assertAuthorizedRequest(call, 'GET', '/values/Orders!B5:F5')
    assert.deepEqual([...url.searchParams.entries()], [
      ['valueRenderOption', 'UNFORMATTED_VALUE'],
      ['dateTimeRenderOption', 'FORMATTED_STRING'],
    ])
    return jsonResponse(200, { values: [['order-1', 42, true, '2026-08-19', null]] })
  })

  assert.deepEqual(
    await client.readRange('B5:F5', {
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    }),
    [['order-1', 42, true, '2026-08-19', null]],
  )
  assert.equal(calls.length, 1)
})

test('readRange rejects an unreadable response', async () => {
  const { client, calls, module } = await makeClient('read-range-unreadable', async (call) => {
    assertAuthorizedRequest(call, 'GET', '/values/Orders!B5:F5')
    return jsonResponse(200, { values: [['valid'], ['not', 'a', 'valid', 'cell', {}]] })
  })

  await expectFailure(client.readRange('B5:F5'), module.WriteTransportError, 'unknown')
  assert.equal(calls.length, 1)
})

test('appendRows sends the required append query and body', async () => {
  const { client, calls } = await makeClient('append-request', async () => {
    return jsonResponse(200, {
      spreadsheetId,
      updates: {
        updatedRows: 1,
        updatedData: { values: [['order-1', 'Ready']] },
      },
    })
  })

  const result = await client.appendRows([['order-1', 'Ready']], 'USER_ENTERED')
  assert.deepEqual(result.updates.updatedData.values, [['order-1', 'Ready']])
  assert.equal(calls.length, 1)
  const url = assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
  assert.equal(url.searchParams.get('valueInputOption'), 'USER_ENTERED')
  assert.equal(url.searchParams.get('insertDataOption'), 'INSERT_ROWS')
  assert.equal(url.searchParams.get('includeValuesInResponse'), 'true')
  assert.equal(url.searchParams.get('responseValueRenderOption'), 'UNFORMATTED_VALUE')
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), {
    majorDimension: 'ROWS',
    values: [['order-1', 'Ready']],
  })
})

test('appendRows does not cap the request at 26 columns', async () => {
  const row = Array.from({ length: 27 }, (_, index) => `value-${index}`)
  const { client, calls } = await makeClient('append-width', async () => {
    return jsonResponse(200, {
      updates: {
        updatedRows: 1,
        updatedData: { values: [row] },
      },
    })
  })

  await client.appendRows([row], 'USER_ENTERED')
  assert.equal(calls.length, 1)
  assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)).values, [row])
})

test('updateCells sends values:batchUpdate with USER_ENTERED', async () => {
  const { client, calls } = await makeClient('update-request', async (call) => {
    const url = assertAuthorizedRequest(call, 'POST', '/values:batchUpdate')
    assert.equal(url.search, '')
    assert.deepEqual(JSON.parse(String(call.init?.body)), {
      valueInputOption: 'USER_ENTERED',
      data: [{ range: 'Orders!B2:C2', values: [['Ready', '2026-08-09']] }],
    })
    return jsonResponse(200, { spreadsheetId, responses: [{}] })
  })

  const result = await client.updateCells(
    [{ range: 'Orders!B2:C2', values: [['Ready', '2026-08-09']] }],
    'USER_ENTERED',
  )
  assert.equal(result.responses.length, 1)
  assert.equal(calls.length, 1)
})

for (const status of [400, 403, 404, 409]) {
  test(`HTTP ${status} is a rejected write`, async () => {
    let responseReturned = false
    const { client, calls, module } = await makeClient(`http-${status}`, async () => {
      responseReturned = true
      return jsonResponse(status, { error: { message: 'server must not be copied into the error' } })
    })

    await expectFailure(client.appendRows([['order-1']], 'RAW'), module.WriteRejectedError, 'rejected')
    assert.equal(responseReturned, true)
    assert.equal(calls.length, 1)
    const url = assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
    assert.equal(url.searchParams.get('insertDataOption'), 'INSERT_ROWS')
  })
}

for (const status of [500, 503]) {
  test(`HTTP ${status} is an unknown transport result`, async () => {
    let responseReturned = false
    const { client, calls, module } = await makeClient(`http-${status}`, async () => {
      responseReturned = true
      return jsonResponse(status, { error: { message: 'server error' } })
    })

    await expectFailure(client.appendRows([['order-1']], 'RAW'), module.WriteTransportError, 'unknown')
    assert.equal(responseReturned, true)
    assert.equal(calls.length, 1)
    assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
  })
}

test('network failure is an unknown transport result', async () => {
  let transportThrown = false
  const { client, calls, module } = await makeClient('network', async () => {
    transportThrown = true
    throw new Error('network failure containing Bearer test-access-token')
  })

  await expectFailure(client.appendRows([['order-1']], 'RAW'), module.WriteTransportError, 'unknown')
  assert.equal(transportThrown, true)
  assert.equal(calls.length, 1)
  assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
})

test('timeout is an unknown transport result and uses the 15 second signal', async () => {
  let transportThrown = false
  let signalWasProvided = false
  const { client, calls, module } = await makeClient('timeout', async (call) => {
    signalWasProvided = call.init?.signal instanceof AbortSignal
    transportThrown = true
    throw Object.assign(new Error('request timed out'), { name: 'TimeoutError' })
  })

  assert.equal(module.SHEETS_API_TIMEOUT_MS, 15_000)
  await expectFailure(client.appendRows([['order-1']], 'RAW'), module.WriteTransportError, 'unknown')
  assert.equal(signalWasProvided, true)
  assert.equal(transportThrown, true)
  assert.equal(calls.length, 1)
  assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
})

test('a successful append without updates is committed but unreadable', async () => {
  const { client, calls, module } = await makeClient('missing-updates', async () => {
    return jsonResponse(200, { spreadsheetId })
  })

  await expectFailure(client.appendRows([['order-1']], 'RAW'), module.WriteCommittedUnreadableError, 'unknown')
  assert.equal(calls.length, 1)
  assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
})

test('a successful append with the wrong row count is committed but unreadable', async () => {
  const { client, calls, module } = await makeClient('row-count', async () => {
    return jsonResponse(200, {
      updates: {
        updatedRows: 2,
        updatedData: { values: [['order-1']] },
      },
    })
  })

  await expectFailure(client.appendRows([['order-1']], 'RAW'), module.WriteCommittedUnreadableError, 'unknown')
  assert.equal(calls.length, 1)
  assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
})

test('append restores trailing blank cells as null', async () => {
  const { client, calls } = await makeClient('trailing-blanks', async () => jsonResponse(200, {
    updates: {
      updatedRows: 1,
      updatedData: { values: [['order-1']] },
    },
  }))

  const result = await client.appendRows([['order-1', '']], 'USER_ENTERED')
  assert.deepEqual(result.updates.updatedData.values, [['order-1', null]])
  assert.equal(calls.length, 1)
  assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
})

test('append uses known header width when restoring trailing blank cells', async () => {
  const { client, calls } = await makeClient('known-width-trailing-blanks', async () => jsonResponse(200, {
    updates: {
      updatedRows: 1,
      updatedData: { values: [['order-1']] },
    },
  }))

  const result = await client.appendRows([['order-1']], 'USER_ENTERED', 4)
  assert.deepEqual(result.updates.updatedData.values, [['order-1', null, null, null]])
  assert.equal(calls.length, 1)
  assertAuthorizedRequest(calls[0]!, 'POST', '/values/Orders:append')
})

test('auth failure is rejected before fetch and cannot expose the token', async () => {
  let fetchCalled = false
  const module = await loadClient('auth-failure')
  const fetchImpl: typeof fetch = async () => {
    fetchCalled = true
    throw new Error('fetch must not be called')
  }
  const accessTokenProvider = async (): Promise<string> => {
    const error = new Error('GoogleAuthError private key Bearer test-access-token')
    error.name = 'GoogleAuthError'
    throw error
  }
  const client = new module.SheetsApiClient({
    spreadsheetId,
    sheetName,
    fetchImpl,
    accessTokenProvider,
  })

  await expectFailure(client.appendRows([['order-1']], 'RAW'), module.WriteRejectedError, 'rejected')
  assert.equal(fetchCalled, false)
})

test('pre-dispatch serialization failure is a rejected write and does not call fetch', async () => {
  const { client, calls, module } = await makeClient('serialization-failure', async () => {
    throw new Error('fetch must not be called')
  })
  const data = [{ range: 'Orders!B2', values: [[BigInt(1)]] }] as unknown as SheetsApiValueRange[]

  await expectFailure(client.updateCells(data, 'RAW'), module.WriteRejectedError, 'rejected')
  assert.equal(calls.length, 0)
})

test('a successful write with an unreadable response body is committed but must not be retried', async () => {
  const { client, calls, module } = await makeClient('unreadable-body', async () => {
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid JSON')
      },
    } as unknown as Response
  })

  await assert.rejects(client.appendRows([['order-1']], 'RAW'), (error: unknown) => {
    assertFailureShape(error, module.WriteCommittedUnreadableError, 'unknown')
    assert.ok(error instanceof Error)
    assert.match(error.message, /do not retry/i)
    return true
  })
  assert.equal(calls.length, 1)
})

test('all public write failure classes expose their certainty', async () => {
  const module = await loadClient('error-properties')
  const rejected = new module.WriteRejectedError('appendRows', 'rejected')
  const transport = new module.WriteTransportError('appendRows', 'unknown')
  const committed = new module.WriteCommittedUnreadableError('appendRows')

  assert.equal(rejected.certainty, 'rejected')
  assert.equal(transport.certainty, 'unknown')
  assert.equal(committed.certainty, 'unknown')
  assert.match(committed.message, /do not retry/i)
})

const orderedTests = process.env.REVERSE_TESTS === '1' ? [...tests].reverse() : tests
let failures = 0

for (const currentTest of orderedTests) {
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

console.log(`passed - ${orderedTests.length} sheets-api.client dry-tests`)
