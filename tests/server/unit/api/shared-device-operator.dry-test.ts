import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { ApiHandler, type ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'
import { SheetsApiClient, type SheetsApiValue } from '../../../../server/shared/repositories/sheets-api.client.js'
import { findStaffByCardCode, findStaffById, invalidateStaffListCache } from '../../../../server/shared/auth/staff-list.js'
import { authRoutes } from '../../../../server/modules/auth/auth.module.js'
import { StaffService } from '../../../../server/modules/staff/staff.service.js'
import { jobTicketAdvanceService, jobTicketRoutes } from '../../../../server/modules/job-tickets/job-ticket.module.js'

const originalRead = SheetsApiClient.prototype.readRange
const originalSpreadsheet = process.env.STAFF_SPREADSHEET_ID
process.env.STAFF_SPREADSHEET_ID = 'staff-test'
const values: SheetsApiValue[][] = [
  ['Email', 'Name', 'Role', 'Active', 'StaffId', 'Phone', 'Address', 'Position', 'StartDate', 'CardCode'],
  ['device@test', 'Shop', 'device', true, 'device', '', '', '', '', ''],
  ['staff@test', 'Worker', 'staff', true, 'worker', '', '', '', '', 'MWS-worker'],
  ['admin@test', 'Admin', 'admin', true, 'admin', '', '', '', '', 'MWS-admin'],
  ['inactive@test', 'Inactive', 'staff', false, 'inactive', '', '', '', '', 'MWS-inactive'],
]
SheetsApiClient.prototype.readRange = async () => values
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
  assert.equal((await findStaffByCardCode(' mws-WORKER '))?.staffId, 'worker')
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

  const service = new StaffService({
    readRange: async range => range === '1:1' ? [values[0]!] : values.slice(1),
    appendRows: async () => { throw new Error('unused') },
    updateCells: async updates => {
      assert.equal(updates[0]!.range, 'Staff!J3')
      values[2]![9] = updates[0]!.values[0]![0]!
      return { responses: [] }
    },
  })
  const { createStaffRoutes } = await import('../../../../server/modules/staff/staff.module.js')
  const staffRoutes = createStaffRoutes(service)
  const issueRequest: ApiHandlerRequest = { method: 'POST', query: {}, headers: {}, body: undefined, params: { id: 'worker' }, staff: worker, email: worker.email }
  assert.equal((await staffRoutes.nestedItem!.handler.handleRequest(issueRequest)).status, 403)
  assert.equal((await staffRoutes.nestedItem!.handler.handleRequest({ ...issueRequest, staff: await findStaffById('admin') })).status, 200)
  const issued = await service.issueCard('worker')
  assert.match(issued.cardCode, /^MWS-[0-9a-f]{8}$/)
  assert.equal(await findStaffByCardCode('MWS-worker'), undefined)
  assert.equal((await findStaffByCardCode(issued.cardCode))?.staffId, 'worker')
  const reissued = await service.issueCard('worker')
  assert.notEqual(reissued.cardCode, issued.cardCode)
  assert.equal(await findStaffByCardCode(issued.cardCode), undefined)
  for (const row of [...await service.list(), await service.me('staff@test'), await service.getById('worker')]) {
    assert.equal('CardCode' in row || 'cardCode' in row, false)
  }

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
