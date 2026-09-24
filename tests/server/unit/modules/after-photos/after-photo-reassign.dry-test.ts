import assert from 'node:assert/strict'
import { AfterPhotoService } from '../../../../../server/modules/after-photos/after-photo.module.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { WriteRejectedError } from '../../../../../server/shared/repositories/sheets-api.client.js'
import type { SheetBatchUpdateContract, SheetRepositoryContract, SheetRowUpdate } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import type { z } from 'zod'
import { afterPhotoRowSchema } from '../../../../../server/sheets/AfterPhoto/AfterPhoto.db-contract.js'
import { orderItemFormsRowSchema } from '../../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'

type PhotoRow = z.infer<typeof afterPhotoRowSchema>
type ItemRow = z.infer<typeof orderItemFormsRowSchema>
const item = { id: 'item-2', order_id: 'order-1', item_id: 'catalog-2' }
const failure = new WriteRejectedError('UPDATE', 'batch rejected')

function setup(itemRows: Array<Partial<ItemRow>> = [item], reject = false) {
  const photoReads: Array<string | undefined> = []
  const itemReads: Array<string | undefined> = []
  const batches: Array<ReadonlyArray<SheetRowUpdate<PhotoRow>>> = []
  const photoRepository = {
    async read(query?: ReadQueryDTO<Partial<PhotoRow>>) {
      photoReads.push(query?.id)
      return []
    },
    async append(): Promise<PhotoRow> { throw new Error('not used') },
    async batchAppend(): Promise<PhotoRow[]> { throw new Error('not used') },
    async update(): Promise<PhotoRow> { throw new Error('not used') },
    async delete(): Promise<PhotoRow> { throw new Error('not used') },
    async updateMany(updates: ReadonlyArray<SheetRowUpdate<PhotoRow>>): Promise<PhotoRow[]> {
      batches.push(updates)
      if (reject) throw failure
      return updates.map(({ keyValue, patch }) => ({
        id: keyValue, order_id: 'order-1', orderitem_id: patch.orderitem_id ?? null,
        item_id: patch.item_id ?? null, updated_by: patch.updated_by ?? null,
        image_path: null, image_url: null, notes: null, created_at: null, created_by: null,
        updated_at: null, checked: null, is_active: null, file_id: null,
        deleted_at: null, deleted_by: null,
      }))
    },
  } satisfies SheetRepositoryContract<PhotoRow> & SheetBatchUpdateContract<PhotoRow>
  const itemRepository = {
    async read(query?: ReadQueryDTO<Partial<ItemRow>>) {
      itemReads.push(query?.id)
      return itemRows
    },
    async append(): Promise<ItemRow> { throw new Error('not used') },
    async batchAppend(): Promise<ItemRow[]> { throw new Error('not used') },
    async update(): Promise<ItemRow> { throw new Error('not used') },
    async delete(): Promise<ItemRow> { throw new Error('not used') },
  } satisfies SheetRepositoryContract<ItemRow>
  return {
    service: new AfterPhotoService({ repository: photoRepository, orderItemFormsRepository: () => itemRepository }),
    photoReads, itemReads, batches,
  }
}

const payload = { photoIds: [' photo-2 ', ' photo-1 '], orderItemId: ' item-2 ', updatedBy: ' staff-1 ' }
{
  const { service, photoReads, itemReads, batches } = setup()
  const result = await service.reassign(payload)
  assert.deepEqual(photoReads, [])
  assert.deepEqual(itemReads, ['item-2'])
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0], ['photo-2', 'photo-1'].map(keyValue => ({
    keyValue, patch: { orderitem_id: 'item-2', item_id: 'catalog-2', updated_by: 'staff-1' },
  })))
  assert.deepEqual(result.photos.map(photo => photo.afterPhotoId), ['photo-2', 'photo-1'])
  assert.deepEqual(result.photos.map(photo => photo.orderItemId), ['item-2', 'item-2'])
}

for (const [invalid, status] of [
  [{ ...payload, photoIds: [] }, 422],
  [{ ...payload, photoIds: ['photo-1', ' photo-1 '] }, 400],
] as const) {
  const { service, photoReads, itemReads, batches } = setup()
  await assert.rejects(() => service.reassign(invalid), (error: unknown) => error instanceof ApiError && error.status === status)
  assert.deepEqual(photoReads, [])
  assert.deepEqual(itemReads, [])
  assert.equal(batches.length, 0)
}
{
  const { service, photoReads, itemReads, batches } = setup([])
  await assert.rejects(() => service.reassign(payload), (error: unknown) => error instanceof ApiError && error.status === 404)
  assert.deepEqual(photoReads, [])
  assert.deepEqual(itemReads, ['item-2'])
  assert.equal(batches.length, 0)
}
{
  const { service, batches } = setup([{ ...item, order_id: '' }])
  await assert.rejects(() => service.reassign(payload), (error: unknown) => error instanceof ApiError && error.status === 400)
  assert.equal(batches.length, 0)
}
{
  const { service, batches } = setup([item], true)
  await assert.rejects(() => service.reassign(payload), (error: unknown) => error === failure)
  assert.equal(batches.length, 1)
}

console.log('after-photo reassign dry test passed')

