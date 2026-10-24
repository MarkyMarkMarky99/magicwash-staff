import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../../../../server/api/route-registry.ts', import.meta.url)), 'utf8')
assert.match(source, /'laundry-items':\s*\(\).*import\(['"]\.\.\/modules\/laundry-items\/laundry-item\.module\.js['"]\)/s)
assert.doesNotMatch(source, /import\s+.*from\s+['"].*laundry-items\/laundry-item\.module\.js['"]/, 'LaundryItems must load lazily')

const previous = process.env.LAUNDRY_ITEMS_SPREADSHEET_ID
delete process.env.LAUNDRY_ITEMS_SPREADSHEET_ID
try {
  const { resolveRoute } = await import('../../../../server/api/route-registry.js')
  const routes = await resolveRoute('laundry-items')
  assert.ok(routes.collection)
  assert.ok(routes.item)
  for (const [handler, method, allow] of [
    [routes.collection, 'PATCH', 'GET, POST'],
    [routes.item!, 'DELETE', 'GET, PATCH, POST'],
  ] as const) {
    const result = await handler.handleRequest({ method, query: {}, body: {}, params: {}, headers: {} })
    assert.equal(result.status, 405)
    assert.equal(result.headers?.Allow, allow)
  }
} finally {
  if (previous === undefined) delete process.env.LAUNDRY_ITEMS_SPREADSHEET_ID
  else process.env.LAUNDRY_ITEMS_SPREADSHEET_ID = previous
}

console.log('laundry-items lazy route dry test passed')
