import assert from 'node:assert/strict'
import {
  appendPackageTransactionRequestSchema,
  appendPackageTransactionResponseSchema,
  packageCreditMovementTypeSchema,
} from '../../../../../contracts/customer-packages/package-transaction-api.schema.js'

const base = { customerPackageId: 'package-1', createdBy: 'staff-1' }

assert.equal(packageCreditMovementTypeSchema.safeParse('PURCHASE').success, false)
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: 0 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'PURCHASE', creditChange: 1 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: 1 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'REFUND', creditChange: -1 }))
assert.throws(() => appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: -1, customerId: 'client-1' }))

assert.equal(appendPackageTransactionRequestSchema.parse({ ...base, type: 'USAGE', creditChange: -1 }).creditChange, -1)
assert.equal(appendPackageTransactionRequestSchema.parse({ ...base, type: 'REFUND', creditChange: 1 }).creditChange, 1)

for (const type of ['ADJUSTMENT', 'VOID', 'TRANSFER', 'EXPIRE'] as const) {
  for (const creditChange of [-1, 1]) {
    assert.equal(appendPackageTransactionRequestSchema.parse({ ...base, type, creditChange }).creditChange, creditChange)
  }
}

assert.deepEqual(
  appendPackageTransactionResponseSchema.options.map((option) => option.shape.kind.value),
  ['created', 'validation_error', 'package_not_found', 'package_lookup_failed', 'transaction_write_failed'],
)

console.log('package transaction API contract dry test passed')
