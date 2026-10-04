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
  /'order-reports'\s*:\s*\(\)\s*:\s*ReturnType<RouteLoader>\s*=>\s*import\(\s*['"]\.\.\/modules\/order-reports\/order-report\.module\.js['"]\s*\)\.then\(\(module\)\s*=>\s*module\.orderReportRoutes\)/,
  'Order reports route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  source,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*order-reports\/order-report\.module\.[jt]s['"]/,
  'Order reports must not be eagerly imported by the route registry',
)

const previousSpreadsheetId = process.env.ORDERS_SPREADSHEET_ID
delete process.env.ORDERS_SPREADSHEET_ID

try {
  const resolved = await resolveRoute('order-reports')
  const reportModule = await import('../../../../server/modules/order-reports/order-report.module.js')
  assert.strictEqual(resolved, reportModule.orderReportRoutes)
  assert.ok(resolved.collection, 'Order reports collection route must be registered')
  assert.equal(resolved.item, undefined)
} finally {
  if (previousSpreadsheetId === undefined) {
    delete process.env.ORDERS_SPREADSHEET_ID
  } else {
    process.env.ORDERS_SPREADSHEET_ID = previousSpreadsheetId
  }
}

console.log('order-reports route registry dry test passed')
