import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ModuleApiContract } from '../../../../../contracts/shared/module-api-contract.js'
import * as invoiceApi from '../../../../../contracts/invoices/invoice-api.schema.js'
import { invoicesDbContract } from '../../../../../server/sheets/Invoices/Invoices.db-contract.js'

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void): void {
  tests.push({ name, run })
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '.git' || entry.name === '.worktrees' || entry.name === 'node_modules'
        ? []
        : filesUnder(path)
    }
    return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [path] : []
  })
}

test('the merged invoice contract exposes every required API capability', () => {
  const contract: ModuleApiContract = invoiceApi.invoiceApiContract

  assert.notEqual(contract, undefined, 'invoiceApiContract must be exported from invoice-api.schema')
  if (contract === undefined) return

  assert.equal(contract.query.list, invoiceApi.invoiceListQuerySchema)
  assert.equal(contract.request?.create, invoiceApi.invoiceCreateSchema)
  assert.equal(contract.request?.update, invoiceApi.invoiceStatusUpdateSchema)
  assert.equal(contract.response.list, invoiceApi.invoiceListResponseSchema)
  assert.equal(contract.response.detail, invoiceApi.invoiceDetailResponseSchema)
  assert.equal(contract.response.create, invoiceApi.createInvoiceSuccessSchema)

  const update = contract.response.update?.safeParse({
    invoiceNumber: 'INV-0001',
    status: 'CANCELLED',
    viewSynced: true,
  })
  assert.ok(update?.success, 'response.update must accept the update success response')
})

test('invoiceStatusUpdateSchema accepts only the two invalidation statuses and no extra fields', () => {
  for (const status of ['CANCELLED', 'VOID']) {
    assert.deepEqual(invoiceApi.invoiceStatusUpdateSchema.parse({ status }), { status })
  }

  for (const body of [
    { status: 'PAID' },
    { status: 'ISSUED' },
    { status: 'DRAFT' },
    { status: 'CANCELLED', updatedBy: 'client' },
  ]) {
    assert.equal(invoiceApi.invoiceStatusUpdateSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('createInvoiceResponseSchema remains the standalone six-kind union', () => {
  const kinds = [
    { kind: 'created', invoiceNumber: 'INV-0001', itemCount: 1, itemsTotal: 100, invoiceTotal: 100 },
    { kind: 'validation_error', issues: [{ path: 'invoiceNumber', message: 'Required' }] },
    { kind: 'items_write_failed', message: 'x', certainty: 'rejected' },
    { kind: 'invoice_write_failed', invoiceNumber: 'INV-0001', itemCount: 1, certainty: 'unknown' },
    { kind: 'order_link_failed', invoiceNumber: 'INV-0001', sourceOrderId: 'ORD-0001', certainty: 'rejected' },
    { kind: 'invoice_view_sync_failed', invoiceNumber: 'INV-0001', message: 'x', certainty: 'unknown' },
  ]

  for (const outcome of kinds) {
    assert.ok(invoiceApi.createInvoiceResponseSchema.safeParse(outcome).success, outcome.kind)
  }
})

test('the retired invoice-view contract file and every import of it are absent', () => {
  const repositoryRoot = join(process.cwd())
  const retiredPath = join(repositoryRoot, 'contracts', 'invoices', 'invoice-view-api.schema.ts')
  assert.equal(existsSync(retiredPath), false)

  const retiredImport = /(?:from|import)\s*(?:\([^)]*|[^'"\n]*)['"][^'"\n]*invoice-view-api\.schema/
  const importers = filesUnder(repositoryRoot).filter((path) => retiredImport.test(readFileSync(path, 'utf8')))
  assert.deepEqual(importers, [])
})

test('the Invoices sheet declares status updates as an enabled write capability', () => {
  assert.equal(invoicesDbContract.writes.update, true)
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} invoice API contract tests passed`)
