import assert from 'node:assert/strict'
import { readCache, writeCache } from '@/shared/api/response-cache'
import { cachePolicyFor } from '@/shared/config/cache'
import { createWorkOrder, updateWorkOrder } from '@/data/work-orders/work-order.service'

assert.deepEqual(cachePolicyFor('/api/order-reports?period=week&date=2026-10-05'), { cacheable: true, hours: 1, persist: false })

const originalFetch = globalThis.fetch
globalThis.fetch = (async () =>
  new Response(JSON.stringify({ success: true, data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch

const reportUrl = '/api/order-reports?period=week&date=2026-10-05'

try {
  writeCache(reportUrl, { stale: true })
  writeCache('/api/order-images', ['untouched'])
  assert.ok(readCache(reportUrl))

  await updateWorkOrder('ORD-1', { status: 'APPROVED' })
  assert.equal(readCache(reportUrl), null, 'updating an order clears the report')
  assert.ok(readCache('/api/order-images'), 'and leaves an unrelated endpoint cached')

  writeCache(reportUrl, { stale: true })
  await createWorkOrder({
    customerId: 'CUS-1',
    serviceType: 'WSIR',
    receivedDate: '2026-10-05',
    dueDate: '2026-10-07',
    quantity: 1,
    createdBy: 'dry-test',
  } as Parameters<typeof createWorkOrder>[0])
  assert.equal(readCache(reportUrl), null, 'creating an order clears the report')

  console.log('work-order-report-invalidation.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}
