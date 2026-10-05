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
  /'order-snapshots'\s*:\s*\(\)\s*:\s*ReturnType<RouteLoader>\s*=>\s*import\(\s*['"]\.\.\/modules\/order-snapshots\/order-snapshot\.module\.js['"]\s*\)\.then\(\(module\)\s*=>\s*module\.orderSnapshotRoutes\)/,
  'Order snapshots route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  source,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*order-snapshots\/order-snapshot\.module\.[jt]s['"]/,
  'Order snapshots must not be eagerly imported by the route registry',
)

const previousSpreadsheetId = process.env.ORDERS_SPREADSHEET_ID
delete process.env.ORDERS_SPREADSHEET_ID

try {
  const resolved = await resolveRoute('order-snapshots')
  const reportModule = await import('../../../../server/modules/order-snapshots/order-snapshot.module.js')
  assert.strictEqual(resolved, reportModule.orderSnapshotRoutes)
  assert.ok(resolved.collection, 'Order snapshots collection route must be registered')
  assert.equal(resolved.item, undefined)
} finally {
  if (previousSpreadsheetId === undefined) {
    delete process.env.ORDERS_SPREADSHEET_ID
  } else {
    process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
  }
}

console.log('order-snapshots route registry dry test passed')
