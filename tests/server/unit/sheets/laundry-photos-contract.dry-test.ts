import assert from 'node:assert/strict'
import {
  laundryPhotosDbContract,
  laundryPhotosRowSchema,
} from '../../../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'

const expectedColumns = [
  'id',
  'order_id',
  'orderitem_id',
  'item_id',
  'image_path',
  'image_url',
  'notes',
  'timestamp',
  'created_by',
  'updated_by',
  'updated_at',
  'checked',
  'is_active',
  'file_id',
  'deleted_at',
  'deleted_by',
] as const

assert.strictEqual(laundryPhotosDbContract.row, laundryPhotosRowSchema)
assert.deepEqual(Object.keys(laundryPhotosRowSchema.shape), [...expectedColumns])

const nullableRow = Object.fromEntries(
  expectedColumns.map((column) => [column, column === 'id' ? 'photo-1' : null]),
)
assert.equal(
  laundryPhotosRowSchema.safeParse(nullableRow).success,
  true,
  'id plus null for every other column must satisfy the row schema',
)

assert.equal(
  laundryPhotosRowSchema.safeParse({ ...nullableRow, id: null }).success,
  false,
  'id must be non-nullable',
)

for (const column of expectedColumns.slice(1)) {
  const missingColumn = { ...nullableRow }
  delete (missingColumn as Record<string, unknown>)[column]
  assert.equal(
    laundryPhotosRowSchema.safeParse(missingColumn).success,
    false,
    `${column} must be nullable, not optional`,
  )
}

assert.equal(
  laundryPhotosRowSchema.safeParse({ ...nullableRow, unexpected: 'legacy-cell' }).success,
  false,
  'the LaundryPhotos row schema must be strict',
)

assert.equal(laundryPhotosDbContract.primaryKey, 'id')
assert.equal(laundryPhotosDbContract.sheetName, 'LaundryPhotos')
assert.equal(laundryPhotosDbContract.spreadsheetId, 'ORDERS_SPREADSHEET_ID')
assert.deepEqual(laundryPhotosDbContract.writes, {
  append: false,
  update: false,
  delete: false,
})
assert.equal('audit' in laundryPhotosDbContract, false)
assert.equal('valueInput' in laundryPhotosDbContract, false)

console.log('laundry-photos contract dry test passed')
