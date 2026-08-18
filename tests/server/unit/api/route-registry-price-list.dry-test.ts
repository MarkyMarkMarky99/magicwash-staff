import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routeRegistryPath = fileURLToPath(
  new URL('../../../../server/api/route-registry.ts', import.meta.url),
)
const routeRegistrySource = readFileSync(routeRegistryPath, 'utf8')

assert.match(
  routeRegistrySource,
  /import\(\s*['"][^'"]*price-list\/price-list\.module\.js['"]\s*\)/,
  'Price List route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  routeRegistrySource,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*price-list\/price-list\.module\.[jt]s['"]/
  'Price List must not be eagerly imported by the route registry',
)

console.log('price-list route registry dry test passed')
