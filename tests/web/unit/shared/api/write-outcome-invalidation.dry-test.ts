import assert from 'node:assert/strict'
import { updatePriceList } from '@/data/price-list/price-list.service'
import { appendPackageTransaction } from '@/data/package-transactions/package-transaction.service'
import { createCustomerPackage } from '@/data/customer-packages/customer-package.service'
import { createInvoice } from '@/data/invoices/invoice.service'
import { invalidate, readCache, writeCache } from '@/shared/api/response-cache'

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

try {
  invalidate()
  writeCache('/api/price-list?perPage=1000', ['stale'])
  globalThis.fetch = (async () => jsonResponse({ data: {
    id: 'price-1', itemCode: 'ITM-0001', category: 'Bedding', subcategory: 'Pillows',
    itemType: 'Pillow', variant: null, displayNameTh: 'หมอน', displayNameEn: null,
    serviceType: 'WSIR', priceGroup: 'DEFAULT', unit: 'piece', price: 100,
    creditEligible: false, effectiveFrom: '2026-01-01', effectiveTo: null,
    active: true, imageUrl: null,
  } })) as typeof fetch
  await updatePriceList('price-1', { price: 100 })
  assert.equal(readCache('/api/price-list?perPage=1000'), null, 'updates invalidate the canonical table list')

  writeCache('/api/package-transactions', ['stale'])
  writeCache('/api/customer-packages?page=1', ['stale'])
  globalThis.fetch = (async () => jsonResponse({
    kind: 'transaction_write_failed',
    customerPackageId: 'package-1',
    message: 'reply lost after write',
    certainty: 'unknown',
  })) as typeof fetch
  await appendPackageTransaction({
    customerPackageId: 'package-1',
    type: 'USAGE',
    creditChange: -1,
    createdBy: 'dry-test',
  })
  assert.equal(readCache('/api/package-transactions'), null, 'unknown non-created outcome clears its own resource')
  assert.equal(readCache('/api/customer-packages?page=1'), null, 'unknown non-created outcome clears the dependent view')

  writeCache('/api/package-transactions', ['stale'])
  writeCache('/api/customer-packages?page=1', ['stale'])
  globalThis.fetch = (async () => jsonResponse({
    kind: 'package_write_failed',
    customerPackageId: 'package-2',
    transactionId: 'transaction-2',
    openingCredit: 10,
    message: 'package row rejected after transaction write',
    certainty: 'rejected',
  })) as typeof fetch
  await createCustomerPackage({
    customerId: 'customer-1',
    packageCode: 'PACKAGE-1',
    createdBy: 'dry-test',
  })
  assert.equal(readCache('/api/package-transactions'), null, 'partial package outcome clears the written transaction table')
  assert.equal(readCache('/api/customer-packages?page=1'), null, 'partial package outcome clears its possibly changed view')

  writeCache('/api/invoices?page=1', ['stale'])
  writeCache('/api/work-orders?page=1', ['stale'])
  writeCache('/api/orders?customerId=customer-1', ['stale'])
  globalThis.fetch = (async () => jsonResponse({
    kind: 'invoice_view_sync_failed',
    invoiceNumber: 'INV-1',
    message: 'sync failed',
    certainty: 'rejected',
  })) as typeof fetch
  await createInvoice({} as never)
  assert.equal(readCache('/api/invoices?page=1'), null)
  assert.equal(readCache('/api/work-orders?page=1'), null)
  assert.equal(readCache('/api/orders?customerId=customer-1'), null)
} finally {
  globalThis.fetch = originalFetch
  invalidate()
}

console.log('write-outcome-invalidation.dry-test: OK (update and non-created outcomes)')
