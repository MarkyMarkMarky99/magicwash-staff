import assert from 'node:assert/strict'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import {
  jobTicketFieldMap,
  jobTicketDepartmentWorkService,
  jobTicketService,
  jobTicketCompleteService,
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
  updated_at: 'updatedAt', updated_by: 'updatedBy', deleted_at: 'deletedAt', deleted_by: 'deletedBy', work_minutes: 'workMinutes',
})
assert.equal(typeof routeRegistry['job-tickets'], 'function')
assert.strictEqual((await routeRegistry['job-tickets']()).collection, jobTicketRoutes.collection)

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
  jobTicketCompleteService.completeOrder = originalComplete
  startMethods.startOrder = originalStart
  advanceMethods.advance = originalAdvance
}

console.log('job-ticket module dry test passed')
