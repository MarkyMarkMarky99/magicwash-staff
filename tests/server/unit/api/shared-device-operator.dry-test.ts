import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { ApiHandler, type ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'
import { SheetsApiClient, type SheetsApiValue } from '../../../../server/shared/repositories/sheets-api.client.js'
import { findStaffByCardCode, findStaffById, invalidateStaffListCache } from '../../../../server/shared/auth/staff-list.js'
import { authRoutes } from '../../../../server/modules/auth/auth.module.js'
import { jobTicketAdvanceService, jobTicketRoutes } from '../../../../server/modules/job-tickets/job-ticket.module.js'

const originalRead = SheetsApiClient.prototype.readRange
const originalSpreadsheet = process.env.STAFF_SPREADSHEET_ID
process.env.STAFF_SPREADSHEET_ID = 'staff-test'
const values: SheetsApiValue[][] = [
  ['Email', 'Name', 'Role', 'Active', 'StaffId', 'Phone', 'Address', 'Position', 'StartDate'],
  ['device@test', 'Shop', 'device', true, 'device', '', '', '', ''],
  ['staff@test', 'Worker', 'staff', true, 'worker', '', '', '', ''],
  ['admin@test', 'Admin', 'admin', true, 'admin', '', '', '', ''],
  ['inactive@test', 'Inactive', 'staff', false, 'inactive', '', '', '', ''],
]
SheetsApiClient.prototype.readRange = async range => {
  assert.equal(range, 'A:I')
  return values
}
const device = { staffId: 'device', name: 'Shop', email: 'device@test', role: 'device' as const }
const echo = new ApiHandler({ GET: req => ({ status: 200, body: req.staff }), POST: req => ({ status: 200, body: req.staff }) })
const gateway = new ApiGateway({
  jobs: async () => ({ collection: echo }),
  auth: async () => authRoutes,
  staff: async () => ({ collection: echo }),
}, async () => device, async () => ({ email: device.email, staff: device }))
const call = (method: string, path: string, operator?: string | string[], query = {}) => gateway.handleRequest({
  method, url: path, query, headers: operator === undefined ? {} : { 'x-operator-id': operator },
} as VercelRequest)
const data = (result: { body: unknown }) => (result.body as { data: Record<string, unknown> }).data
try {
  invalidateStaffListCache()
  assert.equal((await findStaffById(' WORKER '))?.staffId, 'worker')
  for (const code of ['MWS-worker', ' mws-WORKER ', 'MwS-WoRkEr']) {
    assert.equal((await findStaffByCardCode(code))?.staffId, 'worker')
  }
  for (const code of ['MWS-unknown', 'worker', 'JOB-MWS-worker', '', 'MWS-', ' mWs- ']) {
    assert.equal(await findStaffByCardCode(code), undefined)
  }
  assert.equal(await findStaffByCardCode('MWS-inactive'), undefined)
  const resolved = await call('POST', '/api/jobs', 'worker')
  assert.equal(resolved.status, 200)
  assert.equal((resolved.body as { staffId: string }).staffId, 'worker')
  assert.equal((resolved.body as { cardCode?: string }).cardCode, undefined)
  assert.equal(((await call('POST', '/api/jobs', 'admin')).body as { role: string }).role, 'staff')
  for (const invalid of ['missing', 'inactive', '', ['worker', 'admin']]) {
    assert.equal((await call('POST', '/api/jobs', invalid)).status, 403)
  }
  const missing = await call('POST', '/api/jobs')
  assert.equal(missing.status, 403)
  assert.match(JSON.stringify(missing.body), /Scan a staff card first/)
  assert.equal(((await call('GET', '/api/jobs')).body as { role: string }).role, 'device')
  assert.equal(data(await call('GET', '/api/auth/me', 'missing')).role, 'device')
  assert.equal(((await call('POST', '/api/staff', 'missing')).body as { role: string }).role, 'device')
  assert.deepEqual(data(await call('GET', '/api/auth/card', undefined, { code: ' mws-WORKER ' })), { staffId: 'worker', name: 'Worker' })
  assert.equal((await call('GET', '/api/auth/card', undefined, { code: 'MWS-inactive' })).status, 404)
  assert.equal((await call('GET', '/api/auth/card', undefined, { code: ['MWS-worker'] })).status, 422)
  const worker = (await findStaffById('worker'))!
  const authMe = await authRoutes.item!.handleRequest({ method: 'GET', params: { id: 'me' }, query: {}, headers: {}, body: undefined, staff: worker })
  assert.equal('cardCode' in data(authMe), false)
  assert.equal((await authRoutes.item!.handleRequest({ method: 'GET', params: { id: 'card' }, query: { code: 'MWS-worker' }, headers: {}, body: undefined, staff: worker })).status, 403)

  const originalAdvance = jobTicketAdvanceService.advance
  let received: unknown
  jobTicketAdvanceService.advance = async body => { received = body; return { kind: 'completed', advanced: [], blocked: [], skipped: [], scoreFailed: 0 } }
  const request: ApiHandlerRequest = { method: 'POST', params: { id: 'advance' }, query: {}, headers: {}, body: { scannedBy: 'forged', ticketIds: ['ticket'] }, staff: worker }
  try {
    assert.equal((await jobTicketRoutes.item!.handleRequest(request)).status, 200)
    assert.equal((received as { scannedBy: string }).scannedBy, 'worker')
    assert.equal((await jobTicketRoutes.item!.handleRequest({ ...request, staff: undefined })).status, 401)
  } finally { jobTicketAdvanceService.advance = originalAdvance }
} finally {
  SheetsApiClient.prototype.readRange = originalRead
  invalidateStaffListCache()
  if (originalSpreadsheet === undefined) delete process.env.STAFF_SPREADSHEET_ID
  else process.env.STAFF_SPREADSHEET_ID = originalSpreadsheet
}
console.log('shared device operator dry test passed')
