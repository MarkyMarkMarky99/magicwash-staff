import assert from 'node:assert/strict'
import type { z } from 'zod'
import type { orderIntakeCreateSchema } from '../../../../../contracts/order-intakes/order-intake-api.schema.js'
import { OrderIntakeService, type OrderIntakeDependencies } from '../../../../../server/modules/order-intakes/order-intake.service.js'
import { createOrderIntakeRoutes } from '../../../../../server/modules/order-intakes/order-intake.module.js'
import { resetWorkRatesCache } from '../../../../../server/modules/work-orders/work-rate-lookup.js'

export function intakePayload(count = 10): z.infer<typeof orderIntakeCreateSchema> {
  const items = ['item0001', 'item0002', 'item0003'].map(itemId => ({ itemId, tags: [] as string[] }))
  for (let index = 0; index < count; index++) items[index % 3]!.tags.push(`TAG${String(index).padStart(5, '0')}`)
  return {
    customerId: 'customer-1', receivedDate: '2026-10-25', dueDate: '2026-10-27', serviceType: 'WSIR',
    orderName: 'Intake', note: 'Rush', items,
    images: [
      { imageType: 'DOCUMENT', imageUrl: 'https://firebasestorage.googleapis.com/document' },
      { imageType: 'BELONGING', imageUrl: 'https://firebasestorage.googleapis.com/belonging' },
    ],
  }
}

export function intakeFixture(payload = intakePayload(), failure?: string, untyped = true) {
  resetWorkRatesCache()
  const calls: string[] = []
  const gviz: Record<string, number> = {}
  const reads: Record<string, number> = {}
  const writes: Record<string, number> = {}
  const rows: Record<string, Array<Record<string, unknown>>> = {}
  let staffCached = false
  const registered = payload.items.flatMap(item => item.tags.map((id, index) => ({
    id, customer_id: payload.customerId, item_id: untyped && index === 0 ? null : item.itemId,
    image_url: `https://firebasestorage.googleapis.com/${id}`, deleted_at: null,
  })))
  const others: typeof registered = []
  const increment = (counts: Record<string, number>, sheet: string, amount = 1) => { counts[sheet] = (counts[sheet] ?? 0) + amount }
  function write(sheet: string, values: Array<Record<string, unknown>>, operation = sheet) {
    calls.push(operation)
    increment(writes, sheet)
    if (failure === operation) throw new Error(`${operation} unavailable`)
    rows[sheet] = [...(rows[sheet] ?? []), ...values]
    return values
  }
  const deps: OrderIntakeDependencies = {
    items: { async read() {
      calls.push('read Items'); increment(gviz, 'Items')
      return [{ id: 'item0001' }, { id: 'item0002' }, { id: 'item0003' }]
    } },
    laundryItems: {
      async read(query) {
        assert.deepEqual(query, { where: { customer_id: payload.customerId } })
        calls.push('read LaundryItems'); increment(gviz, 'LaundryItems')
        return registered
      },
      async updateMany(updates) {
        increment(reads, 'LaundryItems', 2)
        write('LaundryItems', updates.map(update => ({ id: update.keyValue, ...update.patch })))
        return []
      },
    },
    async findTags(tags) {
      calls.push('findTags'); increment(gviz, 'LaundryItems')
      return others.filter(row => tags.includes(row.id))
    },
    orders: {
      async batchAppend(values) { write('OrderForm', values); return [] },
      async update(id, patch) {
        increment(reads, 'OrderForm', 2)
        write('OrderForm', [{ id, ...patch }], 'OrderForm status')
        return { id, ...patch } as Awaited<ReturnType<OrderIntakeDependencies['orders']['update']>>
      },
    },
    lines: { async batchAppend(values) { write('OrderItemForms', values); return [] } },
    garments: { async batchAppend(values) { write('OrderGarments', values); return [] } },
    images: { async batchAppend(values) { write('OrderImages', values); return [] } },
    jobTickets: { async batchAppend(values) { write('JobTickets', values); return [] } },
    workTransactions: { async batchAppend(values) { write('WorkTransactions', values); return [] } },
    workRates: () => ({ async read() {
      calls.push('read WorkRates'); increment(gviz, 'WorkRates')
      return [{ task_code: 'TAG-PHOTO', department: 'Tagging', active: true, name_th: 'Tagging', minutes: 3 }]
    } }),
    async staff() {
      if (!staffCached) { calls.push('read Staff'); increment(reads, 'Staff'); staffCached = true }
      return new Map([['staff@example.test', { staffId: 'staff-1', email: 'staff@example.test', name: 'Staff', role: 'staff' }]])
    },
    now: () => new Date('2026-10-25T03:00:00Z'),
  }
  const service = new OrderIntakeService(deps)
  const routes = createOrderIntakeRoutes(service)
  const save = () => routes.collection!.handleRequest({
    method: 'POST', body: payload, params: {}, query: {}, headers: {},
    staff: { staffId: 'staff-1', email: 'staff@example.test', name: 'Staff', role: 'staff' },
  })
  return { deps, service, save, registered, others, calls, gviz, reads, writes, rows }
}
