import assert from 'node:assert/strict'
import { setCustomerCreatePrefill, takeCustomerCreatePrefill, type CustomerCreatePrefill } from '@/shared/navigation/customer-create-prefill'

assert.equal(takeCustomerCreatePrefill(), null)
const values: CustomerCreatePrefill = { customerName: 'Customer', phone: '0812345678', customerType: 'Member' }
setCustomerCreatePrefill(values)
assert.deepEqual(takeCustomerCreatePrefill(), values)
assert.equal(takeCustomerCreatePrefill(), null)
setCustomerCreatePrefill({ customerName: 'Earlier' })
setCustomerCreatePrefill({ email: 'latest@example.com' })
assert.deepEqual(takeCustomerCreatePrefill(), { email: 'latest@example.com' })
assert.equal(takeCustomerCreatePrefill(), null)
console.log('customer-create-prefill hand-off dry tests passed')
