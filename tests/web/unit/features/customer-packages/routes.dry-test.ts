import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../src/features/customer-packages/routes.ts', import.meta.url),
  'utf8',
)

assert.match(source, /export\s+const\s+customerPackageRoutes\b/, 'routes must export customerPackageRoutes')
assert.match(source, /path\s*:\s*['"]\/customer-packages['"]/, 'list route is required')
const createPosition = source.search(/path\s*:\s*['"]\/customer-packages\/create['"]/)
const detailPosition = source.search(/path\s*:\s*['"]\/customer-packages\/:customerPackageId['"]/)
assert.notEqual(createPosition, -1, 'create route is required')
assert.notEqual(detailPosition, -1, 'detail route is required')
assert.ok(createPosition < detailPosition, 'create route must precede the ID route')
assert.match(source, /component\s*:\s*\(\)\s*=>\s*import\(/, 'pages must be lazy loaded')
assert.match(source, /props\s*:\s*true/, 'detail route must pass ID as a prop')
assert.match(source, /meta\s*:\s*\{[^}]*parent/, 'detail route must define parent metadata')
assert.doesNotMatch(source, /\bchildren\s*:/, 'customer-package routes must not use children')

console.log('customer-package route dry tests passed')
