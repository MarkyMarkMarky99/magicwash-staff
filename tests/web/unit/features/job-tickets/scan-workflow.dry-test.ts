import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import type { JobTicketDto, JobTicketScanResult } from '@/data/job-tickets/job-ticket.service'
import { scanJobTicket } from '@/data/job-tickets/job-ticket.service'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { completionPercentage, countDepartmentStatuses } from '@/features/job-tickets/department-work'
import { createTagScanGuard, presentScanResult } from '@/features/job-tickets/scan-result'

const row: JobTicketDto = {
  id: 'WSH-order-1-tag-1', orderId: 'order-1', laundryItemId: 'tag-1', scope: 'ITEM', serviceType: 'WASH',
  department: 'Washing', stepNo: 1, customerId: 'customer-1', orderName: null, dueDate: null,
  specialInstructions: null, notes: null, status: 'Pending', startedAt: null, completedAt: null,
  scannedBy: null, photoEvidenceUrl: null, createdAt: null, createdBy: null, updatedAt: null,
  updatedBy: null, deletedAt: null, deletedBy: null,
}
const payload = { laundryItemId: 'tag-1', department: 'Washing', scannedBy: 'staff-1' } as const
const originalFetch = globalThis.fetch
let response: JobTicketScanResult = {
  kind: 'advanced', ticketId: row.id, status: 'In Progress', startedAt: '2026-09-23T09:00:00+07:00', completedAt: null,
}
let responseStatus = 200
const requests: Array<{ url: string; method: string; body: unknown }> = []

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  requests.push({ url: String(input), method: init?.method ?? 'GET', body: JSON.parse(String(init?.body)) })
  return new Response(JSON.stringify(response), { status: responseStatus, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

try {
  setActivePinia(createPinia())
  const store = useJobTicketStore()
  store.tickets = [row]
  const loadedRow = store.tickets[0]

  assert.deepEqual(await store.scan(payload), response)
  assert.equal(requests[0]?.url, '/api/job-tickets/scan')
  assert.equal(requests[0]?.method, 'POST')
  assert.deepEqual(requests[0]?.body, payload)
  assert.equal(store.tickets[0], loadedRow)
  assert.equal(loadedRow?.status, 'In Progress')
  assert.equal(loadedRow?.startedAt, '2026-09-23T09:00:00+07:00')
  assert.equal(loadedRow?.completedAt, null)
  assert.equal(loadedRow?.scannedBy, 'staff-1')
  assert.deepEqual(countDepartmentStatuses(store.tickets), { ALL: 1, PENDING: 0, 'IN PROGRESS': 1, COMPLETED: 0 })
  assert.deepEqual(presentScanResult(response), { tone: 'success', message: 'รับงานแล้ว' })

  response = { kind: 'advanced', ticketId: row.id, status: 'Completed', startedAt: '2026-09-23T09:00:00+07:00', completedAt: '2026-09-23T09:10:00+07:00' }
  assert.deepEqual(await store.scan(payload), response)
  assert.equal(store.tickets[0], loadedRow)
  assert.equal(store.tickets.length, 1)
  assert.equal(loadedRow?.status, 'Completed')
  assert.equal(loadedRow?.completedAt, '2026-09-23T09:10:00+07:00')
  assert.equal(completionPercentage(store.tickets), 100)
  assert.deepEqual(presentScanResult(response), { tone: 'success', message: 'เสร็จแล้ว' })

  const outcomes: Array<{ result: JobTicketScanResult; status: number; tone: string; message: string }> = [
    { result: { kind: 'already_completed', ticketId: row.id }, status: 200, tone: 'warning', message: 'งานนี้เสร็จไปแล้ว' },
    { result: { kind: 'not_found', laundryItemId: 'tag-1', department: 'Washing' }, status: 404, tone: 'error', message: 'ไม่พบงานของแท็กนี้ในแผนกนี้' },
    { result: { kind: 'blocked', laundryItemId: 'tag-1', department: 'Washing', blockedByDepartment: 'DryCleaning' }, status: 409, tone: 'error', message: 'ยังทำไม่ได้: แผนก ซักแห้ง ยังไม่เสร็จ' },
    { result: { kind: 'not_advanceable', ticketId: row.id, status: 'Cancelled' }, status: 409, tone: 'error', message: 'ยังดำเนินการไม่ได้: สถานะ ยกเลิก' },
    { result: { kind: 'write_failed', ticketId: row.id, certainty: 'rejected' }, status: 502, tone: 'error', message: 'บันทึกไม่สำเร็จ' },
    { result: { kind: 'write_failed', ticketId: row.id, certainty: 'unknown' }, status: 500, tone: 'error', message: 'บันทึกไม่สำเร็จ กรุณาตรวจสอบก่อนสแกนซ้ำ' },
  ]
  for (const outcome of outcomes) {
    response = outcome.result
    responseStatus = outcome.status
    assert.deepEqual(await store.scan(payload), outcome.result)
    assert.deepEqual(presentScanResult(outcome.result), { tone: outcome.tone, message: outcome.message })
    assert.equal(store.tickets[0], loadedRow)
    assert.equal(loadedRow?.status, 'Completed')
  }
  await assert.rejects(() => scanJobTicket({ ...payload, scannedBy: ' ' }))
  assert.equal(requests.length, 8)
  store.$dispose()

  const guard = createTagScanGuard()
  let release: (() => void) | undefined
  const waiting = new Promise<void>(resolve => { release = resolve })
  let sends = 0
  const first = guard('tag-1', async () => { sends += 1; await waiting })
  assert.equal(await guard('tag-1', async () => { sends += 1 }), false)
  assert.equal(await guard('tag-2', async () => { sends += 1 }), true)
  assert.equal(sends, 2)
  release?.()
  assert.equal(await first, true)
  assert.equal(await guard('tag-1', async () => { sends += 1 }), true)
  assert.equal(sends, 3)
  await assert.rejects(() => guard('tag-3', async () => { throw new Error('offline') }))
  assert.equal(await guard('tag-3', async () => { sends += 1 }), true)
  assert.equal(sends, 4)

  console.log('scan-workflow.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}
