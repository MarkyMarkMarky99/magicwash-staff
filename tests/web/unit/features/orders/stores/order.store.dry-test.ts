import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { invalidate } from '@/shared/api/response-cache'
import { useOrderStore } from '@/features/orders/stores/order.store'
import type { WorkOrderListDto } from '@/features/orders/services/work-order.service'

// Seeding the detail from an already-loaded list row is what lets the order page paint its header
// instead of holding a full-page skeleton. The three things that can go wrong: showing the
// previous order's header while a new one loads, flashing an empty item list over a refresh of an
// order already open, and leaving a seed on screen when the request fails.

const listRow = (orderId: string, overrides: Partial<WorkOrderListDto> = {}): WorkOrderListDto => ({
  orderId, customerId: 'CUS-1', customerName: 'Customer one', orderNumber: 'ORD-1',
  invoiceNumber: null, receivedDate: '2026-09-01', dueDate: '2026-09-05', serviceType: 'WSIR',
  status: 'PENDING', quantity: 3, note: null, ...overrides,
})
const detailResponse = (orderId: string, items: unknown[]) => new Response(JSON.stringify({
  success: true,
  data: { ...listRow(orderId), createdAt: '2026-09-01 09:00:00', createdBy: 'staff-1',
    orderName: null, orderDescription: null, formImage: null, hangersImage: null,
    bagsImage: null, items },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

const originalFetch = globalThis.fetch
const pending: { url: URL; resolve: (response: Response) => void }[] = []
globalThis.fetch = ((input: string | URL | Request) => new Promise<Response>((resolve) => {
  pending.push({ url: new URL(String(input), 'http://localhost'), resolve })
})) as typeof fetch
setActivePinia(createPinia())
const store = useOrderStore()
try {
  store.orders = [listRow('order-1'), listRow('order-2', { customerName: 'Customer two' })]

  // Header fields are on screen before the request settles; items wait for the real response.
  const first = store.loadDetail('order-1')
  assert.equal(store.detailLoading, true)
  assert.equal(store.currentOrder?.orderId, 'order-1')
  assert.equal(store.currentOrder?.customerName, 'Customer one')
  assert.deepEqual(store.currentOrder?.items, [])
  pending[0]!.resolve(detailResponse('order-1', [{ orderItemId: 'item-1' }]))
  await first
  assert.equal(store.currentOrder?.items.length, 1)
  assert.equal(store.currentOrder?.createdBy, 'staff-1')
  assert.equal(store.detailLoading, false)

  // Navigating to another order must never leave the previous order's header up.
  const second = store.loadDetail('order-2')
  assert.equal(store.currentOrder?.customerName, 'Customer two')
  assert.deepEqual(store.currentOrder?.items, [])
  pending[1]!.resolve(detailResponse('order-2', [{ orderItemId: 'item-2' }]))
  await second
  assert.equal(store.currentOrder?.items.length, 1)

  // Reloading the order already on screen keeps its items rather than reseeding an empty list.
  // This is the path taken right after adding an item, where a flash back to zero is the bug.
  invalidate('/api/work-orders')
  const refresh = store.loadDetail('order-2')
  assert.equal(store.currentOrder?.items.length, 1)
  pending.at(-1)!.resolve(detailResponse('order-2', [{ orderItemId: 'item-2' }, { orderItemId: 'item-3' }]))
  await refresh
  assert.equal(store.currentOrder?.items.length, 2)

  // An order the list never loaded still gets the full-page skeleton, not a blank header.
  const unseeded = store.loadDetail('order-9')
  assert.equal(store.currentOrder, null)
  pending.at(-1)!.resolve(detailResponse('order-9', []))
  await unseeded
  assert.equal(store.currentOrder?.orderId, 'order-9')

  // A failed request clears the seed so the error message shows instead of a stale header.
  invalidate('/api/work-orders')
  const failing = store.loadDetail('order-1')
  assert.equal(store.currentOrder?.orderId, 'order-1')
  pending.at(-1)!.resolve(new Response('{"success":false,"error":{"message":"boom"}}',
    { status: 500, headers: { 'Content-Type': 'application/json' } }))
  await failing
  assert.equal(store.currentOrder, null)
  assert.ok(store.detailError)

  console.log('order.store.dry-test: OK (seed, navigate, refresh keeps items, unseeded, failure clears)')
} finally {
  globalThis.fetch = originalFetch
}
