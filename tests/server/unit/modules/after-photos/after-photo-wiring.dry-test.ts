import assert from 'node:assert/strict'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import { afterPhotoRowSchema } from '../../../../../server/sheets/AfterPhoto/AfterPhoto.db-contract.js'

const module = await import('../../../../../server/modules/after-photos/after-photo.module.js')

assert.ok(module.afterPhotoService instanceof BaseCrudService)
assert.ok(module.afterPhotoRoutes.collection)
assert.ok(module.afterPhotoRoutes.item)
assert.deepEqual(Object.keys(module.afterPhotoFieldMap).sort(), Object.keys(afterPhotoRowSchema.shape).sort())
for (const column of Object.keys(afterPhotoRowSchema.shape)) {
  assert.equal(typeof module.afterPhotoFieldMap[column as keyof typeof module.afterPhotoFieldMap], 'string')
}

console.log('after-photo wiring dry test passed')
