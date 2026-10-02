import assert from 'node:assert/strict'
import { paymentsDbContract } from '../../../../server/sheets/Payments/Payments.db-contract.js'

assert.deepEqual(
  paymentsDbContract.writes,
  { append: true, update: true, delete: false },
  'Payments allows ledger appends and staff review of PENDING entries, never deletes',
)

console.log('payments-capabilities.dry-test: OK')
