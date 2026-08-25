import assert from 'node:assert/strict'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'
import { CustomerPackagePurchaseService } from '../../../../../server/modules/customer-packages/customer-package-purchase.service.js'

type Row = Record<string, unknown>

function createService(input: { catalogRows?: Row[]; catalogError?: Error; openingError?: Error; packageError?: Error } = {}) {
  const calls: string[] = []
  const packageAppends: Row[] = []
  const openingAppends: Row[] = []
  const service = new CustomerPackagePurchaseService({
    catalogRepository: () => ({ read: async () => {
      calls.push('catalog.read')
      if (input.catalogError) throw input.catalogError
      return input.catalogRows ?? [{ package_code: 'GOLD', included_credit: 10, deleted_at: null }]
    } }) as never,
    packageRepository: () => ({ append: async (row: Row) => {
      calls.push('package.append')
      packageAppends.push(row)
      if (input.packageError) throw input.packageError
      return { ...row, created_at: '2026-08-25 12:00:01' }
    } }) as never,
    transactionService: { appendOpeningPurchase: async (row: Row) => {
      calls.push('ledger.append')
      openingAppends.push(row)
      if (input.openingError) throw input.openingError
      return { transactionId: 'transaction-1' }
    } } as never,
    generateCustomerPackageId: () => 'package-1',
  })
  return { service, calls, packageAppends, openingAppends }
}

const request = { customerId: 'customer-1', packageCode: 'GOLD', createdBy: 'staff-1' }

{
  const { service, calls, openingAppends, packageAppends } = createService()
  const result = await service.create(request)
  assert.deepEqual(calls, ['catalog.read', 'ledger.append', 'package.append'])
  assert.deepEqual(openingAppends[0], { customerPackageId: 'package-1', customerId: 'customer-1', creditChange: 10, createdBy: 'staff-1' })
  assert.equal(packageAppends[0]?.package_code, 'GOLD')
  assert.deepEqual(result, { kind: 'created', customerPackageId: 'package-1', customerId: 'customer-1', packageCode: 'GOLD', openingCredit: 10, transactionId: 'transaction-1', createdAt: '2026-08-25 12:00:01' })
}

for (const [catalogRows, kind] of [
  [[], 'validation_error'],
  [[{ package_code: 'GOLD', included_credit: 10, deleted_at: '2026-08-01' }], 'validation_error'],
  [[{ package_code: 'GOLD', included_credit: null, deleted_at: null }], 'catalog_read_failed'],
  [[{ package_code: 'GOLD', included_credit: '   ', deleted_at: null }], 'catalog_read_failed'],
] as const) {
  const { service, calls } = createService({ catalogRows: [...catalogRows] })
  const result = await service.create(request)
  assert.equal(result.kind, kind)
  assert.deepEqual(calls, ['catalog.read'])
}

{
  const generated = new CustomerPackagePurchaseService({
    catalogRepository: () => ({ read: async () => [{ package_code: 'GOLD', included_credit: 1, deleted_at: null }] }) as never,
    packageRepository: () => ({ append: async (row: Row) => ({ ...row, created_at: '2026-08-25 12:00:01' }) }) as never,
    transactionService: { appendOpeningPurchase: async () => ({ transactionId: 'transaction-1' }) } as never,
  })
  const result = await generated.create(request)
  assert.equal(result.kind, 'created')
  if (result.kind === 'created') assert.match(result.customerPackageId, /^[0-9a-f]{8}$/)
}

{
  const { service, openingAppends } = createService({ catalogRows: [{ package_code: 'GOLD', included_credit: 0, deleted_at: null }] })
  const result = await service.create(request)
  assert.equal(result.kind, 'created')
  assert.equal(openingAppends[0]?.creditChange, 0)
}

for (const [openingError, certainty] of [[new WriteRejectedError('APPEND', 'rejected'), 'rejected'], [new WriteTransportError('APPEND', 'network'), 'unknown']] as const) {
  const { service, calls } = createService({ openingError })
  const result = await service.create(request)
  assert.equal(result.kind, 'opening_transaction_write_failed')
  if (result.kind === 'opening_transaction_write_failed') assert.equal(result.certainty, certainty)
  assert.deepEqual(calls, ['catalog.read', 'ledger.append'])
}

{
  const { service, calls, packageAppends } = createService({ packageError: new WriteTransportError('APPEND', 'network') })
  const result = await service.create(request)
  assert.deepEqual(calls, ['catalog.read', 'ledger.append', 'package.append'])
  assert.equal(result.kind, 'package_write_failed')
  if (result.kind === 'package_write_failed') {
    assert.equal(result.certainty, 'unknown')
    assert.equal(result.transactionId, 'transaction-1')
    assert.equal(result.openingCredit, 10)
  }
  assert.equal(packageAppends.length, 1)
  assert.equal(calls.some((call) => call.includes('delete')), false)
}

console.log('customer package purchase service dry test passed')
