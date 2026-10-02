import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { createPortalSources, readPortalSource, sourceCell, reactCell } from '../../../../../server/modules/portal/portal-source-reader.js'
import { assemblePortalPackages } from '../../../../../server/modules/portal/portal-package.mapper.js'
import { PortalService } from '../../../../../server/modules/portal/portal.service.js'
import { createPortalRoutes } from '../../../../../server/modules/portal/portal.module.js'
import { ApiGateway } from '../../../../../server/shared/http/api-gateway.js'
import { portalCustomerResponseSchema } from '../../../../../contracts/portal/portal-api.schema.js'
import type { SourceRow } from '../../../../../server/modules/portal/portal.mapper.js'

let clock = 0
let calls = 0
let release!: (rows: SourceRow[]) => void
let fail = false
const sources = createPortalSources(async () => {
  calls++
  if (fail) throw new Error('unavailable')
  return new Promise<SourceRow[]>((resolve) => { release = resolve })
}, () => clock)
const first = sources.orders().read()
const second = sources.orders().read()
assert.equal(first, second)
await Promise.resolve()
assert.equal(calls, 1)
clock = 10_000
release([{ id: 'one' }])
await first
clock = 69_999
assert.equal((await sources.orders().read())[0]!.id, 'one')
assert.equal(calls, 1)
clock = 70_000
fail = true
await assert.rejects(sources.orders().read(), /unavailable/)
await assert.rejects(sources.orders().read(), /unavailable/)
assert.equal(calls, 3)
fail = false
const retry = sources.orders().read()
await Promise.resolve()
release([{ id: 'two' }])
await retry
assert.equal(calls, 4)
const other = sources.invoices().read()
await Promise.resolve()
release([])
await other
assert.equal(calls, 5)

assert.equal((sourceCell('Date(2026,9,3,12,34,56)') as Date).toISOString(), '2026-10-03T05:34:56.000Z')
assert.equal((sourceCell('Date(2026,9,3)') as Date).toISOString(), '2026-10-02T17:00:00.000Z')
assert.equal(reactCell(sourceCell('Date(2026,9,3,0,0,0)')), 'Date(2026,9,3,0,0,0)')
assert.equal(reactCell(sourceCell('Date(2026,9,3)'), true), '2026-10-03')
assert.equal(sourceCell(null), '')
assert.equal(sourceCell(12), 12)
assert.equal(reactCell(''), null)

const fetchBefore = globalThis.fetch
process.env.ORDERS_SPREADSHEET_ID = 'fixture'
globalThis.fetch = async (input) => {
  const url = new URL(String(input))
  assert.equal(url.searchParams.get('tq'), 'select A,B,C,D,E,F,G,H,N,S')
  assert.equal(url.searchParams.get('sheet'), 'OrderForm')
  assert.equal(url.searchParams.get('headers'), '1')
  assert.equal(url.searchParams.has('range'), false)
  return new Response('google.visualization.Query.setResponse(' + JSON.stringify({ status: 'ok', table: {
    cols: ['A','B','C','D','E','F','G','H','N','S'].map((id) => ({ id })),
    rows: [{ c: [{v: 'o'}, null, {v:'C'}, {v:'Date(2026,9,3)'},null,null,null,{v:2},null,null] }],
  } }) + ');')
}
try {
  const rows = await readPortalSource('orders')
  assert.equal(rows[0]!.quantity, 2)
  assert.equal(rows[0]!.note, '')
  assert.ok(rows[0]!.received_date instanceof Date)
} finally { globalThis.fetch = fetchBefore }

