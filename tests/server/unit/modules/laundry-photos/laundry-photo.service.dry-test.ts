import assert from 'node:assert/strict'
import { z } from 'zod'

import { LaundryPhotoService } from '../../../../../server/modules/laundry-photos/laundry-photo.module.js'
import { laundryPhotosRowSchema } from '../../../../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
import { orderItemFormsRowSchema } from '../../../../../server/sheets/OrderItemForms/OrderItemForms.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

type PhotoRow = z.infer<typeof laundryPhotosRowSchema>
type ItemRow = z.infer<typeof orderItemFormsRowSchema>

interface FakePhotoRepository extends SheetRepositoryContract<PhotoRow> {
  rows: Array<Partial<PhotoRow>>
  updateCalls: Array<{ id: string; patch: Partial<PhotoRow> }>
}

interface FakeItemRepository extends SheetRepositoryContract<ItemRow> {
  rows: Array<Partial<ItemRow>>
}

function makePhotoRow(overrides: Partial<PhotoRow> = {}): PhotoRow {
  return {
    id: 'photo-1',
    order_id: 'order-1',
    orderitem_id: 'old-item',
    item_id: 'old-catalog-item',
    image_path: null,
    image_url: null,
    notes: null,
    timestamp: null,
    created_by: 'staff-0',
    updated_by: null,
    updated_at: null,
    checked: null,
    is_active: null,
    file_id: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

function makePhotoRepository(rows: Array<Partial<PhotoRow>>): FakePhotoRepository {
  const repository = {
    rows,
    updateCalls: [] as Array<{ id: string; patch: Partial<PhotoRow> }>,
    async read() {
      return repository.rows
    },
    async append() {
      throw new Error('not used')
    },
    async batchAppend() {
      throw new Error('not used')
    },
    async update(id: string, patch: Partial<PhotoRow>) {
      repository.updateCalls.push({ id, patch })
      return makePhotoRow({ id, ...patch })
    },
    async delete() {
      throw new Error('not used')
    },
  }
  return repository as FakePhotoRepository
}

function makeItemRepository(rows: Array<Partial<ItemRow>>): FakeItemRepository {
  const repository = {
    rows,
    async read() {
      return repository.rows
    },
    async append() {
      throw new Error('not used')
    },
    async batchAppend() {
      throw new Error('not used')
    },
    async update() {
      throw new Error('not used')
    },
    async delete() {
      throw new Error('not used')
    },
  }
  return repository as FakeItemRepository
}

function makeService(
  photoRows: Array<Partial<PhotoRow>>,
  itemRows: Array<Partial<ItemRow>>,
): { service: LaundryPhotoService; photos: FakePhotoRepository; items: FakeItemRepository } {
  const photos = makePhotoRepository(photoRows)
  const items = makeItemRepository(itemRows)
  return {
    service: new LaundryPhotoService({
      repository: photos,
      orderItemFormsRepository: () => items,
    }),
    photos,
    items,
  }
}

async function expectApiError(operation: () => Promise<unknown>, status: number): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, status)
    return true
  })
}

const destination = { id: 'destination-item', order_id: 'order-1', item_id: 'destination-catalog-item' }
{
  const { service, photos } = makeService([makePhotoRow()], [destination])
  await service.update('photo-1', { orderItemId: 'destination-item', updatedBy: 'staff-1' })
  assert.equal(photos.updateCalls.length, 1)
  const update = photos.updateCalls[0]!
  assert.deepEqual(Object.keys(update.patch).sort(), ['item_id', 'orderitem_id', 'updated_by'])
  assert.deepEqual(update.patch, {
    orderitem_id: 'destination-item',
    item_id: 'destination-catalog-item',
    updated_by: 'staff-1',
  })
}

{
  const { service, photos } = makeService([makePhotoRow()], [])
  await expectApiError(
    () => service.update('photo-1', { orderItemId: 'missing-item', updatedBy: 'staff-1' }),
    404,
  )
  assert.equal(photos.updateCalls.length, 0)
}

{
  const { service, photos } = makeService([], [destination])
  await expectApiError(
    () => service.update('missing-photo', { orderItemId: 'destination-item', updatedBy: 'staff-1' }),
    404,
  )
  assert.equal(photos.updateCalls.length, 0)
}

{
  const { service, photos } = makeService(
    [makePhotoRow({ order_id: 'order-1' })],
    [{ ...destination, order_id: 'other-order' }],
  )
  await expectApiError(
    () => service.update('photo-1', { orderItemId: 'destination-item', updatedBy: 'staff-1' }),
    400,
  )
  assert.equal(photos.updateCalls.length, 0)
}

for (const [photoOrderId, itemOrderId] of [
  ['', 'order-1'],
  ['order-1', ''],
  ['order-1', null],
] as const) {
  const { service, photos } = makeService(
    [makePhotoRow({ order_id: photoOrderId })],
    [{ ...destination, order_id: itemOrderId }],
  )
  await expectApiError(
    () => service.update('photo-1', { orderItemId: 'destination-item', updatedBy: 'staff-1' }),
    400,
  )
  assert.equal(photos.updateCalls.length, 0)
}

{
  const { service, photos } = makeService([makePhotoRow()], [destination])
  await expectApiError(
    () => service.update('photo-1', {
      orderItemId: 'destination-item',
      updatedBy: 'staff-1',
      extra: 'rejected',
    }),
    422,
  )
  assert.equal(photos.updateCalls.length, 0)
}

console.log('laundry-photo service dry test passed')
