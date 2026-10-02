import assert from 'node:assert/strict'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { VercelRequest } from '@vercel/node'
import { PortalService } from '../../../server/modules/portal/portal.service.js'
import { readPortalSource } from '../../../server/modules/portal/portal-source-reader.js'
import { assemblePortalPackages } from '../../../server/modules/portal/portal-package.mapper.js'
import { createPortalRoutes } from '../../../server/modules/portal/portal.module.js'
import { ApiGateway } from '../../../server/shared/http/api-gateway.js'
import { formatBangkokTimestamp } from '../../../server/shared/utils/bangkok-timestamp.js'
import { portalCustomerResponseSchema } from '../../../contracts/portal/portal-api.schema.js'

const scriptDirectory = process.argv[2]!
assert.ok(scriptDirectory)
assert.equal(new Date('2026-10-03T00:00:00Z').getHours(), 7, 'Use TZ=Asia/Bangkok')
const [orders, customers, memberships, catalog, transactions] = await Promise.all([
  readPortalSource('orders'), readPortalSource('customers'), readPortalSource('customerPackages'),
  readPortalSource('packages'), readPortalSource('packageTransactions'),
])
const now = new Date()
const sandbox = vm.createContext({ Date, Logger: { log() {} }, Utilities: {
  formatDate(date: Date, _timezone: string, pattern: string) {
    const text = formatBangkokTimestamp(date)
    return pattern === 'yyyy-MM-dd' ? text.slice(0, 10) : text.replace(' ', 'T')
  },
} })
vm.runInContext(readFileSync(join(scriptDirectory, 'CustomerPackageViewBuild.js'), 'utf8'), sandbox)
const actual = assemblePortalPackages(memberships, catalog, customers, transactions, now)
for (const record of actual) {
  const cp = memberships.find((row) => String(row.id || '').trim() === record.customerPackageId)!
  const pkg = catalog.slice().reverse().find((row) => String(row.package_code || '').trim() === record.packageCode) ?? null
  const customer = customers.slice().reverse().find((row) => String(row.CustomerID || '').trim() === record.customerId) ?? null
  const txs = transactions.filter((row) => String(row.customer_package_id || '').trim() === record.customerPackageId)
  assert.deepEqual(record, JSON.parse(JSON.stringify(sandbox.customerPackageViewBuildRecord_(cp, pkg, customer, txs, now))))
}
console.log(`Apps Script package parity: ${actual.length} rows, all 19 fields match`)
const valid = new Set(customers.map((row) => String(row.CustomerID)))
const counts = new Map<string, number>()
for (const order of orders) {
  const id = String(order.customer_id)
  if (id && valid.has(id) && Number(order.quantity) > 0) counts.set(id, (counts.get(id) ?? 0) + 1)
}
const [customerId, count] = [...counts].sort((a, b) => b[1] - a[1])[0]!
const service = new PortalService(undefined, () => now)
const gateway = new ApiGateway({ portal: async () => createPortalRoutes(service) }, async () => { throw new Error('Unexpected auth') })
const server = createServer(async (req, res) => {
  const result = await gateway.handleRequest({ url: req.url, method: req.method, query: {}, headers: req.headers } as VercelRequest)
  res.writeHead(result.status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result.body))
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
try {
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/portal/customers/${encodeURIComponent(customerId)}`
  for (const state of ['cold', 'cached']) {
    const start = performance.now()
    const response = await fetch(url)
    const raw = await response.json()
    assert.equal(response.status, 200, JSON.stringify({ customerId, raw }))
    const body = z.object({ data: portalCustomerResponseSchema }).parse(raw)
    const ms = performance.now() - start
    assert.equal(response.status, 200)
    portalCustomerResponseSchema.parse(body.data)
    assert.deepEqual(body.data.orders, await service.orders({ customerId }))
    assert.deepEqual(body.data.invoices, await service.invoices({ customerId }))
    console.log(JSON.stringify({ route: `/api/portal/customers/${customerId}`, state, ms: Math.round(ms), orders: count,
      invoices: body.data.invoices.length, appointments: body.data.appointments.length, packages: body.data.packages.length }))
  }
} finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
