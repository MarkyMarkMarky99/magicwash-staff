import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { customerDetailResponseSchema } from '@contracts/customers/customer-api.schema'
import { packageResponseSchema } from '@contracts/packages/package-api.schema'
import { createCustomerPackageRequestSchema } from '@contracts/customer-packages/customer-package-api.schema'
import { useCustomerPackagePurchaseStore } from '@/features/customer-packages/stores/customer-package-purchase.store'

const customer = customerDetailResponseSchema.parse({
  customerId: 'CUS-1', customerIndex: '1', customerName: 'Customer', phone: null, address: null,
  location: null, customerType: null, registeredDate: null, facebook: null, lineId: null,
  whatsapp: null, email: null,
})
const catalog = packageResponseSchema.parse({
  packageCode: 'PKG-1', name: 'Ten credits', eligibleService: 'WASH', includedCredit: 10,
  price: 500, notes: null, createdAt: '', createdBy: 'admin', updatedAt: null,
  updatedBy: null, deletedAt: null, deletedBy: null,
})
const draft = createCustomerPackageRequestSchema.parse({ customerId: 'CUS-1', packageCode: 'PKG-1', createdBy: 'admin' })
const invoiceCreated = { kind: 'created', invoiceNumber: 'INV-SERVER', itemCount: 1, itemsTotal: 500, invoiceTotal: 500 }
const packageCreated = { kind: 'created', customerPackageId: 'CP-1', customerId: 'CUS-1', packageCode: 'PKG-1', openingCredit: 10, transactionId: 'TX-1', createdAt: '2026-09-05' }
const originalFetch = globalThis.fetch

async function scenario(invoiceOutcome: unknown, packageOutcomes: unknown[]) {
  setActivePinia(createPinia())
  const store = useCustomerPackagePurchaseStore()
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    calls.push({ url, body: JSON.parse(String(options?.body)) })
    if (invoiceOutcome instanceof Error) throw invoiceOutcome
    return new Response(JSON.stringify(url === '/api/invoices' ? invoiceOutcome : packageOutcomes.shift()), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  await store.start(customer, catalog, draft)
  return { store, calls }
}

try {
  const success = await scenario(invoiceCreated, [packageCreated])
  assert.deepEqual(success.calls.map((call) => call.url), ['/api/invoices', '/api/customer-packages'])
  assert.equal(success.calls[0].body.billingType, 'PACKAGE')
  assert.equal('sourceOrderId' in success.calls[0].body, false)
  assert.equal(success.calls[1].body.invoiceId, 'INV-SERVER')
  await success.store.resume('CUS-1')
  assert.equal(success.calls.length, 2)

  const failedInvoice = await scenario({ kind: 'validation_error', issues: [{ path: 'customer', message: 'Invalid' }] }, [])
  assert.equal(failedInvoice.calls.length, 1, 'No package write before invoice success')

  for (const outcome of [new Error('Network lost'), { kind: 'invoice_view_sync_failed', invoiceNumber: 'INV-SERVER', message: 'Sync failed', certainty: 'unknown' }]) {
    const unknown = await scenario(outcome, [])
    unknown.store.clear('CUS-1')
    await unknown.store.resume('CUS-1')
    await unknown.store.start(customer, catalog, draft)
    assert.equal(unknown.calls.length, 1, 'Uncertain invoice survives close/reopen and blocks retry')
  }

  const retry = await scenario(invoiceCreated, [
    { kind: 'catalog_read_failed', packageCode: 'PKG-1', message: 'Try later' }, packageCreated,
  ])
  await retry.store.resume('CUS-1')
  assert.deepEqual(retry.calls.map((call) => call.url), ['/api/invoices', '/api/customer-packages', '/api/customer-packages'])
  assert.equal(retry.calls[2].body.invoiceId, 'INV-SERVER', 'Package retry reuses the successful invoice')

  const partial = await scenario(invoiceCreated, [{
    kind: 'package_write_failed', customerPackageId: 'CP-1', transactionId: 'TX-1',
    openingCredit: 10, message: 'Failed after ledger write', certainty: 'rejected',
  }])
  partial.store.clear('CUS-1')
  await partial.store.resume('CUS-1')
  assert.equal(partial.calls.length, 2, 'Partial package persistence blocks retry even when final stage was rejected')
  console.log('Package purchase sequencing, invoice linkage, retry and partial-write checks passed')
} finally {
  globalThis.fetch = originalFetch
}
