import assert from 'node:assert/strict'
import type {
  InvoiceHeaderPort,
  InvoiceItemWriter,
  InvoiceViewReader,
  OrderFormWriter,
  ViewSyncFn,
} from '../../../../../server/modules/invoices/invoice.service.js'
import type { InvoiceViewSyncResult } from '../../../../../server/modules/invoices/invoice-view-sync-client.js'

type InvoiceReadRows = Awaited<ReturnType<InvoiceHeaderPort['read']>>

const { InvoiceService } = await import('../../../../../server/modules/invoices/invoice.service.js')

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

interface FakeConfig {
  invoiceReadRows?: InvoiceReadRows
  invoiceUpdateError?: unknown
  viewSyncResult?: InvoiceViewSyncResult
  viewSyncError?: unknown
}

interface Fakes {
  service: InstanceType<typeof InvoiceService>
  calls: string[]
  updateCalls: Array<{ invoiceNumber: string; data: Record<string, unknown> }>
}

function invoiceRow(status: 'ISSUED' | 'CANCELLED' | 'VOID'): InvoiceReadRows {
  return [{ invoice_number: 'INV-0001', status }] as InvoiceReadRows
}

function createService(config: FakeConfig = {}): Fakes {
  const calls: string[] = []
  const updateCalls: Array<{ invoiceNumber: string; data: Record<string, unknown> }> = []

  const invoiceRepository: InvoiceHeaderPort = {
    async read(..._args: Parameters<InvoiceHeaderPort['read']>) {
      return config.invoiceReadRows ?? []
    },
    async append(...args: Parameters<InvoiceHeaderPort['append']>) {
      return args[0] as Awaited<ReturnType<InvoiceHeaderPort['append']>>
    },
    async update(...args: Parameters<InvoiceHeaderPort['update']>) {
      const [invoiceNumber, data] = args
      calls.push('Invoice.update')
      updateCalls.push({ invoiceNumber, data: data as Record<string, unknown> })
      if (config.invoiceUpdateError !== undefined) throw config.invoiceUpdateError
      return { invoice_number: invoiceNumber, ...data } as Awaited<ReturnType<InvoiceHeaderPort['update']>>
    },
  }

  const invoiceItemRepository: InvoiceItemWriter = {
    async batchAppend(rows) {
      return rows
    },
  }
  const orderFormRepository: OrderFormWriter = {
    async update(id, data) {
      return { id, ...data }
    },
  }
  const invoiceViewRepository: InvoiceViewReader = { read: async () => [] }
  const syncInvoiceView: ViewSyncFn = async () => {
    calls.push('ViewSync')
    if (config.viewSyncError !== undefined) throw config.viewSyncError
    return config.viewSyncResult ?? { outcome: 'confirmed' }
  }

  return {
    service: new InvoiceService({
      invoiceRepository: () => invoiceRepository,
      invoiceItemRepository: () => invoiceItemRepository,
      orderFormRepository: () => orderFormRepository,
      invoiceViewRepository,
      syncInvoiceView,
      generateItemId: () => 'item0000',
    }),
    calls,
    updateCalls,
  }
}

async function expectApiStatus(run: () => Promise<unknown>, status: number): Promise<void> {
  await assert.rejects(run, (error: unknown) => (error as { status?: unknown }).status === status)
}

function assertStatusPatch(
  updateCalls: Array<{ invoiceNumber: string; data: Record<string, unknown> }>,
  status: 'CANCELLED' | 'VOID',
): void {
  assert.deepEqual(updateCalls, [{ invoiceNumber: 'INV-0001', data: { status, updated_by: 'staff' } }])
  assert.equal('deleted_at' in updateCalls[0]!.data, false)
  assert.equal('deleted_by' in updateCalls[0]!.data, false)
}

test('update() commits CANCELLED for an issued invoice, syncs the view, and reports the sync result', async () => {
  const { service, calls, updateCalls } = createService({ invoiceReadRows: invoiceRow('ISSUED') })

  const result = await service.update('INV-0001', { status: 'CANCELLED' })

  assert.deepEqual(result, { invoiceNumber: 'INV-0001', status: 'CANCELLED', viewSynced: true })
  assert.deepEqual(calls, ['Invoice.update', 'ViewSync'])
  assertStatusPatch(updateCalls, 'CANCELLED')
})

test('update() commits VOID for an issued invoice', async () => {
  const { service, calls, updateCalls } = createService({ invoiceReadRows: invoiceRow('ISSUED') })

  const result = await service.update('INV-0001', { status: 'VOID' })

  assert.deepEqual(result, { invoiceNumber: 'INV-0001', status: 'VOID', viewSynced: true })
  assert.deepEqual(calls, ['Invoice.update', 'ViewSync'])
  assertStatusPatch(updateCalls, 'VOID')
})

test('update() is idempotent for an already CANCELLED invoice: it skips the write and retries view sync', async () => {
  const { service, calls, updateCalls } = createService({ invoiceReadRows: invoiceRow('CANCELLED') })

  const result = await service.update('INV-0001', { status: 'CANCELLED' })

  assert.deepEqual(result, { invoiceNumber: 'INV-0001', status: 'CANCELLED', viewSynced: true })
  assert.deepEqual(calls, ['ViewSync'])
  assert.deepEqual(updateCalls, [])
})

test('update() reports a failed view rebuild without undoing a committed status write', async () => {
  const { service, calls, updateCalls } = createService({
    invoiceReadRows: invoiceRow('ISSUED'),
    viewSyncError: new Error('sync unavailable'),
  })

  const result = await service.update('INV-0001', { status: 'CANCELLED' })

  assert.deepEqual(result, { invoiceNumber: 'INV-0001', status: 'CANCELLED', viewSynced: false })
  assert.deepEqual(calls, ['Invoice.update', 'ViewSync'])
  assert.equal(updateCalls.length, 1)
})

test('update() rejects invalid and non-strict payloads with 422 before a sheet write', async () => {
  for (const payload of [
    { status: 'PAID' },
    { status: 'ISSUED' },
    { status: 'DRAFT' },
    { status: 'CANCELLED', updatedBy: 'client' },
  ]) {
    const { service, calls, updateCalls } = createService({ invoiceReadRows: invoiceRow('ISSUED') })
    await expectApiStatus(() => service.update('INV-0001', payload), 422)
    assert.deepEqual(calls, [])
    assert.deepEqual(updateCalls, [])
  }
})

test('update() returns 404 for an unknown invoice without attempting a write or sync', async () => {
  const { service, calls, updateCalls } = createService()

  await expectApiStatus(() => service.update('INV-404', { status: 'CANCELLED' }), 404)
  assert.deepEqual(calls, [])
  assert.deepEqual(updateCalls, [])
})

test('update() returns 500 when the status write fails and does not report success or sync', async () => {
  const { service, calls } = createService({
    invoiceReadRows: invoiceRow('ISSUED'),
    invoiceUpdateError: new Error('Sheets write failed'),
  })

  await expectApiStatus(() => service.update('INV-0001', { status: 'VOID' }), 500)
  assert.deepEqual(calls, ['Invoice.update'])
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice status-update tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
