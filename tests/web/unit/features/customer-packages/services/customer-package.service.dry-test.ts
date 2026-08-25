import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../../../../../../src/features/customer-packages/services/customer-package.service.ts', import.meta.url),
  'utf8',
)

function exportedFunction(name: string): string {
  const match = source.match(new RegExp(`export\\s+(?:(?:async\\s+)?function\\s+${name}\\b|const\\s+${name}\\b)[\\s\\S]*?(?=\\nexport\\s+(?:(?:async\\s+)?function|const)\\s+|$)`))
  assert.ok(match, `${name} must be exported`)
  return match[0]
}

const list = exportedFunction('getCustomerPackages')
assert.match(list, /apiGetList[\s\S]*?['"]\/api\/customer-packages['"]/, 'list must use apiGetList at the customer-packages endpoint')
assert.match(list, /customerPackageListQuerySchema/, 'list must use customerPackageListQuerySchema')
for (const name of ['keyword', 'customerId', 'status', 'packageCode', 'page', 'perPage', 'sortBy', 'sortOrder']) {
  assert.match(list, new RegExp(`\\b${name}\\b`), `list query must include ${name}`)
}
assert.doesNotMatch(list, /\btransactions\b/, 'list items must omit transactions')

const detail = exportedFunction('getCustomerPackageDetail')
assert.match(detail, /apiGet[\s\S]*?['"]\/api\/customer-packages\//, 'detail must use apiGet at the detail endpoint')
assert.match(detail, /404[\s\S]*?null|null[\s\S]*?404/, 'detail must map HTTP 404 to null')
assert.match(detail, /packageTransactionSchema/, 'detail transactions must use packageTransactionSchema')

assert.doesNotMatch(source, /\bapiPost\b/, 'customer-package writes must not import or call apiPost')
for (const [name, endpoint, responseSchema] of [
  ['createCustomerPackage', '/api/customer-packages', 'createCustomerPackageResponseSchema'],
  ['appendPackageTransaction', '/api/package-transactions', 'appendPackageTransactionResponseSchema'],
] as const) {
  const write = exportedFunction(name)
  assert.match(write, new RegExp(`fetch[\\s\\S]*?['"]${endpoint.replaceAll('/', '\\/')}['"]`), `${name} must use raw fetch at ${endpoint}`)
  assert.match(write, /method\s*:\s*['"]POST['"]/, `${name} must POST`)
  assert.match(write, /response\.json\(\)/, `${name} must parse JSON regardless of HTTP status`)
  assert.match(write, new RegExp(`${responseSchema}\\.safeParse\\(`), `${name} must safe-parse its response`)
  assert.match(write, /catch|success\s*:\s*false/, `${name} must synthesize a fallback for fetch or parse failure`)
}
for (const kind of ['created', 'validation_error', 'catalog_read_failed', 'opening_transaction_write_failed', 'package_write_failed']) {
  assert.match(exportedFunction('createCustomerPackage'), new RegExp(`['"]${kind}['"]`), `create must handle ${kind}`)
}
for (const kind of ['created', 'validation_error', 'package_not_found', 'package_lookup_failed', 'transaction_write_failed']) {
  assert.match(exportedFunction('appendPackageTransaction'), new RegExp(`['"]${kind}['"]`), `append must handle ${kind}`)
}
assert.match(source, /\/\/[^\n]*(?:unknown|network)[^\n]*(?:write|outcome)[^\n]*/i, 'the fallback kind choice must be documented')

console.log('customer-package service dry tests passed')
