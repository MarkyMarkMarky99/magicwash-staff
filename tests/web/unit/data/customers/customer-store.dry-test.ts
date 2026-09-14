import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { listCustomers } from '@/data/customers/customer.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { invalidate } from '@/shared/api/response-cache'

const customer = (index: number) => ({
  customerId: `customer-${index}`,
  customerIndex: String(index),
  customerName: `Customer ${index}`,
  phone: null,
  address: null,
  location: null,
  customerType: 'Regular',
})

const rows = Array.from({ length: 2000 }, (_, index) => customer(index))
const calls: URL[] = []
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request) => {
  calls.push(new URL(String(input), 'http://localhost'))
  return new Response(JSON.stringify({
    data: rows,
    meta: { pagination: { page: 1, perPage: 2000 } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

try {
  invalidate('/api/customers')
  const [listResult, pickerResult] = await Promise.all([listCustomers(), listCustomers()])
  assert.equal(calls.length, 1, 'customer consumers share one in-flight canonical URL')
  assert.equal(calls[0]!.pathname, '/api/customers')
  assert.equal(calls[0]!.searchParams.get('perPage'), '2000')
  assert.equal(calls[0]!.searchParams.get('sortBy'), 'customerIndex')
  assert.deepEqual(pickerResult, listResult)
  assert.equal(listResult.truncated, true)

  invalidate('/api/customers')
  setActivePinia(createPinia())
  const store = useCustomerStore()
  await store.loadCustomers()
  assert.equal(store.customers.length, 2000)
  assert.equal(store.truncated, true)
  assert.equal(store.loaded, false)
  store.$dispose()

  for (const path of [
    'src/features/customers/pages/CustomerListPage.vue',
    'src/features/orders/pages/OrderCreatePage.vue',
    'src/features/customer-packages/pages/CustomerPackageCreatePage.vue',
  ]) {
    const source = readFileSync(path, 'utf8')
    assert.match(source, /customersTruncated|v-if="truncated"/, `${path} must show the cap signal`)
    assert.match(source, /2,000/, `${path} must explain the customer cap`)
  }
} finally {
  globalThis.fetch = originalFetch
}

console.log('customer-store.dry-test: OK (canonical URL, cap signal, notices)')
