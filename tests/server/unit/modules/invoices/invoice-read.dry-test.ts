import assert from 'node:assert/strict'
import type { z } from 'zod'
import type { InvoiceHeaderPort, InvoiceItemReader, InvoiceItemWriter, PaymentReader } from '../../../../../server/modules/invoices/invoice.service.js'
import type { invoicesRowSchema } from '../../../../../server/sheets/Invoices/Invoices.db-contract.js'
import type { invoiceItemsRowSchema } from '../../../../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import type { paymentsRowSchema } from '../../../../../server/sheets/Payments/Payments.db-contract.js'

const { InvoiceService } = await import('../../../../../server/modules/invoices/invoice.service.js')
const { ApiError } = await import('../../../../../server/shared/http/api-error.js')

type InvoiceRow = Partial<z.infer<typeof invoicesRowSchema>>
type ItemRow = Partial<z.infer<typeof invoiceItemsRowSchema>>
type PaymentRow = Partial<z.infer<typeof paymentsRowSchema>>

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function header(invoiceNumber: string, overrides: InvoiceRow = {}): InvoiceRow {
  return {
    invoice_number: invoiceNumber,
    status: 'ISSUED',
    billing_type: 'ORDER',
    billing_period_start: null,
    billing_period_end: null,
    issued_date: '2026-09-01',
    due_date: '2026-09-30',
    customer_id: 'CUS-001',
    customer: JSON.stringify({ customer_code: 'CUS-001', customer_name: 'Somchai', phone: null, address: null }),
    adjustments: '[]',
    ...overrides,
  }
}

function item(invoiceNumber: string, overrides: ItemRow = {}): ItemRow {
  return {
    invoice_number: invoiceNumber,
    invoice_item_id: 'item0001',
    item_no: 1,
    description: 'Laundry',
    quantity: 2,
    unit: 'KG',
    unit_price: 100,
    adjustments: '[]',
    ...overrides,
  }
}

function payment(invoiceNumber: string, overrides: PaymentRow = {}): PaymentRow {
  return {
    payment_id: 'PAY-001',
    invoice_number: invoiceNumber,
    amount: 50,
    method: 'CASH',
    status: 'VERIFIED',
    created_at: '2026-09-01T10:00:00+07:00',
    created_by: 'staff',
    deleted_at: null,
    ...overrides,
  }
}

function createService(input: {
  invoices?: InvoiceRow[]
  items?: ItemRow[]
  payments?: PaymentRow[]
  now?: Date
}) {
  const invoiceRepository: InvoiceHeaderPort = {
    read: async () => input.invoices ?? [],
    append: async (row) => row,
    update: async (_key, row) => row,
  }
  const invoiceItemRepository: InvoiceItemWriter = { batchAppend: async (rows) => rows }
  const invoiceItemReader: InvoiceItemReader = { read: async () => input.items ?? [] }
  const paymentRepository: PaymentReader = { read: async () => input.payments ?? [] }
  return new InvoiceService({
    invoiceRepository: () => invoiceRepository,
    invoiceItemRepository: () => invoiceItemRepository,
    invoiceItemReader: () => invoiceItemReader,
    paymentRepository: () => paymentRepository,
    now: () => input.now ?? new Date('2026-09-16T00:00:00Z'),
  })
}

test('list assembles source rows, filters, sorts, paginates, and returns the full filtered total', async () => {
  const invoices = [
    header('INV-001', { issued_date: '2026-09-01', customer_id: 'CUS-A', customer: JSON.stringify({ customer_code: 'CUS-A', customer_name: 'A' }) }),
    header('INV-002', { issued_date: '2026-09-02', customer_id: 'CUS-A', customer: JSON.stringify({ customer_code: 'CUS-A', customer_name: 'B' }) }),
    header('INV-003', { issued_date: '2026-09-03', customer_id: 'CUS-B' }),
  ]
  const service = createService({ invoices, items: invoices.map((row) => item(row.invoice_number!)) })
  const result = await service.list({
    keyword: 'INV-', customerId: 'CUS-A', status: 'UNPAID', dateFrom: '2026-09-01', dateTo: '2026-09-30',
    sortBy: 'issuedDate', sortOrder: 'desc', page: '2', perPage: '1',
  })

  assert.equal(result.pagination.total, 2)
  assert.deepEqual(result.pagination, { total: 2, page: 2, perPage: 1, totalPages: 2 })
  assert.deepEqual(result.items.map((row) => row.invoiceNumber), ['INV-001'])
  assert.equal('items' in result.items[0]!, false)
  assert.equal('payments' in result.items[0]!, false)
})

