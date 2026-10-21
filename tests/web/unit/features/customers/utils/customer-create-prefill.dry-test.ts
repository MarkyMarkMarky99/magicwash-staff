import assert from 'node:assert/strict'
import { applyCustomerCreatePrefill } from '@/features/customers/utils/customer-create-prefill'
import type { CustomerCreatePrefill } from '@/shared/navigation/customer-create-prefill'

const empty = { customerName: '', phone: '', address: '', lineId: '', facebook: '', whatsapp: '', email: '', customerType: '', updatedBy: 'staff' }
const values: CustomerCreatePrefill = {
  customerName: 'Customer', phone: '+66 81 234 5678', address: ' Address ', lineId: 'line',
  facebook: 'facebook', whatsapp: '+66812345678', email: 'customer@example.com', customerType: 'Corporate',
}
assert.deepEqual(applyCustomerCreatePrefill(empty, values), { ...empty, ...values })
assert.equal(empty.customerName, '')
assert.deepEqual(applyCustomerCreatePrefill(empty, {}), empty)
assert.deepEqual(applyCustomerCreatePrefill(empty, { phone: 'raw phone' }), { ...empty, phone: 'raw phone' })
for (const field of Object.keys(values) as (keyof CustomerCreatePrefill)[]) {
  const existing = { ...empty, [field]: 'already filled' }
  assert.deepEqual(applyCustomerCreatePrefill(existing, values), { ...empty, ...values, [field]: 'already filled' })
}
assert.equal(applyCustomerCreatePrefill({ ...empty, customerName: ' ' }, values).customerName, ' ')
console.log('customer-create-prefill mapping dry tests passed')
