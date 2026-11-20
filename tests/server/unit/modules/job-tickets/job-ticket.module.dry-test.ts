import assert from 'node:assert/strict'
import { stubClearStockTake } from '../../stock-take-freeze.fixture.js'

stubClearStockTake()
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import {
  jobTicketFieldMap,
  jobTicketDepartmentWorkService,
  jobTicketService,
  jobTicketCompleteService,
  jobTicketReopenService,
  jobTicketAdvanceService,
  jobTicketRoutes,
  jobTicketStartService,
} from '../../../../../server/modules/job-tickets/job-ticket.module.js'
import { routeRegistry } from '../../../../../server/api/route-registry.js'

assert.deepEqual(jobTicketFieldMap, {
  id: 'id', order_id: 'orderId', laundry_item_id: 'laundryItemId', scope: 'scope',
  task_code: 'taskCode', department: 'department', step_no: 'stepNo',
  customer_id: 'customerId', order_name: 'orderName', due_date: 'dueDate',
  special_instructions: 'specialInstructions', notes: 'notes', status: 'status',
  started_at: 'startedAt', completed_at: 'completedAt', scanned_by: 'scannedBy',
  photo_evidence_url: 'photoEvidenceUrl', created_at: 'createdAt', created_by: 'createdBy',
  updated_at: 'updatedAt', updated_by: 'updatedBy', deleted_at: 'deletedAt', deleted_by: 'deletedBy', work_minutes: 'workMinutes', started_by: 'startedBy',
})
assert.equal(typeof routeRegistry['job-tickets'], 'function')
assert.strictEqual((await routeRegistry['job-tickets']()).collection, jobTicketRoutes.collection)
assert.strictEqual((await routeRegistry['job-tickets']()).item, jobTicketRoutes.item)

function request(id: string): ApiHandlerRequest {
  return {
    method: 'POST', query: {}, body: {
      laundryItemId: 'tag-1', department: 'Washing', scannedBy: 'staff-1',
    }, headers: {}, staff: { staffId: 'session-staff', email: 'staff@test', name: 'Staff', role: 'staff' as const }, params: { id },
  }
}

