import assert from 'node:assert/strict'
import type { z } from 'zod'
import { OrderItemService } from '../../../../../server/modules/order-items/order-item.module.js'
import { orderItemFormsRowSchema } from '../../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import type { SheetBatchUpdateContract, SheetRepositoryContract, SheetRowUpdate } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

type ItemRow = z.infer<typeof orderItemFormsRowSchema>
const row = (id: string, quantity: number): ItemRow => ({
  id, order_id: 'order-1', item_id: null, description: null, quantity, price: null,
  credits_used: null, timestamp: null, category: null, service_type: null,
  special_instructions: null, created_by: null, updated_at: null, updated_by: 'staff-1', invoice_item_id: null,
})
const batches: Array<ReadonlyArray<SheetRowUpdate<ItemRow>>> = []
const singles: Array<[string, Partial<ItemRow>]> = []
let rejectBatch = false
const repository = {
  async read() { return [] },
  async append(): Promise<ItemRow> { throw new Error('not used') },
  async batchAppend(): Promise<ItemRow[]> { throw new Error('not used') },
  async update(id: string, patch: Partial<ItemRow>) {
    singles.push([id, patch])
    return { ...row(id, patch.quantity ?? 1), ...patch }
  },
  async updateMany(updates: ReadonlyArray<SheetRowUpdate<ItemRow>>) {
    batches.push(updates)
    if (rejectBatch) throw new Error('batch rejected')
    return updates.map(({ keyValue, patch }) => ({ ...row(keyValue, patch.quantity ?? 1), ...patch }))
  },
  async delete(): Promise<ItemRow> { throw new Error('not used') },
} satisfies SheetRepositoryContract<ItemRow> & SheetBatchUpdateContract<ItemRow>
const service = new OrderItemService({ repository })

const updated = await service.update(' item-1 ', { quantity: 3, updatedBy: ' staff-1 ' })
assert.deepEqual(singles, [['item-1', { quantity: 3, updated_by: 'staff-1' }]])
assert.equal(updated.quantity, 3)
assert.equal(updated.orderItemId, 'item-1')

const result = await service.reassignQuantities({
  items: [{ orderItemId: ' item-1 ', quantity: 2 }, { orderItemId: 'item-2', quantity: 4 }],
  updatedBy: ' staff-1 ',
})
assert.deepEqual(batches, [[
  { keyValue: 'item-1', patch: { quantity: 2, updated_by: 'staff-1' } },
  { keyValue: 'item-2', patch: { quantity: 4, updated_by: 'staff-1' } },
]])
assert.deepEqual(result.items.map(item => item.quantity), [2, 4])

await assert.rejects(
  () => service.reassignQuantities({ items: [{ orderItemId: 'item-1', quantity: 2 }, { orderItemId: ' item-1 ', quantity: 3 }], updatedBy: 'staff-1' }),
  (error: unknown) => error instanceof ApiError && error.status === 422,
)
assert.equal(batches.length, 1)

rejectBatch = true
await assert.rejects(
  () => service.reassignQuantities({ items: [{ orderItemId: 'item-1', quantity: 5 }], updatedBy: 'staff-1' }),
  /batch rejected/,
)
assert.equal(batches.length, 2)

console.log('order-item reassign dry test passed')
