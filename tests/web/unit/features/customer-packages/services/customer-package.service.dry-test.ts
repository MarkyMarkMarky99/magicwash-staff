import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  appendPackageTransaction,
  createCustomerPackage,
  getCustomerPackageDetail,
  getCustomerPackages,
} from '@/features/customer-packages/services/customer-package.service'

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

const createRequest = {
  customerId: 'customer-1',
  packageCode: 'PACKAGE-1',
  createdBy: 'user-1',
}
const transactionRequest = {
  customerPackageId: 'customer-package-1',
  type: 'USAGE' as const,
  creditChange: -1,
  createdBy: 'user-1',
}

async function withFetch(mock: typeof fetch, run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mock
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

await withFetch(async (input) => {
  const url = new URL(String(input), 'http://localhost')
  assert.deepEqual([...url.searchParams.keys()].sort(), [
    'customerId', 'keyword', 'packageCode', 'page', 'perPage', 'sortBy', 'sortOrder', 'status',
  ])
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    keyword: 'laundry', customerId: 'customer-1', status: 'ACTIVE', packageCode: 'PACKAGE-1',
    page: '3', perPage: '25', sortBy: 'remainingCredit', sortOrder: 'asc',
  })
  return jsonResponse({ data: [], meta: { pagination: { page: 3, perPage: 25 } } })
}, async () => {
  assert.deepEqual(await getCustomerPackages({
    keyword: 'laundry', customerId: 'customer-1', status: 'ACTIVE', packageCode: 'PACKAGE-1',
    page: 3, perPage: 25, sortBy: 'remainingCredit', sortOrder: 'asc',
  }), { items: [], page: 3, perPage: 25 })
})

await withFetch(async () => jsonResponse({ message: 'not found' }, 404), async () => {
  await assert.doesNotReject(async () => assert.equal(await getCustomerPackageDetail('missing-package'), null))
})

const createResponses = [
  { kind: 'created', customerPackageId: 'package-1', customerId: 'customer-1', packageCode: 'PACKAGE-1', openingCredit: 10, transactionId: 'transaction-1', createdAt: '2026-08-25T00:00:00Z' },
  { kind: 'validation_error', issues: [{ path: 'packageCode', message: 'invalid' }] },
  { kind: 'catalog_read_failed', packageCode: 'PACKAGE-1', message: 'catalog unavailable' },
  { kind: 'opening_transaction_write_failed', customerPackageId: 'package-1', message: 'transaction failed', certainty: 'rejected' },
  { kind: 'package_write_failed', customerPackageId: 'package-1', transactionId: 'transaction-1', openingCredit: 10, message: 'package failed', certainty: 'rejected' },
]
for (const expected of createResponses) {
  await withFetch(async () => jsonResponse(expected), async () => {
    assert.deepEqual(await createCustomerPackage(createRequest), expected, `create must return ${expected.kind}`)
  })
}

const appendResponses = [
  { kind: 'created', transactionId: 'transaction-1', customerPackageId: 'customer-package-1', customerId: 'customer-1', type: 'USAGE', creditChange: -1, createdAt: '2026-08-25T00:00:00Z' },
  { kind: 'validation_error', issues: [{ path: 'creditChange', message: 'invalid' }] },
  { kind: 'package_not_found', customerPackageId: 'customer-package-1' },
  { kind: 'package_lookup_failed', customerPackageId: 'customer-package-1', message: 'lookup failed' },
  { kind: 'transaction_write_failed', customerPackageId: 'customer-package-1', message: 'write failed', certainty: 'rejected' },
]
for (const expected of appendResponses) {
  await withFetch(async () => jsonResponse(expected), async () => {
    assert.deepEqual(await appendPackageTransaction(transactionRequest), expected, `append must return ${expected.kind}`)
  })
}

await withFetch(async () => jsonResponse({ kind: 'invalid' }), async () => {
  assert.deepEqual(await createCustomerPackage(createRequest), {
    kind: 'opening_transaction_write_failed', customerPackageId: 'unknown',
    message: 'The server response was not a recognized write outcome. This package may already have been created.', certainty: 'unknown',
  })
  assert.deepEqual(await appendPackageTransaction(transactionRequest), {
    kind: 'transaction_write_failed', customerPackageId: 'customer-package-1',
    message: 'The server response was not a recognized write outcome. This transaction may already have been saved.', certainty: 'unknown',
  })
})

await withFetch(async () => Promise.reject(new Error('network unavailable')), async () => {
  assert.deepEqual(await createCustomerPackage(createRequest), {
    kind: 'opening_transaction_write_failed', customerPackageId: 'unknown',
    message: 'Could not reach the server. This package may already have been created.', certainty: 'unknown',
  })
  assert.deepEqual(await appendPackageTransaction(transactionRequest), {
    kind: 'transaction_write_failed', customerPackageId: 'customer-package-1',
    message: 'Could not reach the server. This transaction may already have been saved.', certainty: 'unknown',
  })
})

console.log('customer-package service dry tests passed')
