import assert from 'node:assert/strict'
import { paymentsDbContract } from '../../../../server/sheets/Payments/Payments.db-contract.js'

assert.deepEqual(
  paymentsDbContract.writes,
  { append: false, update: false, delete: false },
  'Payments must remain read-only until its write semantics are designed',
)

console.log('payments-capabilities.dry-test: OK')
