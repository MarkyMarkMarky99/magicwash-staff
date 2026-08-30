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
  /'order-images'\s*:\s*\(\)\s*:\s*ReturnType<RouteLoader>\s*=>\s*import\(\s*['"]\.\.\/modules\/order-images\/order-image\.module\.js['"]\s*\)\.then\(\(module\)\s*=>\s*module\.orderImageRoutes\)/,
  'Order Images route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  source,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*order-images\/order-image\.module\.[jt]s['"]/
)

const previousSpreadsheetId = process.env.ORDERS_SPREADSHEET_ID
delete process.env.ORDERS_SPREADSHEET_ID

try {
  const resolved = await resolveRoute('order-images')
  const orderImageModule = await import(
    '../../../../server/modules/order-images/order-image.module.js'
  )
  assert.strictEqual(resolved, orderImageModule.orderImageRoutes)
  assert.ok(resolved.collection, 'Order Images collection route must be registered')
  assert.ok(resolved.item, 'Order Images item route must be registered')

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
    params: { id: 'image-1' },
  })
  assert.equal(itemDelete.status, 405)
  assert.equal(itemDelete.headers?.Allow, 'GET')
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

console.log('order-images route registry dry test passed')
