import assert from 'node:assert/strict'
import { LaundryItemRegistrationService } from '../../../../../server/modules/laundry-items/laundry-item-registration.service.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import type { z } from 'zod'
import type { laundryItemsRowSchema } from '../../../../../server/sheets/LaundryItems/LaundryItems.db-contract.js'
import type { laundryItemPhotosRowSchema } from '../../../../../server/sheets/LaundryItemPhotos/LaundryItemPhotos.db-contract.js'

type Item = z.infer<typeof laundryItemsRowSchema>
type Photo = z.infer<typeof laundryItemPhotosRowSchema>
const now = '2026-10-24 12:00:00'
const actor = { staffId: 'session-staff' }
const garment = (tag = 'new00001', itemId: string | null = null) => ({ tag, itemId, imageUrl: 'https://example.test/photo.jpg' })
const payload = (garments = [garment()]) => ({ customerId: 'customer-1', garments, createdBy: 'session-staff' })
function setup() {
  const items: Partial<Item>[] = []
  const photos: Partial<Photo>[] = []
  const itemWrites: Partial<Item>[][] = []
  const photoWrites: Partial<Photo>[][] = []
  const triggers: string[] = []
  const events: string[] = []
  let itemReads = 0
  let photoReads = 0
  let exists = true
  let failItems = false
  let failPhotos = false
  let failPhotoRead = false
  let failAi = false
  let id = 0
  const service = new LaundryItemRegistrationService({
    laundryItems: {
      read: async query => { assert.equal(query, undefined); itemReads++; return items },
      batchAppend: async rows => {
        events.push('items')
        if (failItems) throw new Error('items failed')
        itemWrites.push(rows); items.push(...rows); return rows as Item[]
      },
    },
    photos: {
      read: async query => {
        assert.equal(query, undefined); photoReads++
        if (failPhotoRead) throw new Error('read failed')
        return photos
      },
      batchAppend: async rows => {
        events.push('photos')
        if (failPhotos) throw new Error('photos failed')
        photoWrites.push(rows); photos.push(...rows); return rows as Photo[]
      },
    },
    customerExists: async id => { assert.equal(id, 'customer-1'); return exists },
    generateId: () => `photo-${++id}`,
    now: () => now,
    triggerClassification: async staffId => {
      events.push('ai'); triggers.push(staffId)
      if (failAi) throw new Error('AI failed')
      return true
    },
  })
  return { service, items, photos, itemWrites, photoWrites, triggers, events,
    counts: () => ({ itemReads, photoReads }),
    setExists: (value: boolean) => { exists = value },
    failItems: () => { failItems = true },
    failPhotos: (value = true) => { failPhotos = value },
    failPhotoRead: () => { failPhotoRead = true },
    failAi: () => { failAi = true },
  }
}
{
  const t = setup()
  t.items.push({ id: 'same0001', customer_id: 'customer-1', deleted_at: '' },
    { id: 'other001', customer_id: 'customer-2' },
    { id: 'deleted1', customer_id: 'customer-2', deleted_at: now })
  assert.deepEqual(await t.service.checkTags('customer-1', ['new00002', 'same0001', 'deleted1', 'other001', 'new00001']), {
    new: ['new00002', 'deleted1', 'new00001'], registered: ['same0001'], conflicts: ['other001'],
  })
  assert.deepEqual(t.counts(), { itemReads: 1, photoReads: 0 })
}
{
  const t = setup()
  assert.deepEqual(await t.service.register(payload(), actor), {
    registered: ['new00001'], alreadyRegistered: [], failed: [], aiTriggered: true,
  })
  assert.deepEqual(t.itemWrites, [[{
    id: 'new00001', customer_id: 'customer-1', item_id: null, wash_program: null, notes: null,
    image_url: 'https://example.test/photo.jpg', created_at: now, created_by: 'session-staff',
    updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
  }]])
  assert.deepEqual(t.photoWrites, [[{
    id: 'photo-1', laundry_item_id: 'new00001', order_id: null, photo_type: 'REGISTRATION',
    image_url: 'https://example.test/photo.jpg', notes: null, created_at: now, created_by: 'session-staff',
    updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
  }]])
  assert.deepEqual(t.triggers, ['session-staff'])
  assert.deepEqual(t.events, ['items', 'photos', 'ai'])
  assert.deepEqual(t.counts(), { itemReads: 1, photoReads: 1 })
  assert.deepEqual(await t.service.register(payload(), actor), {
    registered: [], alreadyRegistered: ['new00001'], failed: [], aiTriggered: false,
  })
  assert.equal(t.itemWrites.length, 1)
  assert.equal(t.photoWrites.length, 1)
  assert.equal(t.triggers.length, 1)
}
{
  const t = setup()
  t.items.push({ id: 'other001', customer_id: 'customer-2' })
  await assert.rejects(t.service.register(payload([garment(), garment('other001')]), actor), error => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 409); assert.equal(error.code, 'TAG_CONFLICT')
    assert.match(error.message, /other001/); assert.deepEqual(error.details, { tags: ['other001'] })
    return true
  })
  assert.deepEqual(t.events, [])
  assert.equal(t.counts().photoReads, 0)
}
{
  const t = setup(); t.setExists(false)
  await assert.rejects(t.service.register(payload(), actor), error => error instanceof ApiError && error.status === 404)
  assert.deepEqual(t.events, [])
  assert.equal(t.counts().itemReads, 0)
}
{
  const t = setup(); t.failPhotos()
  assert.deepEqual(await t.service.register(payload(), actor), {
    registered: ['new00001'], alreadyRegistered: [], failed: ['new00001'], aiTriggered: true,
  })
  t.failPhotos(false)
  assert.deepEqual(await t.service.register(payload(), actor), {
    registered: [], alreadyRegistered: ['new00001'], failed: [], aiTriggered: false,
  })
  assert.equal(t.itemWrites.length, 1)
  assert.equal(t.photoWrites.length, 1)
}
{
  const t = setup()
  t.items.push({ id: 'new00001', customer_id: 'customer-1' })
  t.photos.push({ laundry_item_id: 'new00001', photo_type: 'BEFORE' },
    { laundry_item_id: 'new00001', photo_type: 'REGISTRATION', deleted_at: now })
  await t.service.register(payload(), actor)
  assert.equal(t.itemWrites.length, 0)
  assert.equal(t.photoWrites[0][0].laundry_item_id, 'new00001')
  assert.deepEqual(t.triggers, [])
}
{
  const t = setup(); t.failItems()
  await assert.rejects(t.service.register(payload(), actor), /items failed/)
  assert.deepEqual(t.events, ['items'])
  assert.equal(t.counts().photoReads, 0)
}
{
  const t = setup(); t.failPhotoRead()
  assert.deepEqual((await t.service.register(payload(), actor)).failed, ['new00001'])
}
{
  const t = setup(); t.failAi()
  const result = await t.service.register(payload(), actor)
  assert.equal(result.aiTriggered, false)
  assert.deepEqual(result.registered, ['new00001'])
}
{
  const t = setup()
  await t.service.register(payload([garment('new00001', 'shirt')]), actor)
  assert.deepEqual(t.triggers, [])
  assert.equal(t.itemWrites[0][0].item_id, 'shirt')
}
{
  const t = setup()
  for (const invalid of [payload([garment(), garment()]), { ...payload(), createdBy: ' ' }, { ...payload(), garments: [] }]) {
    await assert.rejects(t.service.register(invalid, actor), error => error instanceof ApiError && error.status === 422)
  }
  assert.equal(t.counts().itemReads, 0)
  assert.deepEqual(t.events, [])
}
console.log('laundry-item registration service dry tests passed')
