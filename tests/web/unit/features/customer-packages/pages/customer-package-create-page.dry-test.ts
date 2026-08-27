import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const createPage = readFileSync(
  new URL('../../../../../../src/features/customer-packages/pages/CustomerPackageCreatePage.vue', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../../../../../../src/App.vue', import.meta.url), 'utf8')
const componentName = 'CustomerPackageCreatePage'

assert.match(createPage, /import FormOverlay from ['"]@\/shared\/layouts\/FormOverlay\.vue['"]/, 'create page must import FormOverlay')
assert.match(createPage, /<FormOverlay\b/, 'create page must use FormOverlay')
assert.doesNotMatch(createPage, /\bAppLayout\b/, 'create page must not reference AppLayout')
assert.match(createPage, /function createPayload\(\)/, 'create page must define createPayload')
assert.match(createPage, new RegExp(`defineOptions\\(\\{ name: '${componentName}' \\}\\)`), 'create page must keep its stable component name')
assert.match(app, new RegExp(`:exclude="\\[[^\\]]*'${componentName}'[^\\]]*\\]"`), 'App KeepAlive must exclude the exact component name')

console.log('customer-package create page dry test passed')