const data: Record<string, SourceRow[]> = {
  customers: [{ CustomerID: 'C', CustomerName: 'Alice', Phone: 123, RegisteredDate: sourceCell('Date(2026,9,3)') }],
  appointments: [{ AppointmentID: 'A', CustomerID: 'C', Status: 'CANCELLED', DeletedAt: 'x', CreatedAt: sourceCell('Date(2026,9,3,0,0,0)') }, { CustomerID: 'other' }],
  orders: [{ id: 'O', customer_id: 'C', quantity: 1 }, { id: 'Other', customer_id: 'other', quantity: 1 }],
  orderItems: [{ order_id: 'O', item_id: 42 }],
  invoices: [{ invoice_number: 'I', customer_id: 'C' }, { invoice_number: 'Other', customer_id: 'other' }],
  invoiceItems: [{ invoice_number: 'I', net_total: 100 }], payments: [],
  customerPackages: [{ id: 'CP', customer_id: 'C', package_code: 'P', start_date: '2026-10-03', expiry_date: '2026-10-03' }],
  packages: [{ package_code: 'P', name: 'Catalog', eligible_service: 'WSIR', included_credit: 999 }],
  packageTransactions: [
    { id: 'b', customer_package_id: 'CP', customer_id: 'wrong', credit_change: -3, created_at: '2026-10-03 10:00:00' },
    { id: 'a', customer_package_id: 'CP', credit_change: 10, created_at: '2026-10-03 10:00:00' },
  ],
}
let now = new Date('2026-10-03T00:00:00Z')
const service = new PortalService(createPortalSources(async (name) => data[name]!), () => now)
const bundle = await service.customer('C')
portalCustomerResponseSchema.parse(bundle)
assert.equal(bundle.customer.phone, 123)
assert.equal(bundle.customer.registeredDate, '2026-10-03')
assert.equal(bundle.appointments.length, 1)
assert.equal(bundle.appointments[0]!.deletedAt, 'x')
assert.equal(bundle.appointments[0]!.createdAt, 'Date(2026,9,3,0,0,0)')
assert.deepEqual(bundle.orders, await service.orders({ customerId: 'C' }))
assert.deepEqual(bundle.invoices, await service.invoices({ customerId: 'C' }))
const pkg = bundle.packages[0]!
assert.equal(Object.keys(pkg).length, 19)
assert.equal(pkg.status, 'ACTIVE')
assert.equal(pkg.remainingCredit, 7)
assert.equal(pkg.usedCredit, 3)
assert.equal(pkg.totalCredit, 10)
assert.deepEqual(JSON.parse(pkg.transactionsJson).map((tx: SourceRow) => [tx.id, tx.remainingCredit]), [['a',10],['b',7]])
now = new Date('2026-10-04T00:00:00Z')
assert.equal((await service.customer('C')).packages[0]!.status, 'EXPIRED')
now = new Date('2026-10-02T00:00:00Z')
assert.equal((await service.customer('C')).packages[0]!.status, 'INACTIVE')
data.customerPackages![0]!.deleted_at = 'x'
assert.equal((await service.customer('C')).packages[0]!.status, 'CANCELLED')
await assert.rejects(service.customer(['C']))
const numericTime = assemblePortalPackages([{ id: 'CP' }], [], [], [{ customer_package_id: 'CP', created_at: 0 }], now)[0]!
assert.equal(JSON.parse(numericTime.transactionsJson)[0].createdAt, '1970-01-01T07:00:00+07:00')
const gateway = new ApiGateway({ portal: async () => createPortalRoutes(service) }, async () => { throw new Error('unexpected auth') })
const req = (url: string, method = 'GET', query = {}) => ({ url, method, query, headers: {} }) as VercelRequest
assert.equal((await gateway.handleRequest(req('/api/portal/customers/C'))).status, 200)
assert.equal((await gateway.handleRequest(req('/api/portal/customers/missing'))).status, 404)
assert.equal((await gateway.handleRequest(req('/api/portal/customers/C', 'POST'))).status, 405)
assert.equal((await gateway.handleRequest(req('/api/portal/other/C'))).status, 404)
assert.equal((await gateway.handleRequest(req('/api/portal/customers/C/extra'))).status, 404)
assert.equal((await gateway.handleRequest(req('/api/[...path]?path=portal/customers/C'))).status, 200)
assert.equal((await gateway.handleRequest(req('/api/[...path]', 'GET', { path: ['portal', 'customers', 'C'] }))).status, 200)
console.log('Portal cache concurrency/expiry/retry/isolation, GViz columns/dates, bundle projections/status, and nested routes passed')
