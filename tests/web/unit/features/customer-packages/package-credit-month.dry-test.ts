import assert from 'node:assert/strict'
import { addSheetDateDays, addSheetDateMonth } from '../../../../../src/shared/utils/sheet-date.js'
import { overageAmount } from '../../../../../shared/utils/package-credit.js'
import { cachePolicyFor } from '../../../../../src/shared/config/cache.js'

const start = addSheetDateDays('2026-09-30', 1)
assert.equal(start, '2026-10-01')
assert.equal(addSheetDateDays(addSheetDateMonth(start), -1), '2026-10-31')
assert.equal(addSheetDateMonth('2027-01-31'), '2027-02-28')
assert.equal(overageAmount(0.5), 12.5)
for (const endpoint of ['/api/order-credit-usage', '/api/package-billing', '/api/package-renewal']) {
  assert.equal(cachePolicyFor(`${endpoint}?customerPackageId=pkg`).cacheable, false)
}
console.log('Package renewal month and fractional overage dry test passed')
