import assert from 'node:assert/strict'
import type {
  InvoiceHeaderPort,
  InvoiceItemWriter,
  InvoiceViewReader,
  OrderFormWriter,
  ViewSyncFn,
} from '../../../../../server/modules/invoices/invoice.service.js'
import type { InvoiceViewSyncResult } from '../../../../../server/modules/invoices/invoice-view-sync-client.js'

const { InvoiceService } = await import('../../../../../server/modules/invoices/invoice.service.js')
const { invoiceRoutes, invoiceService } = await import('../../../../../server/modules/invoices/invoice.module.js')

type InvoiceReadRows = Awaited<ReturnType<InvoiceHeaderPort['read']>>
type Status = 'ISSUED' | 'CANCELLED' | 'VOID'

interface FakeConfig {
  rows?: InvoiceReadRows
  writeError?: unknown
  syncResult?: InvoiceViewSyncResult
  syncError?: unknown
}

interface Fakes {
  service: InstanceType<typeof InvoiceService>
  reads: unknown[]
  writes: Array<{ invoiceNumber: string; patch: Record<string, unknown> }>
  syncs: string[]
}

function row(status: Status): InvoiceReadRows {
  return [{ invoice_number: 'INV-0001', status }] as InvoiceReadRows
}

function createService(config: FakeConfig): Fakes {
  const reads: unknown[] = []
  const writes: Array<{ invoiceNumber: string; patch: Record<string, unknown> }> = []
  const syncs: string[] = []

  const invoiceRepository: InvoiceHeaderPort = {
    async read(query) {
      reads.push(query)
      return config.rows ?? []
    },
    async append(data) {
      return data
    },
    async update(invoiceNumber, patch) {
      writes.push({ invoiceNumber, patch: patch as Record<string, unknown> })
      if (config.writeError !== undefined) throw config.writeError
      return { invoice_number: invoiceNumber, ...patch }
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
  const syncInvoiceView: ViewSyncFn = async (invoiceNumber) => {
    syncs.push(invoiceNumber)
    if (config.syncError !== undefined) throw config.syncError
    return config.syncResult ?? { outcome: 'confirmed' }
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
    reads,
    writes,
    syncs,
  }
}

async function expectStatus(run: () => Promise<unknown>, status: number): Promise<unknown> {
  let caught: unknown
  try {
    await run()
  } catch (error) {
    caught = error
  }
  assert.equal((caught as { status?: unknown } | undefined)?.status, status)
  return caught
}

async function main(): Promise<void> {
  {
    const fakes = createService({ rows: row('ISSUED') })
    const result = await fakes.service.update('INV-0001', { status: 'CANCELLED' })
    assert.deepEqual(result, { invoiceNumber: 'INV-0001', status: 'CANCELLED', viewSynced: true })
    assert.deepEqual(fakes.reads, [{ select: ['invoice_number', 'status'] }])
    assert.deepEqual(fakes.writes, [{
      invoiceNumber: 'INV-0001',
      patch: { status: 'CANCELLED', updated_by: 'staff' },
    }])
    assert.deepEqual(fakes.syncs, ['INV-0001'])
  }

  {
    const fakes = createService({ rows: row('VOID') })
    const result = await fakes.service.update('INV-0001', { status: 'VOID' })
    assert.deepEqual(result, { invoiceNumber: 'INV-0001', status: 'VOID', viewSynced: true })
    assert.deepEqual(fakes.writes, [])
    assert.deepEqual(fakes.syncs, ['INV-0001'])
  }

  {
    const fakes = createService({ rows: row('ISSUED'), syncResult: { outcome: 'failed', certainty: 'unknown', message: 'rebuild failed' } })
    const result = await fakes.service.update('INV-0001', { status: 'VOID' })
    assert.deepEqual(result, { invoiceNumber: 'INV-0001', status: 'VOID', viewSynced: false })
    assert.equal(fakes.writes.length, 1)
    assert.deepEqual(fakes.syncs, ['INV-0001'])
  }

  for (const payload of [
    { status: 'PAID' },
    { status: 'ISSUED' },
    { status: 'DRAFT' },
    { status: 'CANCELLED', updatedBy: 'client' },
  ]) {
    const fakes = createService({ rows: row('ISSUED') })
    await expectStatus(() => fakes.service.update('INV-0001', payload), 422)
    assert.deepEqual(fakes.reads, [])
    assert.deepEqual(fakes.writes, [])
    assert.deepEqual(fakes.syncs, [])
  }

  for (const invoiceNumber of ['', '   ']) {
    const fakes = createService({ rows: row('ISSUED') })
    await expectStatus(() => fakes.service.update(invoiceNumber, { status: 'VOID' }), 404)
    assert.deepEqual(fakes.reads, [])
  }

  {
    const fakes = createService({})
    await expectStatus(() => fakes.service.update('INV-404', { status: 'CANCELLED' }), 404)
    assert.deepEqual(fakes.writes, [])
    assert.deepEqual(fakes.syncs, [])
  }

  {
    const fakes = createService({ rows: row('PAID' as Status) })
    await expectStatus(() => fakes.service.update('INV-0001', { status: 'CANCELLED' }), 409)
    assert.deepEqual(fakes.writes, [])
    assert.deepEqual(fakes.syncs, [])
  }

  {
    const fakes = createService({ rows: row('ISSUED'), writeError: new Error('Sheets write failed') })
    const error = await expectStatus(() => fakes.service.update('INV-0001', { status: 'CANCELLED' }), 500)
    assert.deepEqual((error as { details?: unknown }).details, { stage: 'invoice_status_write', certainty: 'unknown' })
    assert.deepEqual(fakes.syncs, [])
  }

  {
    const originalUpdate = invoiceService.update
    try {
      invoiceService.update = async () => ({ invoiceNumber: 'INV-0001', status: 'VOID', viewSynced: true })
      const result = await invoiceRoutes.item!.handleRequest({
        method: 'PATCH',
        query: {},
        body: { status: 'VOID' },
        headers: {},
        params: { id: 'INV-0001' },
      })
      assert.equal(result.status, 200)
      assert.deepEqual(result.body && typeof result.body === 'object' ? {
        success: (result.body as { success?: unknown }).success,
        data: (result.body as { data?: unknown }).data,
        hasTimestamp: typeof (result.body as { meta?: { timestamp?: unknown }}).meta?.timestamp === 'string',
      } : result.body, {
        success: true,
        data: { invoiceNumber: 'INV-0001', status: 'VOID', viewSynced: true },
        hasTimestamp: true,
      })
    } finally {
      invoiceService.update = originalUpdate
    }
  }

  console.log('invoice status-update tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