const startMethods = jobTicketStartService as unknown as {
  startOrder: (payload: unknown) => Promise<unknown>
}
const originalStart = startMethods.startOrder
const advanceMethods = jobTicketAdvanceService as unknown as { advance: (payload: unknown) => Promise<unknown> }
const originalAdvance = advanceMethods.advance
const originalReopen = jobTicketReopenService.reopen
const originalComplete = jobTicketCompleteService.completeOrder
const originalDepartmentWork = jobTicketDepartmentWorkService.list
const originalGetById = jobTicketService.getById
let completeCalls = 0
jobTicketCompleteService.completeOrder = async (payload, actor) => {
  completeCalls += 1
  assert.deepEqual(payload, { orderId: '123', department: 'Packaging', scannedBy: 'forged' })
  assert.equal(actor, 'admin-id')
  return { kind: 'completed', completed: [], scannedBy: actor }
}
try {
  let departmentCalls = 0
  jobTicketDepartmentWorkService.list = async query => {
    departmentCalls += 1
    assert.deepEqual(query, { department: 'Washing', id: 'department-work' })
    return []
  }
  const departmentResult = await jobTicketRoutes.item!.handleRequest({ ...request('department-work'), method: 'GET', query: { department: 'Washing', id: 'department-work' } })
  assert.equal(departmentResult.status, 200)
  assert.deepEqual((departmentResult.body as { data: unknown }).data, [])
  assert.equal(departmentCalls, 1)
  let getByIdCalls = 0
  jobTicketService.getById = async id => {
    getByIdCalls += 1
    assert.equal(id, 'ticket-1')
    return { id } as Awaited<ReturnType<typeof jobTicketService.getById>>
  }
  const detailResult = await jobTicketRoutes.item!.handleRequest({ ...request('ticket-1'), method: 'GET' })
  assert.equal(detailResult.status, 200)
  assert.deepEqual((detailResult.body as { data: unknown }).data, { id: 'ticket-1' })
  assert.equal(getByIdCalls, 1)
  assert.equal(departmentCalls, 1)
  const completeRequest = { ...request('complete-order'), body: { orderId: '123', department: 'Packaging', scannedBy: 'forged' } }
  assert.equal((await jobTicketRoutes.item!.handleRequest(completeRequest)).status, 403)
  assert.equal((await jobTicketRoutes.item!.handleRequest({ ...completeRequest,
    staff: { staffId: 'staff-id', role: 'staff', email: 'staff@example.com', name: 'Staff' } })).status, 403)
  assert.equal(completeCalls, 0, 'non-admins never reach the write service')
  const adminRequest = { ...completeRequest, staff: { staffId: 'admin-id', role: 'admin' as const, email: 'admin@example.com', name: 'Admin' } }
  assert.equal((await jobTicketRoutes.item!.handleRequest(adminRequest)).status, 200)
  assert.equal(completeCalls, 1)
  for (const [certainty, status] of [['rejected', 502], ['unknown', 500]] as const) {
    jobTicketCompleteService.completeOrder = async () => ({ kind: 'write_failed', certainty })
    assert.equal((await jobTicketRoutes.item!.handleRequest(adminRequest)).status, status)
  }
  for (const endpoint of ['complete-order', 'reopen']) {
    let calls = 0
    const respond = async (_payload: unknown, actor: string) => {
      calls++
      assert.equal(actor, 'AI')
      return { kind: 'completed' as const, completed: [], scannedBy: actor, results: [], voidsWritten: [] }
    }
    jobTicketCompleteService.completeOrder = respond
    jobTicketReopenService.reopen = respond
    const aiRequest = { ...request(endpoint), body: { orderId: 'o1', department: 'Washing', ticketIds: ['t1'], reason: 'redo' },
      staff: { staffId: 'AI', role: 'staff' as const, name: 'AI', email: 'ai@test' } }
    const result = await jobTicketRoutes.item!.handleRequest(aiRequest)
    assert.equal(result.status, 200)
    assert.equal((result.body as { kind: string }).kind, 'completed')
    assert.equal(calls, 1)
    assert.equal((await jobTicketRoutes.item!.handleRequest({ ...aiRequest, staff: undefined })).status, 403)
    assert.equal((await jobTicketRoutes.item!.handleRequest({ ...aiRequest, staff: { ...aiRequest.staff, staffId: 'other' } })).status, 403)
  }
  for (const [certainty, status] of [['rejected', 502], ['unknown', 500]] as const) {
    jobTicketReopenService.reopen = async () => ({ kind: 'write_failed', certainty, results: [], voidsWritten: [] })
    assert.equal((await jobTicketRoutes.item!.handleRequest({ ...adminRequest, params: { id: 'reopen' } })).status, status)
  }
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('scan'))).status, 404)

  startMethods.startOrder = async () => ({ kind: 'completed', advanced: [], blocked: [], skippedWithoutTag: 0 })
  const started = await jobTicketRoutes.item!.handleRequest(request('start-order'))
  assert.equal(started.status, 200)
  assert.equal((started.body as { kind: string }).kind, 'completed')
  startMethods.startOrder = async () => ({ kind: 'write_failed', certainty: 'rejected', blocked: [], skippedWithoutTag: 0 })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('start-order'))).status, 502)
  startMethods.startOrder = async () => ({ kind: 'write_failed', certainty: 'unknown', blocked: [], skippedWithoutTag: 0 })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('start-order'))).status, 500)

  advanceMethods.advance = async () => ({ kind: 'completed', advanced: [], blocked: [], skipped: [], scoreFailed: 0 })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('advance'))).status, 200)
  advanceMethods.advance = async () => ({ kind: 'write_failed', certainty: 'rejected', blocked: [], skipped: [] })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('advance'))).status, 502)
  advanceMethods.advance = async () => ({ kind: 'write_failed', certainty: 'unknown', blocked: [], skipped: [] })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('advance'))).status, 500)

  const missing = await jobTicketRoutes.item!.handleRequest(request('other'))
  assert.equal(missing.status, 404)
} finally {
  jobTicketDepartmentWorkService.list = originalDepartmentWork
  jobTicketService.getById = originalGetById
  jobTicketReopenService.reopen = originalReopen
  jobTicketCompleteService.completeOrder = originalComplete
  startMethods.startOrder = originalStart
  advanceMethods.advance = originalAdvance
}

console.log('job-ticket module dry test passed')
