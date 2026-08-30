import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { resolveRoute } from '../../../../server/api/route-registry.js'

const routeRegistryPath = fileURLToPath(
  new URL('../../../../server/api/route-registry.ts', import.meta.url),
)
const source = readFileSync(routeRegistryPath, 'utf8')

assert.match(
  source,
  /'work-orders'\s*:\s*\(\)\s*:\s*ReturnType<RouteLoader>\s*=>\s*import\(\s*['"]\.\.\/modules\/work-orders\/work-order\.module\.js['"]\s*\)\.then\(\(module\)\s*=>\s*module\.workOrderRoutes\)/,
  'Work Orders route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  source,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*work-orders\/work-order\.module\.[jt]s['"]/
)

const previousSpreadsheetId = process.env.ORDERS_SPREADSHEET_ID
delete process.env.ORDERS_SPREADSHEET_ID

try {
  const resolved = await resolveRoute('work-orders')
  const workOrderModule = await import(
    '../../../../server/modules/work-orders/work-order.module.js'
  )
  assert.strictEqual(resolved, workOrderModule.workOrderRoutes)
  assert.ok(resolved.collection, 'Work Orders collection route must be registered')
  assert.ok(resolved.item, 'Work Orders item route must be registered')

  const collectionDelete = await resolved.collection.handleRequest({
    method: 'DELETE',
    query: {},
    body: undefined,
    headers: {},
    params: {},
  })
  assert.equal(collectionDelete.status, 405)
  assert.equal(collectionDelete.headers?.Allow, 'GET, POST')

  const itemDelete = await resolved.item.handleRequest({
    method: 'DELETE',
    query: {},
    body: undefined,
    headers: {},
    params: { id: 'order-1' },
  })
  assert.equal(itemDelete.status, 405)
  assert.equal(itemDelete.headers?.Allow, 'GET')

  const itemPatch = await resolved.item.handleRequest({
    method: 'PATCH',
    query: {},
    body: undefined,
    headers: {},
    params: { id: 'order-1' },
  })
  assert.equal(itemPatch.status, 405)
  assert.equal(itemPatch.headers?.Allow, 'GET')
} finally {
  if (previousSpreadsheetId === undefined) {
    delete process.env.ORDERS_SPREADSHEET_ID
  } else {
    process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
  }
}

await assert.rejects(
  () => resolveRoute('unknown-module'),
  (error: unknown) => {
    assert.equal((error as { status?: number }).status, 404)
    return true
  },
)

console.log('work-orders route registry dry test passed')
