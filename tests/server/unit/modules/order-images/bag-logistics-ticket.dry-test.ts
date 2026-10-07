import assert from 'node:assert/strict'
import type { z } from 'zod'
import { BagLogisticsTicketService } from '../../../../../server/modules/order-images/bag-logistics-ticket.service.js'
import { OrderImageService } from '../../../../../server/modules/order-images/order-image.module.js'
import type { orderImageResponseSchema } from '../../../../../contracts/order-images/order-image-api.schema.js'
import type { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import type { orderImagesRowSchema } from '../../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'

const image: z.infer<typeof orderImageResponseSchema> = {
  orderImageId: 'bag-1', orderId: 'order-1', customerId: null, deliveryId: null,
  imageType: 'WEIGHT', imagePath: 'https://example.com/bag.jpg', notes: 'image note', quantity: 2.5,
  createdAt: '2026-10-08 10:00:00', createdBy: 'staff-1',
}
const rows: Array<Partial<z.infer<typeof jobTicketsRowSchema>>> = []
let headerReads = 0
const service = new BagLogisticsTicketService({
  orderFormRepository: () => ({ async read(query) {
    assert.deepEqual(query, { id: 'order-1' })
    headerReads++
    return [{ customer_id: ' customer-1 ', order_name: 'Laundry', due_date: '2026-10-09', note: 'header note' }]
  } }),
  jobTicketRepository: () => ({ async read(query) {
    assert.deepEqual(query, { id: 'LOG-order-1-bag-1-LOG-BAG' })
    return rows
  }, async batchAppend(tickets) { rows.push(...tickets); return tickets } }),
})
await service.provision(image)
assert.deepEqual(rows, [{
  id: 'LOG-order-1-bag-1-LOG-BAG', order_id: 'order-1', laundry_item_id: '', scope: 'ORDER',
  task_code: 'LOG-BAG', department: 'Logistics', step_no: 0, customer_id: 'customer-1',
  order_name: 'Laundry', due_date: '2026-10-09', notes: 'header note', special_instructions: null,
  status: 'Pending', started_at: null, completed_at: null, scanned_by: null,
  photo_evidence_url: image.imagePath, created_by: 'staff-1', updated_by: 'staff-1', work_minutes: null,
}])
await service.provision(image)
assert.equal(rows.length, 1)
assert.equal(headerReads, 1)

const missingHeader = new BagLogisticsTicketService({
  orderFormRepository: () => ({ async read() { return [] } }),
  jobTicketRepository: () => ({ async read() { return [] }, async batchAppend(tickets) {
    assert.equal(tickets[0]?.customer_id, '')
    assert.equal(tickets[0]?.order_name, null)
    assert.equal(tickets[0]?.due_date, null)
    assert.equal(tickets[0]?.notes, null)
    return tickets
  } }),
})
await missingHeader.provision(image)

const calls: string[] = []
const repository: SheetRepositoryContract<z.infer<typeof orderImagesRowSchema>> = {
  async read() { throw new Error('unexpected read') },
  async append(row) { calls.push('save'); return { id: image.orderImageId, order_id: image.orderId,
    customer_id: null, delivery_id: null, image_type: 'WEIGHT', image_path: image.imagePath,
    notes: null, quantity: image.quantity, created_at: image.createdAt, created_by: image.createdBy, ...row } },
  async batchAppend() { throw new Error('unexpected batch') },
  async update() { throw new Error('unexpected update') },
  async delete() { throw new Error('unexpected delete') },
}
let fail = false
const logs: unknown[][] = []
const originalError = console.error
try {
  console.error = (...args) => logs.push(args)
  const saver = new OrderImageService({ repository,
    weightPhotoTicketService: { async provision() { calls.push('weight') } },
    bagLogisticsTicketService: { async provision(saved) { assert.equal(saved.orderImageId, image.orderImageId); calls.push('logistics'); if (fail) throw new Error('failed') } },
    bagTagPrintService: { async print() { calls.push('print') } },
  })
  const payload = { orderId: image.orderId, imageType: 'WEIGHT', imagePath: image.imagePath, quantity: 2.5, createdBy: 'staff-1' }
  const saved = await saver.create(payload)
  assert.deepEqual(calls, ['save', 'weight', 'logistics', 'print'])
  calls.length = 0
  fail = true
  assert.deepEqual(await saver.create(payload), saved)
  assert.deepEqual(calls, ['save', 'weight', 'logistics', 'print'])
  assert.equal(logs[0]?.[0], 'Failed to provision bag logistics ticket')
  calls.length = 0
  await saver.create({ ...payload, imageType: 'DELIVERY', quantity: null })
  assert.deepEqual(calls, ['save'])
} finally { console.error = originalError }
console.log('bag logistics ticket dry test passed')
