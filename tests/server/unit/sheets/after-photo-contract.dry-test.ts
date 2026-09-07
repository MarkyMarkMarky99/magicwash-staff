import assert from 'node:assert/strict'
import { afterPhotoDbContract } from '../../../../server/sheets/AfterPhoto/AfterPhoto.db-contract.js'

// The AFT twin of laundry-photos-contract.dry-test.ts. Column order is already pinned in
// column-order.dry-test.ts; this file pins the capability and audit declarations, so closing
// append, opening delete, or stamping a second audit column fails here.
assert.equal(afterPhotoDbContract.primaryKey, 'id')
assert.equal(afterPhotoDbContract.sheetName, 'after')
assert.equal(afterPhotoDbContract.spreadsheetId, 'AFTER_PHOTOS_SPREADSHEET_ID')
assert.deepEqual(afterPhotoDbContract.writes, {
  append: true,
  update: true,
  delete: false,
})
// `created_at` here, `timestamp` on LaundryPhotos: the physical columns differ. `updated_at` must
// never be stamped — it is plain text on the before sheet and is left empty on both.
assert.deepEqual(afterPhotoDbContract.audit, { onAppend: ['created_at'] })
assert.equal('valueInput' in afterPhotoDbContract, false)

console.log('after-photo contract dry test passed')
