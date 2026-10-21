import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { getCustomerById, updateCustomer, type CustomerDetailDto } from '@/data/customers/customer.service'
import { useCustomerStore } from '@/data/customers/customer.store'
import { invalidate } from '@/shared/api/response-cache'

let customer: CustomerDetailDto = {
  customerId: 'customer/id', customerIndex: 'ABC', customerName: 'Original', phone: '0812345678',
  address: 'Address', location: null, customerType: 'Regular', priceGroup: null,
  registeredDate: '2026-10-01', facebook: null, lineId: null, whatsapp: null, email: null,
}
const calls: Array<{ path: string; method: string; body: unknown }> = []
const originalFetch = globalThis.fetch
let rejectWrite = false
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input), 'http://localhost')
  const method = init?.method ?? 'GET'
  const body = init?.body ? JSON.parse(String(init.body)) : undefined
  calls.push({ path: url.pathname, method, body })
  if (method === 'PATCH') {
    if (rejectWrite) return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }), { status: 403 })
    customer = { ...customer, customerName: body.customerName, address: body.address }
  }
  return new Response(JSON.stringify({
    data: url.pathname === '/api/customers' ? [customer] : customer,
    meta: { pagination: { page: 1, perPage: 2000 } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

invalidate('/api/customers')
setActivePinia(createPinia())
const store = useCustomerStore()
try {
  await store.loadCustomers()
  await getCustomerById(customer.customerId)
  const initialReads = calls.filter((call) => call.method === 'GET').length
  const patch = { customerName: 'Changed', address: null, updatedBy: 'admin' }
  const saved = await updateCustomer(customer.customerId, patch)
  await store.loadCustomers(true)
  assert.equal(saved.customerName, 'Changed')
  assert.equal(store.customers[0]?.customerName, 'Changed')
  assert.deepEqual(calls.find((call) => call.method === 'PATCH'), {
    path: '/api/customers/customer%2Fid', method: 'PATCH', body: patch,
  })
  assert.equal(calls.filter((call) => call.path === '/api/customers' && call.method === 'GET').length, 2)
  assert.equal((await getCustomerById(customer.customerId)).customerName, 'Changed')
  assert.equal(calls.filter((call) => call.method === 'GET').length, initialReads + 2)

  rejectWrite = true
  const readsBeforeFailure = calls.filter((call) => call.method === 'GET').length
  await assert.rejects(() => updateCustomer(customer.customerId, { customerName: 'Rejected', updatedBy: 'admin' }))
  await store.loadCustomers()
  assert.equal(calls.filter((call) => call.method === 'GET').length, readsBeforeFailure)
  assert.equal(store.customers[0]?.customerName, 'Changed')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
  invalidate('/api/customers')
}
console.log('customer-update.dry-test: OK (PATCH, encoded id, cache invalidation, store reload, failed write)')