test('detail assembles calculator totals and active payment history from source rows', async () => {
  const service = createService({
    invoices: [header('INV-001', { adjustments: JSON.stringify([{ label: 'VAT', calculation: 'PERCENT', value: 7 }]) })],
    items: [item('INV-001', { adjustments: JSON.stringify([{ label: 'Discount', calculation: 'FIXED', value: -10 }]) })],
    payments: [
      payment('INV-001', { payment_id: 'PAY-1', amount: 100 }),
      payment('INV-001', { payment_id: 'PAY-2', amount: -20 }),
      payment('INV-001', { payment_id: 'PAY-3', amount: 999, status: 'PENDING' }),
      payment('INV-001', { payment_id: 'PAY-4', amount: 999, deleted_at: '2026-09-02T00:00:00+07:00' }),
    ],
  })

  const detail = await service.getById('INV-001')
  assert.equal(detail.subtotal, 180)
  assert.equal(detail.adjustmentTotal, 12.6)
  assert.equal(detail.grandTotal, 192.6)
  assert.equal(detail.paidAmount, 80)
  assert.equal(detail.balanceDue, 112.6)
  assert.equal(detail.status, 'PARTIALLY_PAID')
  assert.deepEqual(detail.payments.map((row) => row.paymentId), ['PAY-1', 'PAY-2', 'PAY-3'])
})

test('status derivation covers pass-through, paid, overdue, partial, and unpaid branches at the Bangkok date boundary', async () => {
  const statuses = [
    header('DRAFT', { status: 'DRAFT' }),
    header('CANCELLED', { status: 'CANCELLED' }),
    header('VOID', { status: 'VOID' }),
    header('PAID'),
    header('OVERDUE', { due_date: '2026-09-15' }),
    header('BOUNDARY', { due_date: '2026-09-16' }),
    header('PARTIAL'),
  ]
  const service = createService({
    invoices: statuses,
    items: statuses.map((row) => item(row.invoice_number!)),
    payments: [payment('PAID', { amount: 200 }), payment('OVERDUE', { amount: 50 }), payment('PARTIAL', { amount: 50 })],
    now: new Date('2026-09-15T17:30:00Z'),
  })

  const result = await service.list({ page: '1', perPage: '20' })
  assert.deepEqual(Object.fromEntries(result.items.map((row) => [row.invoiceNumber, row.status])), {
    DRAFT: 'DRAFT', CANCELLED: 'CANCELLED', VOID: 'VOID', PAID: 'PAID', OVERDUE: 'OVERDUE', BOUNDARY: 'UNPAID', PARTIAL: 'PARTIALLY_PAID',
  })
})

test('all three source reads start before any one read resolves', async () => {
  const started: string[] = []
  const resolvers = new Map<string, (rows: never[]) => void>()
  const pending = (name: string) => new Promise<never[]>((resolve) => { started.push(name); resolvers.set(name, resolve) })
  const invoiceRepository: InvoiceHeaderPort = { read: () => pending('Invoices'), append: async (row) => row, update: async (_key, row) => row }
  const invoiceItemReader: InvoiceItemReader = { read: () => pending('InvoiceItems') }
  const paymentRepository: PaymentReader = { read: () => pending('Payments') }
  const service = new InvoiceService({
    invoiceRepository: () => invoiceRepository,
    invoiceItemReader: () => invoiceItemReader,
    paymentRepository: () => paymentRepository,
  })

  const result = service.list({ page: '1', perPage: '20' })
  assert.deepEqual(started, ['Invoices', 'InvoiceItems', 'Payments'])
  for (const resolve of resolvers.values()) resolve([])
  assert.equal((await result).pagination.total, 0)
})

test('assembled values match the former view fixture values', async () => {
  const service = createService({
    invoices: [header('INV-001')],
    items: [item('INV-001')],
    payments: [payment('INV-001', { amount: 200 })],
  })
  const detail = await service.getById('INV-001')
  assert.deepEqual(
    { grandTotal: detail.grandTotal, paidAmount: detail.paidAmount, balanceDue: detail.balanceDue, status: detail.status },
    { grandTotal: 200, paidAmount: 200, balanceDue: 0, status: 'PAID' },
  )
})

test('detail returns not found when the source header is absent', async () => {
  const service = createService({})
  await assert.rejects(() => service.getById('INV-MISSING'), (error: unknown) => error instanceof ApiError && error.status === 404)
})

for (const item of tests) await item.run()
console.log(`${tests.length} invoice read dry tests passed`)
