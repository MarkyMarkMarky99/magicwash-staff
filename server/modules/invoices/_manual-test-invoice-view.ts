import { readFileSync } from 'node:fs'

// Throwaway manual test — loads .env.local into process.env without touching
// the file, supplies a harmless placeholder for APPSCRIPT_URL (unused by a
// read-only call, but required-non-empty by GSheetRepository's constructor).
const envFile = readFileSync('.env.local', 'utf-8')
for (const line of envFile.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (!match) continue
  const [, key, rawValue] = match
  process.env[key] ??= rawValue.replace(/^"(.*)"$/, '$1')
}
process.env.APPSCRIPT_URL ??= 'https://unused-for-read-only-test.invalid/exec'

// Built directly from the repository/contract rather than importing
// invoice.module.ts, so this script has no dependency on that module's
// route/POST wiring — just the read path it's actually exercising.
const { BaseCrudService } = await import('../../shared/services/base-crud.service.js')
const { getInvoiceViewRepository } = await import('./invoice-view.repository.js')
const { invoiceViewContract } = await import('./invoice-view.contract.js')

const invoiceReadService = new BaseCrudService({
  repository: getInvoiceViewRepository(),
  api: invoiceViewContract.api,
  searchFields: ['invoiceNumber', 'customerId'],
})

console.log('--- list ---')
const listResult = await invoiceReadService.list({
  keyword: '',
  page: 1,
  perPage: 5,
  sortBy: 'issuedDate',
  sortOrder: 'desc',
})
console.log(JSON.stringify(listResult, null, 2))

const firstInvoiceNumber = listResult.items[0]?.invoiceNumber
if (firstInvoiceNumber) {
  console.log(`--- detail (${firstInvoiceNumber}) ---`)
  const detail = await invoiceReadService.getById(firstInvoiceNumber)
  console.log(JSON.stringify(detail, null, 2))
} else {
  console.log('--- no rows in InvoicesView, skipping detail call ---')
}
