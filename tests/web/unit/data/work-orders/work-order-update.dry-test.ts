import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { updateWorkOrder, type WorkOrderListDto } from '@/data/work-orders/work-order.service'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { useCustomerOrdersStore } from '@/data/orders/order.store'

const originalFetch = globalThis.fetch
const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = []
const row: WorkOrderListDto = {
  orderId: 'order/1', customerId: 'CUS-1', orderNumber: null, invoiceNumber: null,
  receivedDate: '2026-09-22', dueDate: '2026-09-24', serviceType: 'WSIR',
  status: 'PENDING', quantity: 2, note: null,
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  if (!init?.method) return new Response(JSON.stringify({ data: [row], meta: { pagination: { page: 1, perPage: 500 } } }), { status: 200 })
  calls.push({ url: String(input), method: init.method, body: JSON.parse(String(init.body)) })
  return new Response(JSON.stringify({
    data: {
      ...row, status: 'APPROVED', receivedDate: '2026-09-23', quantity: 3,
      ticketProvisioning: { ticketsCreated: 2, skippedGarments: [], failure: null },
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

try {
  setActivePinia(createPinia())
  const store = useWorkOrderStore()
  const customerStore = useCustomerOrdersStore()
  await customerStore.load('CUS-1')
  store.orders = [row]
  const updated = await store.update(row.orderId, {
    status: 'APPROVED', receivedDate: '2026-09-23', quantity: 3,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, '/api/work-orders/order%2F1')
  assert.equal(calls[0]?.method, 'PATCH')
  assert.deepEqual(calls[0]?.body, {
    status: 'APPROVED', receivedDate: '2026-09-23', quantity: 3, updatedBy: 'admin',
  })
  customerStore.applyPersisted(updated)
  assert.equal(updated.ticketProvisioning.ticketsCreated, 2)
  assert.equal(customerStore.items[0]?.status, 'APPROVED')
  assert.equal(store.orders[0]?.status, 'APPROVED')
  assert.equal(store.orders[0]?.quantity, 3)
  assert.equal(store.orders[0]?.receivedDate, '2026-09-23')
  await assert.rejects(() => updateWorkOrder(row.orderId, {}))
  assert.equal(calls.length, 1)
  console.log('work-order-update.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}