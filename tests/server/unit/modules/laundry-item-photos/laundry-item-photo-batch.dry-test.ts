import assert from 'node:assert/strict'
import type { z } from 'zod'
import { createLaundryItemPhotoBatchService, createLaundryItemPhotoRoutes, createLaundryItemPhotoService } from '../../../../../server/modules/laundry-item-photos/laundry-item-photo.module.js'
import type { laundryItemPhotosRowSchema } from '../../../../../server/sheets/LaundryItemPhotos/LaundryItemPhotos.db-contract.js'
import type { orderGarmentsRowSchema } from '../../../../../server/sheets/OrderGarments/OrderGarments.db-contract.js'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'

type PhotoRow = z.infer<typeof laundryItemPhotosRowSchema>
type LinkRow = z.infer<typeof orderGarmentsRowSchema>

const link: LinkRow = {
  id: 'link-1', order_id: 'order-1', laundry_item_id: 'aB01zZ89', orderitem_id: null, notes: null, status: 'RECEIVED',
  created_at: '2026-10-23 09:00:00', created_by: 'staff-1', updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
}
const linkRows: LinkRow[] = [link, { ...link, id: 'link-gone', order_id: 'order-gone', deleted_at: '2026-10-23 10:00:00' }]
let reads: Array<Partial<LinkRow> | undefined> = []
let batches: Array<Array<Partial<PhotoRow>>> = []
const unexpected = async () => { throw new Error('unexpected repository call') }
const batchService = createLaundryItemPhotoBatchService(
  () => ({ batchAppend: async (rows) => { batches.push(rows); return rows as PhotoRow[] } }),
  () => ({
    read: async (query?: ReadQueryDTO<Partial<LinkRow>>) => {
      reads.push(query?.where)
      return linkRows.filter((item) => Object.entries(query?.where ?? {}).every(([field, value]) => item[field as keyof LinkRow] === value))
    },
  }),
)
const routes = createLaundryItemPhotoRoutes(
  createLaundryItemPhotoService(() => ({ read: unexpected, append: unexpected, update: unexpected }), () => ({ read: unexpected })),
  batchService,
)
const request = (method: string, body: unknown, id = 'batch'): ApiHandlerRequest => ({
  method, body, query: {}, params: { id }, headers: {},
  staff: { staffId: 'session-staff', email: 'staff@example.test', name: 'Staff', role: 'staff' },
})
const url = (n: number) => `https://firebasestorage.googleapis.com/v0/b/bucket/o/photo-${n}.jpg`
const body = { laundryItemId: 'aB01zZ89', orderId: 'order-1', photoType: 'DEFECT', imageUrls: [1, 2, 3, 4, 5].map(url), createdBy: 'payload-staff' }
const post = (payload: unknown) => routes.item!.handleRequest(request('POST', payload))
const reset = () => { reads = []; batches = [] }

const ok = await post(body)
assert.equal(ok.status, 201)
assert.deepEqual((ok.body as { data: unknown }).data, { created: 5 })
assert.equal(reads.length, 1, 'one OrderGarments read for five photos with an order')
assert.deepEqual(reads[0], { laundry_item_id: 'aB01zZ89', order_id: 'order-1' })
assert.equal(batches.length, 1, 'one batchAppend for five photos')
assert.equal(batches[0].length, 5)
assert.deepEqual(batches[0].map((row) => row.image_url), body.imageUrls)
for (const row of batches[0]) {
  assert.match(row.id!, /^[0-9a-f]{8}$/)
  assert.equal(row.laundry_item_id, 'aB01zZ89')
  assert.equal(row.order_id, 'order-1')
  assert.equal(row.photo_type, 'DEFECT')
  assert.equal(row.notes, null)
  assert.equal(row.created_by, 'session-staff', 'createdBy comes from the session actor')
}
assert.equal(new Set(batches[0].map((row) => row.id)).size, 5)
assert.deepEqual(await batchService.create(body), { created: 5 })

reset()
assert.equal((await post({ ...body, orderId: null })).status, 201)
assert.equal(reads.length, 0, 'no OrderGarments read without an order')
assert.equal(batches.length, 1, 'one batchAppend without an order')
assert.equal(batches[0].length, 5)
assert.ok(batches[0].every((row) => row.order_id === null))

reset()
const status = async (payload: unknown) => (await post(payload)).status
assert.equal(await status({ ...body, photoType: 'REGISTRATION' }), 400)
assert.equal(await status({ ...body, orderId: 'order-other' }), 400)
assert.equal(await status({ ...body, orderId: 'order-gone' }), 400)
assert.equal(await status({ ...body, laundryItemId: 'zZ99aB01' }), 400)
assert.equal(await status({ ...body, imageUrls: ['not a url'] }), 400)
assert.equal(await status({ ...body, imageUrls: ['http://firebasestorage.googleapis.com/v0/b/x/o/a.jpg'] }), 400)
assert.equal(await status({ ...body, imageUrls: ['https://example.test/a.jpg'] }), 400)
assert.equal(await status({ ...body, imageUrls: [url(1), 'https://example.test/a.jpg'] }), 400)
assert.equal(await status({ ...body, imageUrls: [] }), 422)
assert.equal(await status({ ...body, imageUrls: Array.from({ length: 21 }, (_, n) => url(n)) }), 422)
assert.equal(await status({ ...body, imageUrls: undefined }), 422)
assert.equal(await status({ ...body, orderId: '' }), 422)
assert.equal(await status({ ...body, orderId: undefined }), 422)
assert.equal(await status({ ...body, notes: 'extra' }), 422)
assert.equal(await status({ ...body, laundryItemId: 'bad' }), 422)
assert.equal(batches.length, 0, 'rejected requests must not append')
assert.equal(reads.length, 3, 'only the three order-link rejections read OrderGarments')

reset()
assert.equal((await post({ ...body, imageUrls: Array.from({ length: 20 }, (_, n) => url(n)) })).status, 201)
assert.equal(batches[0].length, 20)
assert.equal(reads.length, 1)

assert.equal((await routes.item!.handleRequest({ ...request('POST', body), staff: undefined })).status, 401)
assert.equal((await routes.item!.handleRequest(request('POST', body, 'row-id-1'))).status, 404)
assert.equal((await routes.item!.handleRequest(request('GET', {}, 'batch'))).status, 404)
assert.equal((await routes.item!.handleRequest(request('PATCH', { notes: 'x', updatedBy: 'a' }, 'batch'))).status, 404)
assert.equal((await routes.item!.handleRequest(request('DELETE', {}, 'batch'))).status, 405)
console.log('laundry-item-photos batch dry tests passed')
