import assert from 'node:assert/strict'
import type { WorkOrderDetailDto } from '../../../../../src/data/work-orders/work-order.service'
import { createLaundryTagPrintRequest } from '../../../../../src/data/laundry-tag-prints/laundry-tag-print.service'

const order = {
  quantity: 3,
  items: [],
} as WorkOrderDetailDto

const request = createLaundryTagPrintRequest(order, '1999')
assert.equal(request.customerIndex, '1999')
assert.equal(request.totalCount, 3)
assert.deepEqual(request.tags.map((tag) => tag.sequence), [1, 2, 3])
assert.equal(new Set(request.tags.map((tag) => tag.tagId)).size, 3)
assert.ok(request.tags.every((tag) => /^[0-9A-Za-z]{8}$/.test(tag.tagId)))
const adjustedRequest = createLaundryTagPrintRequest(order, '1999', 205)
assert.equal(adjustedRequest.totalCount, 205)
assert.equal(adjustedRequest.tags.length, 205)
assert.throws(() => createLaundryTagPrintRequest(order, '1999', 0))
assert.throws(() => createLaundryTagPrintRequest(order, '1999', 1000))
assert.throws(() => createLaundryTagPrintRequest({ quantity: null, items: [] } as WorkOrderDetailDto, '1999'))
assert.throws(() => createLaundryTagPrintRequest({ quantity: 0, items: [] } as WorkOrderDetailDto, '1999'))
assert.throws(() => createLaundryTagPrintRequest({ quantity: 1.5, items: [] } as WorkOrderDetailDto, '1999'))

console.log('laundry tag print service dry tests passed')
