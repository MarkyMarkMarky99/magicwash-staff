import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'

process.env.LAUNDRY_PACKAGES_SPREADSHEET_ID = 'packages-module-test-spreadsheet'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'packages-module-test@example.test',
  private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const { packageRoutes } = await import('../../../../../server/modules/packages/package.module.js')

type PackageRow = [
  string,
  string,
  string,
  number,
  number,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]

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
const rows: PackageRow[] = [
  [
    'PKG-ACTIVE',
    'Active package',
    'wash',
    10,
    100,
    '',
    '2026-08-01 10:00:00',
    'staff-1',
    '',
    '',
    '',
    '',
  ],
  [
    'PKG-RETIRED',
    'Retired package',
    'pressing',
    5,
    75,
    '',
    '2026-07-01 10:00:00',
    'staff-1',
    '2026-08-01 12:00:00',
    'staff-2',
    '2026-08-01 12:00:00',
    'staff-2',
  ],
]

type FetchCall = { url: string; init?: RequestInit }
const calls: FetchCall[] = []

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname)
}

function columnNumber(column: string): number {
  return column.split('').reduce(
    (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
    0,
  )
}

function gvizResponse(url: string): Response {
  const query = new URL(url).searchParams.get('tq') ?? ''
  const code = /where A = '([^']+)'/.exec(query)?.[1]
  const selectedRows = code === undefined ? rows : rows.filter((row) => row[0] === code)
  const table = {
    cols: headers.map((_header, index) => ({ id: String.fromCharCode(65 + index) })),
    rows: selectedRows.map((row) => ({
      c: row.map((value) => ({ v: value })),
    })),
  }
  return new Response(`google.visualization.Query.setResponse(${JSON.stringify({ status: 'ok', table })});`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

function request(
  method: string,
  body: unknown = undefined,
  params: Record<string, string> = {},
): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params }
}

function bodyOf(result: { body: unknown }): Record<string, unknown> {
  assert.ok(typeof result.body === 'object' && result.body !== null)
  return result.body as Record<string, unknown>
}

function dataOf(result: { status: number; body: unknown }): Record<string, unknown> {
  assert.equal(result.status === 200 || result.status === 201, true)
  const body = bodyOf(result)
  assert.equal(body.success, true)
  assert.ok(typeof body.data === 'object' && body.data !== null)
  return body.data as Record<string, unknown>
}

function assertApiError(result: { status: number; body: unknown }, status: number): void {
  assert.equal(result.status, status)
  const body = bodyOf(result)
  assert.equal(body.success, false)
  assert.ok(typeof body.error === 'object' && body.error !== null)
}

function batchUpdateBody(call: FetchCall): { data: Array<{ range: string; values: unknown[][] }> } {
  assert.ok(call.init?.body)
  return JSON.parse(String(call.init.body)) as { data: Array<{ range: string; values: unknown[][] }> }
}

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
  const call = { url: String(input), init }
  calls.push(call)
  if (call.url === 'https://oauth2.googleapis.com/token') {
    return jsonResponse({ access_token: 'packages-test-token', expires_in: 3600 })
  }
  if (call.url.includes('/gviz/tq')) {
    return gvizResponse(call.url)
  }

  const path = pathOf(call.url)
  if (init?.method === 'GET' && path.endsWith('/values/Packages!1:1')) {
    return jsonResponse({ values: [headers] })
  }
  if (init?.method === 'GET' && path.endsWith('/values/Packages!A:A')) {
    return jsonResponse({ values: [['package_code'], ...rows.map((row) => [row[0]])] })
  }
  if (init?.method === 'POST' && path.endsWith('/values/Packages:append')) {
    const body = JSON.parse(String(init.body)) as { values: PackageRow[] }
    assert.equal(body.values.length, 1)
    rows.push([...body.values[0]!] as PackageRow)
    return jsonResponse({
      spreadsheetId: process.env.LAUNDRY_PACKAGES_SPREADSHEET_ID,
      updates: { updatedRows: 1, updatedData: { values: body.values } },
    })
  }
  if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
    const body = batchUpdateBody(call)
    for (const entry of body.data) {
      const match = /Packages!([A-Z]+)(\d+):[A-Z]+\d+/.exec(entry.range)
      assert.ok(match)
      const row = rows[Number(match[2]) - 2]
      assert.ok(row)
      row[columnNumber(match[1]!) - 1] = entry.values[0]![0] as never
    }
    return jsonResponse({ spreadsheetId: process.env.LAUNDRY_PACKAGES_SPREADSHEET_ID, responses: body.data.map(() => ({})) })
  }
  if (init?.method === 'GET' && /\/values\/Packages!A\d+:L\d+$/.test(path)) {
    const rowNumber = Number(/Packages!A(\d+):L\d+$/.exec(path)![1]) - 2
    return jsonResponse({ values: [rows[rowNumber]] })
  }
  throw new Error(`Unexpected request: ${init?.method} ${path}`)
}) as typeof fetch

