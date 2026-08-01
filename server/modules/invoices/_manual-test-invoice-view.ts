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

const { invoiceViewService } = await import('./invoice-view.module.js')

console.log('--- list ---')
const listResult = await invoiceViewService.list({
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
  const detail = await invoiceViewService.getById(firstInvoiceNumber)
  console.log(JSON.stringify(detail, null, 2))
} else {
  console.log('--- no rows in InvoicesView, skipping detail call ---')
}
