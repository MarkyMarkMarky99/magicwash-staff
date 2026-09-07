import assert from 'node:assert/strict'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import { laundryPhotosRowSchema } from '../../../../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'

const module = await import('../../../../../server/modules/laundry-photos/laundry-photo.module.js')

assert.ok(module.laundryPhotoService instanceof BaseCrudService)
assert.ok(module.laundryPhotoRoutes.collection)
assert.ok(module.laundryPhotoRoutes.item)
assert.match(module.createLaundryPhotoId(), /^[0-9a-f]{8}$/)

function request(method: string): ApiHandlerRequest {
  return { method, query: {}, body: undefined, headers: {}, params: {} }
}

const collectionDelete = await module.laundryPhotoRoutes.collection.handleRequest(request('DELETE'))
assert.equal(collectionDelete.status, 405)
assert.equal(collectionDelete.headers?.Allow, 'GET, POST')

const itemDelete = await module.laundryPhotoRoutes.item!.handleRequest(request('DELETE'))
assert.equal(itemDelete.status, 405)
assert.equal(itemDelete.headers?.Allow, 'GET, PATCH')

assert.deepEqual(Object.keys(module.laundryPhotoFieldMap).sort(), Object.keys(laundryPhotosRowSchema.shape).sort())
for (const column of Object.keys(laundryPhotosRowSchema.shape)) {
  assert.equal(typeof module.laundryPhotoFieldMap[column as keyof typeof module.laundryPhotoFieldMap], 'string')
}

console.log('laundry-photo wiring dry test passed')
