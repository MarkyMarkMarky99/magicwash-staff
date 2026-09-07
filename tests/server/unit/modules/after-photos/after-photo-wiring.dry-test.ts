import assert from 'node:assert/strict'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import { afterPhotoRowSchema } from '../../../../../server/sheets/AfterPhoto/AfterPhoto.db-contract.js'

const module = await import('../../../../../server/modules/after-photos/after-photo.module.js')

assert.ok(module.afterPhotoService instanceof BaseCrudService)
assert.ok(module.afterPhotoRoutes.collection)
assert.ok(module.afterPhotoRoutes.item)
assert.match(module.createAfterPhotoId(), /^[0-9a-f]{8}$/)

function request(method: string): ApiHandlerRequest {
  return { method, query: {}, body: undefined, headers: {}, params: {} }
}

const collectionDelete = await module.afterPhotoRoutes.collection.handleRequest(request('DELETE'))
assert.equal(collectionDelete.status, 405)
assert.equal(collectionDelete.headers?.Allow, 'GET, POST')

const itemDelete = await module.afterPhotoRoutes.item!.handleRequest(request('DELETE'))
assert.equal(itemDelete.status, 405)
assert.equal(itemDelete.headers?.Allow, 'GET, PATCH')
assert.deepEqual(Object.keys(module.afterPhotoFieldMap).sort(), Object.keys(afterPhotoRowSchema.shape).sort())
for (const column of Object.keys(afterPhotoRowSchema.shape)) {
  assert.equal(typeof module.afterPhotoFieldMap[column as keyof typeof module.afterPhotoFieldMap], 'string')
}

console.log('after-photo wiring dry test passed')
