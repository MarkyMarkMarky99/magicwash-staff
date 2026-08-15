import assert from 'node:assert/strict'
import type { CreateInvoiceRequest } from '../../../../../contracts/invoices/invoice-api.schema.js'
import type {
  InvoiceHeaderWriter,
  InvoiceItemWriter,
  InvoiceViewReader,
  OrderFormWriter,
  ViewSyncFn,
} from '../../../../../server/modules/invoices/invoice.service.js'
import type { InvoiceViewSyncResult } from '../../../../../server/modules/invoices/invoice-view-sync-client.js'
import {
  WriteRejectedError,
  WriteTransportError,
} from '../../../../../server/shared/repositories/sheets-api.client.js'

const { InvoiceService, invoicesFieldMap, invoiceItemsFieldMap } = await import(
  '../../../../../server/modules/invoices/invoice.service.js'
)

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

interface Fakes {
  service: InstanceType<typeof InvoiceService>
  calls: string[]
  invoiceAppendCalls: Record<string, unknown>[]
  orderFormUpdateCalls: Array<{ id: string; data: Record<string, unknown> }>
}

interface FakeConfig {
  itemsError?: unknown
  invoiceError?: unknown
  orderFormError?: unknown
  viewSyncResult?: InvoiceViewSyncResult
  viewSyncError?: unknown
}

function createService(config: FakeConfig = {}): Fakes {
  const calls: string[] = []
  const invoiceAppendCalls: Record<string, unknown>[] = []
  const orderFormUpdateCalls: Array<{ id: string; data: Record<string, unknown> }> = []

  const invoiceItemRepository: InvoiceItemWriter = {
    async batchAppend(rows) {
      calls.push('InvoiceItem.batchAppend')
      if (config.itemsError) throw config.itemsError
      return rows.map((row) => ({ ...row }))
    },
  }

  const invoiceRepository: InvoiceHeaderWriter = {
    async append(data) {
      calls.push('Invoice.create')
      invoiceAppendCalls.push(data as Record<string, unknown>)
      if (config.invoiceError) throw config.invoiceError
      return { ...data }
    },
  }

  const orderFormRepository: OrderFormWriter = {
    async update(id, data) {
      calls.push('OrderForm.update')
      orderFormUpdateCalls.push({ id, data: data as Record<string, unknown> })
      if (config.orderFormError) throw config.orderFormError
      return { id, ...data }
    },
  }

  const syncInvoiceView: ViewSyncFn = async (invoiceNumber) => {
    calls.push('ViewSync')
    if (config.viewSyncError) throw config.viewSyncError
    return config.viewSyncResult ?? { outcome: 'confirmed' }
  }

  const invoiceViewRepository: InvoiceViewReader = { read: async () => [] }

  const service = new InvoiceService({
    invoiceRepository: () => invoiceRepository,
    invoiceItemRepository: () => invoiceItemRepository,
    orderFormRepository: () => orderFormRepository,
    invoiceViewRepository,
    syncInvoiceView,
    generateItemId: (() => {
      let n = 0
      return () => `item${String(n++).padStart(4, '0')}`
    })(),
  })

  return { service, calls, invoiceAppendCalls, orderFormUpdateCalls }
}

function baseRequest(): CreateInvoiceRequest {
  return {
    invoiceNumber: 'INV-0001',
    sourceOrderId: 'ORD-0001',
    issuedDate: '2026-07-29',
    dueDate: '2026-08-12',
    customer: {
      customerCode: 'CUS-0001',
      customerName: 'Somchai',
    },
    adjustments: [],
    items: [
      {
        description: 'Wash and fold',
        quantity: 2,
        unitPrice: 100,
        adjustments: [],
      },
    ],
  }
}

