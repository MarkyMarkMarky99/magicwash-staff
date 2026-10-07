import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routeRegistryPath = fileURLToPath(
  new URL('../../../../server/api/route-registry.ts', import.meta.url),
)
const routeRegistrySource = readFileSync(routeRegistryPath, 'utf8')

assert.match(
  routeRegistrySource,
  /import\(\s*['"][^'"]*bag-items\/bag-item\.module\.js['"]\s*\)/,
  'Bag items route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  routeRegistrySource,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*bag-items\/bag-item\.module\.[jt]s['"]/,
  'Bag items must not be eagerly imported by the route registry',
)


const { resolveRoute } = await import('../../../../server/api/route-registry.js')
const { bagItemRoutes } = await import('../../../../server/modules/bag-items/bag-item.module.js')
assert.strictEqual(await resolveRoute('bag-items'), bagItemRoutes)
assert.equal(bagItemRoutes.item, undefined)
for (const method of ['PATCH', 'DELETE']) {
  const result = await bagItemRoutes.collection.handleRequest({
    method, query: {}, body: {}, headers: {}, params: {},
  })
  assert.equal(result.status, 405)
  assert.equal(result.headers?.Allow, 'GET, POST')
}

const { ApiGateway } = await import('../../../../server/shared/http/api-gateway.js')
const { ApiError } = await import('../../../../server/shared/http/api-error.js')
let authCalls = 0
let loads = 0
const gateway = new ApiGateway({
  'bag-items': async () => { loads++; return bagItemRoutes },
}, async () => { authCalls++; throw ApiError.unauthorized() })
for (const method of ['GET', 'POST']) {
  const result = await gateway.handleRequest({
    method, url: '/api/bag-items', query: {}, headers: {}, body: {},
  } as import('@vercel/node').VercelRequest)
  assert.equal(result.status, 401, 'Bag items must require approved staff')
}
assert.equal(authCalls, 2)
assert.equal(loads, 0, 'Authentication must complete before module loading')
console.log('bag-items route registry dry test passed (lazy import, collection methods, staff authentication)')
