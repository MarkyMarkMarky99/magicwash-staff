import assert from 'node:assert/strict'
import type { CreateInvoiceRequest } from '../../../../contracts/invoices/invoice-api.schema.js'
import type {
  InvoiceHeaderWriter,
  InvoiceItemWriter,
  OrderFormWriter,
} from '../../../../server/modules/invoices/invoice.service.js'

/**
 * Layer 3 — Service orchestration workflow
 * (docs/invoice-module-refactor-plan.md's Workflow Test Plan).
 *
 * Uses real-shaped repository fakes that record calls and persisted rows,
 * asserting the exact sequence
 * `InvoiceItem.batchAppend -> Invoice.append -> OrderForm.update -> ViewSync`,
 * one call per stage, server-side totals/ids/status/audit fields, and no
 * automatic duplicate retry (the service never calls a failed stage twice).
 */

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'
process.env.TEST_SCRIPT_URL = 'https://script.example/exec'

const { InvoiceService } = await import('../../../../server/modules/invoices/invoice.service.js')
const { invoiceViewContract } = await import('../../../../server/modules/invoices/invoice-view.contract.js')
const { GSheetRepository } = await import('../../../../server/shared/repositories/gsheet.repository.js')

function baseRequest(): CreateInvoiceRequest {
  return {
    invoiceNumber: 'INV-0001',
    sourceOrderId: 'ORD-0001',
    issuedDate: '2026-07-29',
    dueDate: '2026-08-12',
    customer: { customerCode: 'CUS-0001', customerName: 'Somchai' },
    adjustments: [{ label: 'VAT', calculation: 'PERCENT', value: 7 }],
    items: [
      { description: 'Wash and fold', quantity: 2, unitPrice: 100, adjustments: [] },
    ],
  }
}

async function main(): Promise<void> {
  const calls: string[] = []
  let itemBatchCallCount = 0
  let headerCreateCallCount = 0
  let orderFormUpdateCallCount = 0
  let viewSyncCallCount = 0
  let persistedItemRows: unknown[] = []
  let persistedInvoiceCommand: unknown

  const invoiceItemRepository: InvoiceItemWriter = {
    async batchAppend(rows) {
      itemBatchCallCount += 1
      calls.push('InvoiceItem.batchAppend')
      persistedItemRows = rows
      return rows.map((row, index) => ({ ...row, invoiceItemId: `stored${index}` }))
    },
  }
  const invoiceRepository: InvoiceHeaderWriter = {
    async append(data) {
      headerCreateCallCount += 1
      calls.push('Invoice.create')
      persistedInvoiceCommand = data
      return { ...data }
    },
  }
  const orderFormRepository: OrderFormWriter = {
    async update(id, data) {
      orderFormUpdateCallCount += 1
      calls.push('OrderForm.update')
      return { id, ...data }
    },
  }

  const invoiceViewRepository = new GSheetRepository({
    contract: invoiceViewContract,
    sheetName: 'InvoicesView',
    spreadsheetId: 'TEST_SPREADSHEET_ID',
    scriptUrl: 'TEST_SCRIPT_URL',
    decodeJsonCells: true,
  })

  const service = new InvoiceService({
    invoiceItemRepository: () => invoiceItemRepository,
    invoiceRepository: () => invoiceRepository,
    orderFormRepository: () => orderFormRepository,
    invoiceViewRepository,
    syncInvoiceView: async () => {
      viewSyncCallCount += 1
      calls.push('ViewSync')
      return { outcome: 'confirmed' }
    },
    generateItemId: () => 'aaaaaaaa',
  })

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'created')
  assert.deepEqual(calls, ['InvoiceItem.batchAppend', 'Invoice.create', 'OrderForm.update', 'ViewSync'])
  assert.equal(itemBatchCallCount, 1, 'exactly one batch call, never a loop')
  assert.equal(headerCreateCallCount, 1)
  assert.equal(orderFormUpdateCallCount, 1)
  assert.equal(viewSyncCallCount, 1)

  // Server-side ids/status/audit fields: never client-supplied.
  assert.deepEqual(
    (persistedItemRows as Array<Record<string, unknown>>).map((row) => row.invoice_item_id),
    ['aaaaaaaa'],
  )
  const invoiceCommand = persistedInvoiceCommand as Record<string, unknown>
  assert.equal(invoiceCommand.status, 'ISSUED')
  assert.equal(invoiceCommand.billing_type, 'ORDER')
  assert.equal(invoiceCommand.created_by, 'staff')
  assert.equal(
    invoiceCommand.customer,
    JSON.stringify({ customer_code: 'CUS-0001', customer_name: 'Somchai' }),
  )
  assert.equal(
    invoiceCommand.adjustments,
    JSON.stringify([{ label: 'VAT', calculation: 'PERCENT', value: 7 }]),
  )
  assert.equal(
    (persistedItemRows[0] as Record<string, unknown>).adjustments,
    '[]',
  )

  // Server-computed totals: 200 subtotal, then invoice-level VAT 7% once.
  if (result.kind === 'created') {
    assert.equal(result.itemsTotal, 200)
    assert.equal(result.invoiceTotal, 214)
  }

  // ── No automatic duplicate retry: a failed stage is called exactly once,
  //    never retried by the service itself — and an un-typed thrown error
  //    (not a SheetLibRejectedError) is classified `certainty: 'unknown'`,
  //    never `'rejected'`, since this service never claims certainty it
  //    doesn't actually have. ──
  const failingItemsRepo: InvoiceItemWriter = {
    async batchAppend() {
      itemBatchCallCount += 1
      throw new Error('rejected')
    },
  }
  itemBatchCallCount = 0
  const retryProbeService = new InvoiceService({
    invoiceItemRepository: () => failingItemsRepo,
    invoiceRepository: () => invoiceRepository,
    orderFormRepository: () => orderFormRepository,
    invoiceViewRepository,
    syncInvoiceView: async () => ({ outcome: 'confirmed' }),
  })
  const failed = await retryProbeService.create(baseRequest())
  assert.equal(failed.kind, 'items_write_failed')
  if (failed.kind === 'items_write_failed') {
    assert.equal(failed.certainty, 'unknown')
  }
  assert.equal(itemBatchCallCount, 1, 'no automatic duplicate retry on a failed stage')

  console.log('1 invoice service orchestration workflow test passed (7 assertions)')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