test('Invoices and InvoiceItems field maps pin every DB-to-API value', () => {
  assert.deepEqual(invoicesFieldMap, {
    invoice_number: 'invoiceNumber',
    status: 'status',
    billing_type: 'billingType',
    billing_period_start: 'billingPeriodStart',
    billing_period_end: 'billingPeriodEnd',
    issued_date: 'issuedDate',
    due_date: 'dueDate',
    customer_id: 'customerId',
    customer: 'customer',
    adjustments: 'adjustments',
    created_by: 'createdBy',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    updated_by: 'updatedBy',
    deleted_at: 'deletedAt',
    deleted_by: 'deletedBy',
  })
  assert.deepEqual(invoiceItemsFieldMap, {
    invoice_number: 'invoiceNumber',
    invoice_item_id: 'invoiceItemId',
    item_no: 'itemNo',
    source_order_id: 'sourceOrderId',
    source_item_id: 'sourceItemId',
    sku: 'sku',
    service_type: 'serviceType',
    description: 'description',
    quantity: 'quantity',
    unit: 'unit',
    unit_price: 'unitPrice',
    subtotal: 'subtotal',
    adjustments: 'adjustments',
    net_total: 'netTotal',
  })
})

test('create() returns "created" and calls stages in the exact required order, once each', async () => {
  const { service, calls, invoiceAppendCalls, orderFormUpdateCalls } = createService()

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'created')
  assert.deepEqual(calls, ['InvoiceItem.batchAppend', 'Invoice.create', 'OrderForm.update', 'ViewSync'])
  assert.equal('created_at' in invoiceAppendCalls[0]!, false)
  assert.equal('updated_at' in orderFormUpdateCalls[0]!.data, false)
  if (result.kind === 'created') {
    assert.equal(result.invoiceNumber, 'INV-0001')
    assert.equal(result.itemCount, 1)
    assert.equal(result.itemsTotal, 200)
    assert.equal(result.invoiceTotal, 200)
  }
})

test('create() computes server-side totals — client-sent numbers are never trusted (there are none to trust)', async () => {
  const { service } = createService()

  const request = baseRequest()
  request.items = [
    { description: 'Item A', quantity: 10, unitPrice: 50, adjustments: [{ label: 'Discount', calculation: 'FIXED', value: -10 }] },
  ]

  const result = await service.create(request)
  assert.equal(result.kind, 'created')
  if (result.kind === 'created') {
    // FIXED -10 applies PER UNIT before the × quantity multiply: 400, not 490.
    assert.equal(result.itemsTotal, 400)
    assert.equal(result.invoiceTotal, 400)
  }
})

test('create() rejects invalid input as validation_error and calls no repository', async () => {
  const { service, calls } = createService()

  const result = await service.create({ invoiceNumber: '' })

  assert.equal(result.kind, 'validation_error')
  assert.deepEqual(calls, [])
})

test('create() reports items_write_failed and stops before Invoice.create on a definite rejection', async () => {
  const { service, calls } = createService({
    itemsError: new WriteRejectedError('APPEND', 'bad batch'),
  })

  const result = await service.create(baseRequest())

  assert.deepEqual(result, {
    kind: 'items_write_failed',
    message: 'bad batch',
    certainty: 'rejected',
  })
  assert.deepEqual(calls, ['InvoiceItem.batchAppend'])
})

test('create() still reports items_write_failed for an unknown transport outcome, but certainty is "unknown" and the message says so truthfully', async () => {
  const { service, calls } = createService({
    itemsError: new WriteTransportError('APPEND', 'network hiccup'),
  })

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'items_write_failed')
  if (result.kind === 'items_write_failed') {
    assert.equal(result.certainty, 'unknown')
    assert.match(result.message, /outcome unknown/i)
    assert.match(result.message, /network hiccup/)
  }
  assert.deepEqual(calls, ['InvoiceItem.batchAppend'])
})

test('create() classifies an unrecognized write error as unknown', async () => {
  const { service, calls } = createService({
    itemsError: new Error('unexpected write failure'),
  })

  const result = await service.create(baseRequest())

  assert.deepEqual(result, {
    kind: 'items_write_failed',
    message: 'unexpected write failure',
    certainty: 'unknown',
  })
  assert.deepEqual(calls, ['InvoiceItem.batchAppend'])
})