try {
  const listed = await packageRoutes.collection.handleRequest(request('GET'))
  const listedData = dataOf(listed)
  assert.ok(Array.isArray(listedData))
  assert.equal((listedData.find((item) => (item as Record<string, unknown>).packageCode === 'PKG-RETIRED') as Record<string, unknown>).deletedAt, '2026-08-01 12:00:00')

  const invalidCallCount = calls.length
  const invalidCreate = await packageRoutes.collection.handleRequest(request('POST', {
    packageCode: 'PKG-INVALID',
    name: 'Invalid',
    eligibleService: 'wash',
    includedCredit: 1,
    price: 10,
    createdBy: 'staff-1',
    createdAt: '2026-08-27T12:00:00.000Z',
  }))
  assertApiError(invalidCreate, 422)
  assert.equal(calls.length, invalidCallCount)

  const createdResult = await packageRoutes.collection.handleRequest(request('POST', {
    packageCode: 'PKG-NEW',
    name: 'New package',
    eligibleService: 'wash_iron',
    includedCredit: 20,
    price: 200,
    createdBy: 'staff-3',
  }))
  const created = dataOf(createdResult)
  assert.equal(created.packageCode, 'PKG-NEW')
  assert.match(String(created.createdAt), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(created.updatedAt, null)
  assert.equal(created.deletedAt, null)
  const appendBody = JSON.parse(String(calls.find((call) => call.init?.method === 'POST' && pathOf(call.url).endsWith('/values/Packages:append'))?.init?.body)) as { values: PackageRow[] }
  assert.match(appendBody.values[0]![6]!, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(appendBody.values[0]![8], '')

  const deactivatedResult = await packageRoutes.item!.handleRequest(request('PATCH', {
    active: false,
    updatedBy: 'staff-4',
  }, { id: 'PKG-NEW' }))
  const deactivated = dataOf(deactivatedResult)
  assert.match(String(deactivated.updatedAt), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.match(String(deactivated.deletedAt), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(deactivated.deletedBy, 'staff-4')
  const deactivateCall = calls.filter((call) => call.init?.method === 'POST' && pathOf(call.url).endsWith('/values:batchUpdate')).at(-1)
  assert.ok(deactivateCall)
  const deactivateBody = batchUpdateBody(deactivateCall)
  assert.equal(deactivateBody.data.some((entry) => entry.range.includes('active')), false)
  assert.equal(deactivateBody.data.some((entry) => entry.range.includes('K')), true)
  assert.equal(deactivateBody.data.some((entry) => entry.range.includes('L')), true)

  const listedWithRetired = dataOf(await packageRoutes.collection.handleRequest(request('GET')))
  assert.ok((listedWithRetired.find((item) => (item as Record<string, unknown>).packageCode === 'PKG-NEW') as Record<string, unknown>).deletedAt)

  const reactivatedResult = await packageRoutes.item!.handleRequest(request('PATCH', {
    active: true,
    updatedBy: 'staff-5',
  }, { id: 'PKG-NEW' }))
  const reactivated = dataOf(reactivatedResult)
  assert.equal(reactivated.deletedAt, null)
  assert.equal(reactivated.deletedBy, null)
  const reactivateCall = calls.filter((call) => call.init?.method === 'POST' && pathOf(call.url).endsWith('/values:batchUpdate')).at(-1)
  assert.ok(reactivateCall)
  const reactivateBody = batchUpdateBody(reactivateCall)
  assert.equal(reactivateBody.data.find((entry) => entry.range.includes('K'))?.values[0]?.[0], '')
  assert.equal(reactivateBody.data.find((entry) => entry.range.includes('L'))?.values[0]?.[0], '')

  const detail = await packageRoutes.item!.handleRequest(request('GET', undefined, { id: 'PKG-NEW' }))
  assert.equal(detail.status, 200)
  assert.equal(dataOf(detail).packageCode, 'PKG-NEW')
  const writesBeforeUnknown = calls.filter((call) => call.init?.method === 'POST' && call.url.includes('sheets.googleapis.com')).length
  assertApiError(await packageRoutes.item!.handleRequest(request('GET', undefined, { id: 'PKG-MISSING' })), 404)
  assert.equal(calls.filter((call) => call.init?.method === 'POST' && call.url.includes('sheets.googleapis.com')).length, writesBeforeUnknown)
} finally {
  globalThis.fetch = originalFetch
}

console.log('package module workflow dry test passed')
