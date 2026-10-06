import assert from 'node:assert/strict'
import type { z } from 'zod'
import { OrderImageService } from '../../../../../server/modules/order-images/order-image.module.js'
import { WeightPhotoTicketService } from '../../../../../server/modules/order-images/weight-photo-ticket.service.js'
import { resetWorkRatesCache } from '../../../../../server/modules/work-orders/work-rate-lookup.js'
import type { orderImagesRowSchema } from '../../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import type { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import type { workTransactionsRowSchema } from '../../../../../server/sheets/WorkTransactions/WorkTransactions.db-contract.js'
import { WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'
import { buildRowValues } from '../../../../../server/shared/repositories/sheet-value-serializer.js'

type ImageRow = z.infer<typeof orderImagesRowSchema>
type TicketRow = z.infer<typeof jobTicketsRowSchema>
type EarnRow = z.infer<typeof workTransactionsRowSchema>
const payload = { orderId: 'order-1', imageType: 'WEIGHT', imagePath: 'https://example.test/weight.jpg', quantity: 8.7, createdBy: ' photographer-1 ' }

function fixture(options: { active?: boolean; rate?: boolean; department?: 'Packaging' | 'Washing'; ticketError?: Error; earnError?: Error; existing?: boolean; quantity?: number | null; timestamp?: string; imageError?: Error; staffError?: Error; minutes?: number } = {}) {
  resetWorkRatesCache()
  const tickets: Array<Partial<TicketRow>> = []
  const earns: Array<Partial<EarnRow>> = []
  const events: string[] = []
  const saved: ImageRow = {
    id: 'image-1', order_id: 'order-1', customer_id: null, delivery_id: null,
    image_type: 'WEIGHT', image_path: payload.imagePath, notes: null, quantity: 8.7,
    created_at: options.timestamp ?? '2026-10-07 10:20:30', created_by: 'photographer-1',
  }
  const service = new OrderImageService({
    repository: {
      async read() { return [] },
      async append(row) {
        events.push('image')
        if (options.imageError) throw options.imageError
        Object.assign(saved, row)
        if ('quantity' in options) saved.quantity = options.quantity ?? null
        return saved
      },
      async batchAppend() { throw new Error('unused') },
      async update() { throw new Error('unused') },
      async delete() { throw new Error('unused') },
    },
    weightPhotoTicketService: new WeightPhotoTicketService({
      orderFormRepository: () => ({ async read(query) {
        assert.equal(query?.id, 'order-1')
        return [{ customer_id: ' customer-1 ', order_name: 'Order one', due_date: '2026-10-09', note: 'Rush' }]
      } }),
      jobTicketRepository: () => ({
        async read(query) {
          events.push('ticket-read')
          assert.equal(query?.id, 'PCK-order-1-image-1-PCK-WEIGHT-KG')
          return options.existing ? [{ id: query!.id!, laundry_item_id: null, scope: 'ORDER' }] : []
        },
        async batchAppend(rows) {
          events.push('ticket')
          tickets.push(...rows)
          if (options.ticketError) throw options.ticketError
          return rows
        },
      }),
      workRateRepository: () => ({ async read() {
        return options.rate === false ? [] : [{ task_code: 'PCK-WEIGHT-KG', department: options.department ?? 'Packaging', active: true, minutes: options.minutes ?? 2 }]
      } }),
      staffReader: async () => {
        if (options.staffError) throw options.staffError
        return options.active === false ? new Map() : new Map([['photo@example.test', { staffId: 'photographer-1', email: 'photo@example.test', name: 'Photo', role: 'staff' as const }]])
      },
      workTransactionRepository: () => ({ async batchAppend(rows) {
        events.push('earn')
        earns.push(...rows)
        if (options.earnError) throw options.earnError
        return rows
      } }),
    }),
  })
  return { service, tickets, earns, events, saved }
}

const success = fixture()
const response = await success.service.create(payload)
assert.deepEqual(success.events, ['image', 'ticket-read', 'ticket', 'earn'])
assert.equal(response.orderImageId, 'image-1')
assert.equal(response.quantity, 8.7)
assert.deepEqual(success.tickets, [{
  id: 'PCK-order-1-image-1-PCK-WEIGHT-KG', order_id: 'order-1', laundry_item_id: '', scope: 'ORDER',
  task_code: 'PCK-WEIGHT-KG', department: 'Packaging', step_no: 0,
  customer_id: 'customer-1', order_name: 'Order one', due_date: '2026-10-09', special_instructions: null, notes: 'Rush',
  status: 'Completed', started_at: '2026-10-07 10:20:30', completed_at: '2026-10-07 10:20:30',
  scanned_by: 'photographer-1', updated_by: 'photographer-1', photo_evidence_url: payload.imagePath,
  created_by: 'photographer-1', work_minutes: 17.4,
}])
assert.equal(success.earns.length, 1)
assert.match(success.earns[0]!.id!, /^[0-9a-f]{8}$/)
assert.deepEqual({ ...success.earns[0], id: undefined }, { id: undefined, job_ticket_id: success.tickets[0]!.id, type: 'EARN', minutes: 17.4, notes: null, created_by: 'photographer-1' })
const wire = buildRowValues(success.tickets[0]!, { orderedHeaders: ['id', 'order_id', 'laundry_item_id', 'scope'], letterByName: { id: 'A', order_id: 'B', laundry_item_id: 'C', scope: 'D' }, indexByName: { id: 0, order_id: 1, laundry_item_id: 2, scope: 3 }, width: 4 }, true)
assert.deepEqual(wire, ['PCK-order-1-image-1-PCK-WEIGHT-KG', 'order-1', '', 'ORDER'])

for (const imageType of ['BELONGING', 'DOCUMENT']) {
  const f = fixture()
  await f.service.create({ ...payload, imageType, quantity: null })
  assert.deepEqual(f.events, ['image'])
  assert.equal(f.tickets.length, 0)
  assert.equal(f.earns.length, 0)
}
for (const createdBy of ['inactive-1', 'unknown', 'legacy@example.test']) {
  const f = fixture()
  await f.service.create({ ...payload, createdBy })
  assert.equal(f.tickets.length, 1)
  assert.equal(f.tickets[0]!.created_by, createdBy)
  assert.equal(f.earns.length, 0)
}
const inactive = fixture({ active: false })
await inactive.service.create(payload)
assert.equal(inactive.tickets.length, 1)
assert.equal(inactive.earns.length, 0)
const rounded = fixture({ quantity: 1.1, minutes: 20 })
await rounded.service.create(payload)
assert.equal(rounded.tickets[0]!.work_minutes, 22)
assert.equal(rounded.earns[0]!.minutes, 22)
for (const options of [{ rate: false }, { department: 'Washing' as const }, ...[null, 0, -1, NaN, Infinity].map(quantity => ({ quantity }))]) {
  const f = fixture(options)
  await f.service.create(payload)
  assert.equal(f.tickets[0]!.work_minutes, null)
  assert.equal(f.earns.length, 0)
}
const originalError = console.error
const logs: unknown[][] = []
console.error = (...args) => { logs.push(args) }
try {
  for (const options of [
    { ticketError: new WriteTransportError('APPEND', 'unknown outcome') },
    { earnError: new WriteTransportError('APPEND', 'unknown outcome') },
    { staffError: new Error('staff unavailable') },
  ]) {
    const f = fixture(options)
    assert.deepEqual(await f.service.create(payload), response)
    assert.equal(f.tickets.length, 1)
    assert.equal(f.earns.length, options.earnError ? 1 : 0)
  }
} finally { console.error = originalError }
assert.equal(logs.length, 3)
const existing = fixture({ existing: true })
assert.deepEqual(await existing.service.create(payload), response)
assert.deepEqual(existing.events, ['image', 'ticket-read'])
assert.equal(existing.tickets.length, 0)
assert.equal(existing.earns.length, 0)
const iso = fixture({ timestamp: '2026-10-07T03:20:30Z' })
await iso.service.create(payload)
assert.equal(iso.tickets[0]!.completed_at, '2026-10-07 10:20:30')
const failedImage = fixture({ imageError: new Error('image failed') })
await assert.rejects(failedImage.service.create(payload), /image failed/)
assert.deepEqual(failedImage.events, ['image'])
console.log('weight-photo-ticket.dry-test: OK')
