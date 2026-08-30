import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routeRegistryPath = fileURLToPath(
  new URL('../../../../server/api/route-registry.ts', import.meta.url),
)
const source = readFileSync(routeRegistryPath, 'utf8')

assert.match(
  source,
  /'order-items'\s*:\s*\(\)\s*:\s*ReturnType<RouteLoader>\s*=>\s*import\(\s*['"]\.\.\/modules\/order-items\/order-item\.module\.js['"]\s*\)\.then\(\(module\)\s*=>\s*module\.orderItemRoutes\)/,
  'Order Items route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  source,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*order-items\/order-item\.module\.[jt]s['"]/
)

const routeRegistry = await import('../../../../server/api/route-registry.js')
const resolveRoute = (routeRegistry as { resolveRoute?: unknown }).resolveRoute
assert.equal(typeof resolveRoute, 'function', 'route registry must expose its resolver')

const resolved = await (resolveRoute as (key: string) => Promise<unknown>)('order-items')
const orderItemModule = await import('../../../../server/modules/order-items/order-item.module.js')
assert.strictEqual(resolved, orderItemModule.orderItemRoutes)

await assert.rejects(
  () => (resolveRoute as (key: string) => Promise<unknown>)('unknown-module'),
  (error: unknown) => {
    assert.equal((error as { status?: number }).status, 404)
    return true
  },
)

console.log('order-items route registry dry test passed')
