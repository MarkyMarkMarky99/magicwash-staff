import assert from 'node:assert/strict'
import {
  createCustomerPackageRequestSchema,
  createCustomerPackageResponseSchema,
} from '../../../../../contracts/customer-packages/customer-package-api.schema.js'

const request = createCustomerPackageRequestSchema.parse({
  customerId: 'customer-1',
  packageCode: 'GOLD',
  createdBy: 'staff-1',
})

assert.deepEqual(request, {
  customerId: 'customer-1',
  packageCode: 'GOLD',
  invoiceId: null,
  startDate: null,
  expiryDate: null,
  serviceDay: null,
  timeSlot: null,
  notes: null,
  createdBy: 'staff-1',
})

for (const field of ['id', 'customerPackageId', 'createdAt', 'openingCredit', 'transactionId']) {
  assert.throws(() =>
    createCustomerPackageRequestSchema.parse({
      customerId: 'customer-1', packageCode: 'GOLD', createdBy: 'staff-1', [field]: 'client-value',
    }),
  )
}

assert.deepEqual(
  createCustomerPackageResponseSchema.options.map((option) => option.shape.kind.value),
  ['created', 'validation_error', 'catalog_read_failed', 'opening_transaction_write_failed', 'package_write_failed'],
)

for (const option of createCustomerPackageResponseSchema.options) {
  for (const forbidden of ['status', 'remainingCredit', 'usedCredit', 'totalCredit']) {
    assert.equal(forbidden in option.shape, false, `${option.shape.kind.value} must not return ${forbidden}`)
  }
}

console.log('customer package API contract dry test passed')
