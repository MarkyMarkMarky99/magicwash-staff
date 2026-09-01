import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'

process.env.ISSUE_REPORTS_SPREADSHEET_ID = 'issue-reports-test-spreadsheet'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(JSON.stringify({
  client_email: 'issue-reports@example.test', private_key: String(privateKey.export({ format: 'pem', type: 'pkcs8' })),
})).toString('base64')

const { issueReportRoutes } = await import('../../../../../server/modules/issue-reports/issue-report.module.js')
const headers = ['IssueReportID', 'Title', 'Description', 'Status', 'ScreenshotUrl', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy']
const rows: unknown[][] = []

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function request(method: string, body: unknown, params: Record<string, string> = {}): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params }
}

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
  const url = String(input)
  if (url === 'https://oauth2.googleapis.com/token') return jsonResponse({ access_token: 'token', expires_in: 3600 })
  const path = decodeURIComponent(new URL(url).pathname)
  if (init?.method === 'GET' && path.endsWith('/values/IssueReports!1:1')) return jsonResponse({ values: [headers] })
  if (init?.method === 'GET' && path.endsWith('/values/IssueReports!A:A')) return jsonResponse({ values: [['IssueReportID'], ...rows.map((row) => [row[0]])] })
  if (init?.method === 'GET' && path.endsWith('/gviz/tq')) {
    return jsonResponse({
      status: 'ok',
      table: {
        cols: headers.map((label, index) => ({ id: String.fromCharCode(65 + index), label })),
        rows: rows.map((row) => ({
          c: row.map((value) => (value === null ? null : { v: value })),
        })),
      },
    })
  }
  if (init?.method === 'POST' && path.endsWith('/values/IssueReports!A:A:append')) {
    const body = JSON.parse(String(init.body)) as { values: unknown[][] }
    assert.equal(body.values.length, 1)
    assert.equal(body.values[0]!.length, 9)
    rows.push(body.values[0]!)
    return jsonResponse({
      updates: {
        updatedRows: body.values.length,
        updatedRange: 'IssueReports!A2:I2',
        updatedData: { values: body.values },
      },
    })
  }
  throw new Error(`Unexpected request: ${init?.method} ${path}`)
}) as typeof fetch

try {
  for (const invalid of [
    { title: '', description: 'Description', createdBy: 'staff' },
    { title: 'Title', description: '', createdBy: 'staff' },
    { title: 'Title', description: 'Description', createdBy: '' },
  ]) {
    const result = await issueReportRoutes.collection.handleRequest(request('POST', invalid))
    assert.equal(result.status, 422)
  }

  const created = await issueReportRoutes.collection.handleRequest(request('POST', {
    title: '  Broken dryer ', description: ' Stops after five minutes ', createdBy: ' staff-1 ', status: 'CLOSED', issueReportId: 'ISS-clientid',
  }))
  assert.equal(created.status, 201)
  assert.match(String(rows[0]![0]), /^ISS-[0-9a-f]{8}$/)
  assert.deepEqual(rows[0]!.slice(1, 5), ['Broken dryer', 'Stops after five minutes', 'OPEN', ''])
  assert.match(String(rows[0]![5]), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(rows[0]![6], 'staff-1')
  assert.equal(rows[0]![7], '')
  assert.equal(rows[0]![8], '')

  const onlyUpdatedBy = await issueReportRoutes.item!.handleRequest(request('PATCH', { updatedBy: 'staff-2' }, { id: String(rows[0]![0]) }))
  assert.equal(onlyUpdatedBy.status, 422)
  const missingUpdatedBy = await issueReportRoutes.item!.handleRequest(request('PATCH', { status: 'RESOLVED' }, { id: String(rows[0]![0]) }))
  assert.equal(missingUpdatedBy.status, 422)
} finally {
  globalThis.fetch = originalFetch
}

console.log('issue-report writes dry test passed')
