/**
 * Read-only live-sheet check for the invoice-number preflight.
 *
 * This script discovers an existing invoice number from the live Invoices
 * sheet, then exercises the service's private read helper against that number
 * and a random impossible suffix. It uses the repository's GViz read path and
 * never calls InvoiceService.create or any repository write method.
 *
 * Run with:
 * node --env-file=.env.local --import=tsx/esm tests/server/integration/invoice-number-preflight.ts
 */

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { InvoiceService } from '../../../server/modules/invoices/invoice.service.js'
import { getInvoicesRepository } from '../../../server/sheets/Invoices/Invoices.repository.js'

interface InvoiceNumberPreflight {
  invoiceNumberAlreadyUsed(invoiceNumber: string): Promise<boolean>
}

async function main(): Promise<void> {
  const invoicesRepository = getInvoicesRepository()
  const rows = await invoicesRepository.read()
  const existingInvoiceNumber = rows
    .map((row) => row.invoice_number)
    .find((invoiceNumber): invoiceNumber is string =>
      typeof invoiceNumber === 'string' && invoiceNumber.trim() !== '',
    )

  if (existingInvoiceNumber === undefined) {
    throw new Error('Invoices sheet returned no existing invoice_number to verify')
  }

  const service = new InvoiceService({
    invoiceRepository: () => invoicesRepository,
  })
  const preflight = service as unknown as InvoiceNumberPreflight

  assert.equal(await preflight.invoiceNumberAlreadyUsed(existingInvoiceNumber), true)

  const impossibleInvoiceNumber = `CLERK-PREFLIGHT-${randomUUID()}`
  assert.equal(await preflight.invoiceNumberAlreadyUsed(impossibleInvoiceNumber), false)

  console.log(`invoice-number-preflight: discovered ${existingInvoiceNumber} => true`)
  console.log(`invoice-number-preflight: ${impossibleInvoiceNumber} => false`)
  console.log('invoice-number-preflight: PASS (GViz reads only; no create or write called)')
}

main().catch((error) => {
  console.error(
    `invoice-number-preflight: UNRUN/FAIL — ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exitCode = 1
})
