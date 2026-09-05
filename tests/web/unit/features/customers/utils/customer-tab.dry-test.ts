import assert from 'node:assert/strict'
import { resolveCustomerTab } from '@/features/customers/utils/customer-tab'

for (const tab of ['orders', 'packages', 'invoices']) assert.equal(resolveCustomerTab(tab), tab)
for (const value of [undefined, '', 'garbage', null, 42]) {
  assert.equal(resolveCustomerTab(value), 'orders')
}
console.log('customer-tab dry-test passed')