test('create() reports invoice_write_failed with certainty "rejected" after items already succeeded, and stops before OrderForm.update', async () => {
  const { service, calls } = createService({
    invoiceError: new WriteRejectedError('APPEND', 'duplicate invoice_number'),
  })

  const result = await service.create(baseRequest())

  assert.deepEqual(result, {
    kind: 'invoice_write_failed',
    invoiceNumber: 'INV-0001',
    itemCount: 1,
    certainty: 'rejected',
  })
  assert.deepEqual(calls, ['InvoiceItem.batchAppend', 'Invoice.create'])
})

test('create() reports invoice_write_failed with certainty "unknown" for an unconfirmed header write', async () => {
  const { service } = createService({
    invoiceError: new WriteTransportError('APPEND', 'network hiccup'),
  })

  const result = await service.create(baseRequest())

  assert.deepEqual(result, {
    kind: 'invoice_write_failed',
    invoiceNumber: 'INV-0001',
    itemCount: 1,
    certainty: 'unknown',
  })
})

test('create() reports order_link_failed — never invoice_write_failed — after a successful invoice write, with correct certainty for both a definite rejection and an unknown transport outcome', async () => {
  const rejected = createService({
    orderFormError: new WriteRejectedError('UPDATE', 'OrderForm row not found'),
  })
  const rejectedResult = await rejected.service.create(baseRequest())
  assert.deepEqual(rejectedResult, {
    kind: 'order_link_failed',
    invoiceNumber: 'INV-0001',
    sourceOrderId: 'ORD-0001',
    certainty: 'rejected',
  })
  assert.deepEqual(rejected.calls, ['InvoiceItem.batchAppend', 'Invoice.create', 'OrderForm.update'])

  const unknown = createService({
    orderFormError: new WriteTransportError('UPDATE', 'network hiccup'),
  })
  const unknownResult = await unknown.service.create(baseRequest())
  assert.deepEqual(unknownResult, {
    kind: 'order_link_failed',
    invoiceNumber: 'INV-0001',
    sourceOrderId: 'ORD-0001',
    certainty: 'unknown',
  })
})

test('create() reports invoice_view_sync_failed after every source write is complete, passing certainty through from the sync client', async () => {
  const { service, calls } = createService({
    viewSyncResult: { outcome: 'failed', certainty: 'rejected', message: 'View unavailable' },
  })

  const result = await service.create(baseRequest())

  assert.deepEqual(result, {
    kind: 'invoice_view_sync_failed',
    invoiceNumber: 'INV-0001',
    message: 'View unavailable',
    certainty: 'rejected',
  })
  assert.deepEqual(calls, ['InvoiceItem.batchAppend', 'Invoice.create', 'OrderForm.update', 'ViewSync'])
})

test('create() reports invoice_view_sync_failed with certainty "unknown" when the sync client never got a definite answer', async () => {
  const { service } = createService({
    viewSyncResult: { outcome: 'failed', certainty: 'unknown', message: 'timed out' },
  })

  const result = await service.create(baseRequest())

  assert.deepEqual(result, {
    kind: 'invoice_view_sync_failed',
    invoiceNumber: 'INV-0001',
    message: 'timed out',
    certainty: 'unknown',
  })
})

test('create() catches a thrown/rejected syncInvoiceView instead of letting it escape — a blank result panel is worse than a reported failure', async () => {
  // An injected sync throw becomes an unknown outcome after earlier stages
  // have completed, so callers still receive an invoice-create result.
  const { service, calls } = createService({
    viewSyncError: new Error('sync client blew up'),
  })

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'invoice_view_sync_failed')
  if (result.kind === 'invoice_view_sync_failed') {
    assert.equal(result.certainty, 'unknown')
    assert.equal(result.message, 'sync client blew up')
  }
  assert.deepEqual(calls, ['InvoiceItem.batchAppend', 'Invoice.create', 'OrderForm.update', 'ViewSync'])
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice service dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
