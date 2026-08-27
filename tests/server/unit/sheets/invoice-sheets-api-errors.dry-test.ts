import assert from 'node:assert/strict'
import type { CreateInvoiceRequest } from '../../../../contracts/invoices/invoice-api.schema.js'
import {
  InvoiceService,
  type InvoiceHeaderPort,
  type InvoiceItemWriter,
  type InvoiceViewReader,
  type OrderFormWriter,
} from '../../../../server/modules/invoices/invoice.service.js'
import {
  WriteCommittedUnreadableError,
  WriteRejectedError,
  WriteTransportError,
} from '../../../../server/shared/repositories/sheets-api.client.js'
import { DuplicateRowKeyError } from '../../../../server/shared/repositories/sheet-row-lookup.js'
import { WriteRowIdentityMismatchError } from '../../../../server/shared/repositories/sheet-row-identity.js'

const request: CreateInvoiceRequest = {
  invoiceNumber: 'INV-ERROR-1',
  sourceOrderId: 'ORD-ERROR-1',
  issuedDate: '2026-08-10',
  dueDate: '2026-08-20',
  customer: { customerCode: 'CUS-1', customerName: 'Test customer' },
  adjustments: [],
  items: [{ description: 'Wash', quantity: 1, unitPrice: 100, adjustments: [] }],
}

function serviceWithOrderLinkError(error: unknown): InvoiceService {
  const invoiceItemRepository: InvoiceItemWriter = {
    async batchAppend(rows) {
      return rows
    },
  }
  const invoiceRepository: InvoiceHeaderPort = {
    async read() {
      return []
    },
    async append(data) {
      return data
    },
    async update(_id, data) {
      return data
    },
  }
  const orderFormRepository: OrderFormWriter = {
    async update() {
      throw error
    },
  }
  const invoiceViewRepository: InvoiceViewReader = { read: async () => [] }

  return new InvoiceService({
    invoiceItemRepository: () => invoiceItemRepository,
    invoiceRepository: () => invoiceRepository,
    orderFormRepository: () => orderFormRepository,
    invoiceViewRepository,
    syncInvoiceView: async () => ({ outcome: 'confirmed' }),
  })
}

async function main(): Promise<void> {
  const cases: Array<{ name: string; error: Error; certainty: 'rejected' | 'unknown' }> = [
    {
      name: 'WriteRejectedError',
      error: new WriteRejectedError('UPDATE', 'request rejected'),
      certainty: 'rejected',
    },
    {
      name: 'WriteTransportError',
      error: new WriteTransportError('UPDATE', 'no authoritative response'),
      certainty: 'unknown',
    },
    {
      name: 'WriteCommittedUnreadableError',
      error: new WriteCommittedUnreadableError('UPDATE'),
      certainty: 'unknown',
    },
    {
      name: 'DuplicateRowKeyError',
      error: new DuplicateRowKeyError('id', 'ORD-ERROR-1', [2, 7]),
      certainty: 'rejected',
    },
    {
      name: 'WriteRowIdentityMismatchError',
      error: new WriteRowIdentityMismatchError('row identity changed'),
      certainty: 'unknown',
    },
  ]

  for (const current of cases) {
    const result = await serviceWithOrderLinkError(current.error).create(request)
    assert.equal(result.kind, 'order_link_failed', current.name)
    if (result.kind === 'order_link_failed') {
      assert.equal(result.certainty, current.certainty, current.name)
    }
  }

  console.log(`${cases.length} Sheets API error certainty mappings passed`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
