import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const routeRegistryPath = fileURLToPath(
  new URL('../../../../server/api/route-registry.ts', import.meta.url),
)
const routeRegistrySource = readFileSync(routeRegistryPath, 'utf8')

assert.match(
  routeRegistrySource,
  /import\(\s*['"][^'"]*work-transactions\/work-transaction\.module\.js['"]\s*\)/,
  'Work transactions route registration must be a literal lazy .js import',
)
assert.doesNotMatch(
  routeRegistrySource,
  /(?:^|\n)\s*import\s+[^;\n]+from\s+['"][^'"]*work-transactions\/work-transaction\.module\.[jt]s['"]/,
  'Work transactions must not be eagerly imported by the route registry',
)

console.log('work-transactions route registry dry test passed')
