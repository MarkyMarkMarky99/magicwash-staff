import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(new URL(`../../../../src/${path}`, import.meta.url), 'utf8')
}

const customerPackageService = source('data/customer-packages/customer-package.service.ts')
const customerPackagesStore = source('data/customer-packages/customer-packages-by-customer.store.ts')
assert.match(customerPackageService, /invalidate\('\/api\/customer-packages'\)/)
assert.match(customerPackagesStore, /onCacheInvalidated\('\/api\/customer-packages'[\s\S]*load\(activeCustomerId, true\)/)

const invoiceService = source('data/invoices/invoice.service.ts')
const customerInvoicesStore = source('data/invoices/customer-invoices.store.ts')
assert.match(invoiceService, /invalidate\('\/api\/invoices'\)/)
assert.match(customerInvoicesStore, /onCacheInvalidated\('\/api\/invoices'[\s\S]*load\(activeCustomerId, true\)/)

console.log('customer form invalidation dry tests passed')
