import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { createPinia, setActivePinia } from 'pinia'
import { listWorkOrders, type WorkOrderListDto } from '@/data/work-orders/work-order.service'
import { useWorkOrderStore } from '@/data/work-orders/work-order.store'
import { writeCache } from '@/shared/api/response-cache'
import type { ListResult } from '@/shared/api/api-client'

test('shows cached lists and applies fresh items and pagination only for the latest request', async () => {
  const originalFetch = globalThis.fetch
  const pending = new Map<string, (response: Response) => void>()
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useWorkOrderStore()
  const row: WorkOrderListDto = {
    orderId: 'ORD-1', customerId: 'CUS-1', orderNumber: null, invoiceNumber: null,
    receivedDate: '2026-10-05', dueDate: null, serviceType: 'WSIR',
    status: 'PENDING', quantity: 2, note: null,
  }
  function result(orderId: string, total: number): ListResult<WorkOrderListDto> {
    return {
      items: [{ ...row, orderId }],
      pagination: { page: 1, perPage: 500, total, totalPages: 1 },
    }
  }
  globalThis.fetch = ((input: string | URL | Request) => new Promise<Response>((resolve) => {
    pending.set(new URL(String(input), 'http://localhost').searchParams.get('date')!, resolve)
  })) as typeof fetch
  try {
    const cachedOld = result('cached-old', 1)
    const cachedLatest = result('cached-latest', 2)
    for (const [date, cached] of [['2026-10-05', cachedOld], ['2026-10-04', cachedLatest]] as const) {
      writeCache(`/api/work-orders?date=${date}&page=1&perPage=500&sortBy=receivedDate&sortOrder=desc`, cached)
    }
    await store.loadList({ date: '2026-10-05' })
    assert.deepEqual(store.orders, cachedOld.items)
    assert.deepEqual(store.pagination, cachedOld.pagination)
    await store.loadList({ date: '2026-10-04' })
    assert.deepEqual(store.orders, cachedLatest.items)
    assert.deepEqual(store.pagination, cachedLatest.pagination)
    await setImmediate()
    assert.equal(pending.size, 2)

    const freshLatest = result('fresh-latest', 3)
    pending.get('2026-10-04')!(new Response(JSON.stringify({
      data: freshLatest.items, meta: { pagination: freshLatest.pagination },
    }), { status: 200 }))
    await listWorkOrders({ date: '2026-10-04' })
    await setImmediate()
    assert.deepEqual(store.orders, freshLatest.items)
    assert.deepEqual(store.pagination, freshLatest.pagination)

    const freshOld = result('fresh-old', 4)
    pending.get('2026-10-05')!(new Response(JSON.stringify({
      data: freshOld.items, meta: { pagination: freshOld.pagination },
    }), { status: 200 }))
    await listWorkOrders({ date: '2026-10-05' })
    await setImmediate()
    assert.deepEqual(store.orders, freshLatest.items)
    assert.deepEqual(store.pagination, freshLatest.pagination)
    assert.equal(store.listLoading, false)
    assert.equal(store.listError, null)
  } finally {
    store.$dispose()
    globalThis.fetch = originalFetch
  }
})
