import assert from 'node:assert/strict'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import {
  jobTicketFieldMap,
  jobTicketAdvanceService,
  jobTicketRoutes,
  jobTicketScanService,
  jobTicketStartService,
} from '../../../../../server/modules/job-tickets/job-ticket.module.js'
import { routeRegistry } from '../../../../../server/api/route-registry.js'

assert.deepEqual(jobTicketFieldMap, {
  id: 'id', order_id: 'orderId', laundry_item_id: 'laundryItemId', scope: 'scope',
  service_type: 'serviceType', department: 'department', step_no: 'stepNo',
  customer_id: 'customerId', order_name: 'orderName', due_date: 'dueDate',
  special_instructions: 'specialInstructions', notes: 'notes', status: 'status',
  started_at: 'startedAt', completed_at: 'completedAt', scanned_by: 'scannedBy',
  photo_evidence_url: 'photoEvidenceUrl', created_at: 'createdAt', created_by: 'createdBy',
  updated_at: 'updatedAt', updated_by: 'updatedBy', deleted_at: 'deletedAt', deleted_by: 'deletedBy',
})
assert.equal(typeof routeRegistry['job-tickets'], 'function')
assert.strictEqual((await routeRegistry['job-tickets']()).collection, jobTicketRoutes.collection)

function request(id: string): ApiHandlerRequest {
  return {
    method: 'POST', query: {}, body: {
      laundryItemId: 'tag-1', department: 'Washing', scannedBy: 'staff-1',
    }, headers: {}, params: { id },
  }
}

const scanMethods = jobTicketScanService as unknown as {
  scan: (payload: unknown) => Promise<unknown>
}
const originalScan = scanMethods.scan
const startMethods = jobTicketStartService as unknown as {
  startOrder: (payload: unknown) => Promise<unknown>
}
const originalStart = startMethods.startOrder
const advanceMethods = jobTicketAdvanceService as unknown as { advance: (payload: unknown) => Promise<unknown> }
const originalAdvance = advanceMethods.advance
try {
  scanMethods.scan = async () => ({
    kind: 'blocked', laundryItemId: 'tag-1', department: 'Washing', blockedByDepartment: 'Tagging',
  })
  const blocked = await jobTicketRoutes.item!.handleRequest(request('scan'))
  assert.equal(blocked.status, 409)
  assert.equal((blocked.body as { kind: string }).kind, 'blocked')

  scanMethods.scan = async () => ({
    kind: 'not_advanceable', ticketId: 'ticket-1', status: 'Cancelled',
  })
  const notAdvanceable = await jobTicketRoutes.item!.handleRequest(request('scan'))
  assert.equal(notAdvanceable.status, 409)
  assert.deepEqual(notAdvanceable.body, {
    kind: 'not_advanceable', ticketId: 'ticket-1', status: 'Cancelled',
  })

  scanMethods.scan = async () => ({
    kind: 'write_failed', ticketId: 'ticket-1', certainty: 'unknown',
  })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('scan'))).status, 500)

  startMethods.startOrder = async () => ({ kind: 'completed', advanced: [], blocked: [], skippedWithoutTag: 0 })
  const started = await jobTicketRoutes.item!.handleRequest(request('start-order'))
  assert.equal(started.status, 200)
  assert.equal((started.body as { kind: string }).kind, 'completed')
  startMethods.startOrder = async () => ({ kind: 'write_failed', certainty: 'rejected', blocked: [], skippedWithoutTag: 0 })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('start-order'))).status, 502)
  startMethods.startOrder = async () => ({ kind: 'write_failed', certainty: 'unknown', blocked: [], skippedWithoutTag: 0 })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('start-order'))).status, 500)

  advanceMethods.advance = async () => ({ kind: 'completed', advanced: [], blocked: [], skipped: [] })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('advance'))).status, 200)
  advanceMethods.advance = async () => ({ kind: 'write_failed', certainty: 'rejected', blocked: [], skipped: [] })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('advance'))).status, 502)
  advanceMethods.advance = async () => ({ kind: 'write_failed', certainty: 'unknown', blocked: [], skipped: [] })
  assert.equal((await jobTicketRoutes.item!.handleRequest(request('advance'))).status, 500)

  const missing = await jobTicketRoutes.item!.handleRequest(request('other'))
  assert.equal(missing.status, 404)
} finally {
  scanMethods.scan = originalScan
  startMethods.startOrder = originalStart
  advanceMethods.advance = originalAdvance
}

console.log('job-ticket module dry test passed')
