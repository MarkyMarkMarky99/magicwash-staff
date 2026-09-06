import assert from 'node:assert/strict'
import { BaseCrudService } from '../../../../../server/shared/services/base-crud.service.js'
import { laundryPhotosRowSchema } from '../../../../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'

const module = await import('../../../../../server/modules/laundry-photos/laundry-photo.module.js')

assert.ok(module.laundryPhotoService instanceof BaseCrudService)
assert.ok(module.laundryPhotoRoutes.collection)
assert.ok(module.laundryPhotoRoutes.item)
assert.deepEqual(Object.keys(module.laundryPhotoFieldMap).sort(), Object.keys(laundryPhotosRowSchema.shape).sort())
for (const column of Object.keys(laundryPhotosRowSchema.shape)) {
  assert.equal(typeof module.laundryPhotoFieldMap[column as keyof typeof module.laundryPhotoFieldMap], 'string')
}

console.log('laundry-photo wiring dry test passed')
