// One-off follow-up to restore-firebase-invoices.ts after its --write run stopped at InvoiceItems:
// 1. replace the invoice_item_id cells Sheets turned into numbers, 2. append the planned Payments.
// npx tsx --env-file=.env.local scripts/one-off/restore-firebase-invoices-finish.ts <restore-plan.json> [--write]
import { readFileSync } from 'node:fs'
import { getInvoiceItemsRepository } from '../../server/sheets/InvoiceItems/InvoiceItems.repository.js'
import { getPaymentsRepository } from '../../server/sheets/Payments/Payments.repository.js'
import { paymentsRowSchema } from '../../server/sheets/Payments/Payments.db-contract.js'
import { SheetsApiClient } from '../../server/shared/repositories/sheets-api.client.js'
import { generateShortId } from '../../server/shared/utils/id.js'

const [planPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!planPath) throw new Error('Pass the restore-plan.json written by the --write run')
const WRITE = process.argv.includes('--write')
const plan = JSON.parse(readFileSync(planPath, 'utf8'))
const restored = new Set<string>(plan.invoiceRows.map((r: any) => r.invoice_number))

const [items, payments] = await Promise.all([getInvoiceItemsRepository().readSourceRows(), getPaymentsRepository().readSourceRows()])
const usedIds = new Set(items.map((r) => String(r.invoice_item_id)))
const fixes = items.flatMap((r, index) => {
  if (!restored.has(String(r.invoice_number)) || typeof r.invoice_item_id === 'string') return []
  let id = generateShortId()
  while (usedIds.has(id)) id = generateShortId()
  usedIds.add(id)
  return [{ row: index + 2, invoice: r.invoice_number, itemNo: r.item_no, was: r.invoice_item_id, id }]
})

const existingPaymentIds = new Set(payments.map((r) => String(r.payment_id)))
const alreadyPaid = payments.filter((r) => restored.has(String(r.invoice_number)))
const paymentRows = plan.paymentRows.map((r: any) => ({
  ...r,
  reference: r.reference && !String(r.reference).startsWith("'") ? `'${r.reference}` : r.reference,
}))
const clash = paymentRows.filter((r: any) => existingPaymentIds.has(r.payment_id)).map((r: any) => r.payment_id)
const invalid = paymentRows.filter((r: any) => !paymentsRowSchema.safeParse(r).success).map((r: any) => r.payment_id)

console.log(JSON.stringify({ mode: WRITE ? 'WRITE' : 'DRY_RUN', itemIdFixes: fixes, payments: paymentRows.length,
  paymentsAlreadyOnRestoredInvoices: alreadyPaid.length, paymentIdClashes: clash, invalidPayments: invalid }, null, 1))

if (WRITE) {
  if (alreadyPaid.length || clash.length || invalid.length) throw new Error('Aborted: payments precheck failed')
  if (fixes.length) {
    const client = new SheetsApiClient({ spreadsheetId: process.env.INVOICES_SPREADSHEET_ID!, sheetName: 'InvoiceItems' })
    await client.updateCells(fixes.map((f) => ({ range: `'InvoiceItems'!B${f.row}`, values: [[f.id]] })), 'USER_ENTERED')
    console.log(`InvoiceItems ids fixed: ${fixes.length}`)
  }
  await getPaymentsRepository().batchAppend(paymentRows)
  console.log(`Payments appended: ${paymentRows.length}`)
}
