import assert from 'node:assert/strict'
import type { CreateInvoiceRequest } from '../../../../../contracts/invoices/invoice-api.schema.js'
import type {
  InvoiceHeaderPort,
  InvoiceItemWriter,
  InvoiceViewReader,
  OrderFormWriter,
} from '../../../../../server/modules/invoices/invoice.service.js'

type InvoiceReadRows = Awaited<ReturnType<InvoiceHeaderPort['read']>>

const { InvoiceService } = await import('../../../../../server/modules/invoices/invoice.service.js')

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

interface FakeConfig {
  invoiceReadRows?: InvoiceReadRows
  invoiceReadError?: unknown
}

interface Fakes {
  service: InstanceType<typeof InvoiceService>
  calls: string[]
  invoiceReadCalls: unknown[]
}

function createService(config: FakeConfig = {}): Fakes {
  const calls: string[] = []
  const invoiceReadCalls: unknown[] = []

  const invoiceRepository: InvoiceHeaderPort = {
    async read(query) {
      invoiceReadCalls.push(query)
      if (config.invoiceReadError) throw config.invoiceReadError
      return config.invoiceReadRows ?? []
    },
    async append(data) {
      calls.push('Invoice.create')
      return { ...data }
    },
    async update(_id, data) {
      return data
    },
  }

  const invoiceItemRepository: InvoiceItemWriter = {
    async batchAppend(rows) {
      calls.push('InvoiceItem.batchAppend')
      return rows.map((row) => ({ ...row }))
    },
  }

  const orderFormRepository: OrderFormWriter = {
    async update(id, data) {
      calls.push('OrderForm.update')
      return { id, ...data }
    },
  }

  const invoiceViewRepository: InvoiceViewReader = { read: async () => [] }

  const service = new InvoiceService({
    invoiceRepository: () => invoiceRepository,
    invoiceItemRepository: () => invoiceItemRepository,
    orderFormRepository: () => orderFormRepository,
    invoiceViewRepository,
    syncInvoiceView: async () => {
      calls.push('ViewSync')
      return { outcome: 'confirmed' }
    },
    generateItemId: () => 'item0000',
  })

  return { service, calls, invoiceReadCalls }
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

test('invoice-number preflight selects only the physical invoice_number column', async () => {
  const { service, invoiceReadCalls } = createService({ invoiceReadRows: [{ invoice_number: 'INV-OTHER' }] })

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'created')
  assert.equal(invoiceReadCalls.length, 1)
  const query = invoiceReadCalls[0] as { select?: unknown }
  assert.deepEqual(query.select, ['invoice_number'])
})

test('invoice-number preflight does not use where, search, or exact-id filtering', async () => {
  const { service, invoiceReadCalls } = createService({ invoiceReadRows: [{ invoice_number: 'INV-OTHER' }] })

  await service.create(baseRequest())

  assert.equal(invoiceReadCalls.length, 1)
  const query = invoiceReadCalls[0]
  assert.ok(query !== null && typeof query === 'object')
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'where'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'search'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'id'), false)
})

test('a matching invoice number returns validation_error before any write', async () => {
  const { service, calls } = createService({ invoiceReadRows: [{ invoice_number: 'INV-0001' }] })

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'validation_error')
  if (result.kind === 'validation_error') {
    assert.equal(result.issues.length, 1)
    assert.equal(result.issues[0]?.path, 'invoiceNumber')
    assert.match(result.issues[0]?.message ?? '', /invoice number/i)
    assert.match(result.issues[0]?.message ?? '', /already in use/i)
  }
  assert.deepEqual(calls, [])
})

test('a nonmatching preflight result preserves creation write order', async () => {
  const { service, calls } = createService({ invoiceReadRows: [{ invoice_number: 'INV-OTHER' }] })

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'created')
  assert.deepEqual(calls, ['InvoiceItem.batchAppend', 'Invoice.create', 'OrderForm.update', 'ViewSync'])
})

test('a preflight read failure fails open into the established creation path', async () => {
  const { service, calls } = createService({ invoiceReadError: new Error('invoice read unavailable') })

  const result = await service.create(baseRequest())

  assert.equal(result.kind, 'created')
  assert.deepEqual(calls, ['InvoiceItem.batchAppend', 'Invoice.create', 'OrderForm.update', 'ViewSync'])
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice create preflight dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
