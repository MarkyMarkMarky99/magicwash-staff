import assert from 'node:assert/strict'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'
import { PackageTransactionService } from '../../../../../server/modules/customer-packages/package-transaction.service.js'

type Row = Record<string, unknown>

function createService(input: { parentRows?: Row[]; readError?: Error; appendError?: Error } = {}) {
  const calls: string[] = []
  const appended: Row[] = []
  const service = new PackageTransactionService({
    packageRepository: () => ({
      read: async () => {
        calls.push('parent.read')
        if (input.readError) throw input.readError
        return input.parentRows ?? [{ id: 'package-1', customer_id: ' parent-customer ' }]
      },
    }) as never,
    transactionRepository: () => ({
      append: async (row: Row) => {
        calls.push('ledger.append')
        appended.push(row)
        if (input.appendError) throw input.appendError
        return { ...row, created_at: '2026-08-25 12:00:00' }
      },
    }) as never,
    generateTransactionId: () => 'transaction-1',
  })
  return { service, calls, appended }
}

const request = { customerPackageId: 'package-1', type: 'USAGE', creditChange: -2, createdBy: 'staff-1' }

{
  const { service, calls, appended } = createService()
  const result = await service.append(request)
  assert.deepEqual(calls, ['parent.read', 'ledger.append'])
  assert.deepEqual(result, {
    kind: 'created', transactionId: 'transaction-1', customerPackageId: 'package-1', customerId: 'parent-customer',
    type: 'USAGE', creditChange: -2, createdAt: '2026-08-25 12:00:00',
  })
  assert.equal(appended[0]?.customer_id, 'parent-customer')
  assert.equal('status' in result, false)
  assert.equal('remainingCredit' in result, false)
}

{
  const { service, calls } = createService()
  const result = await service.append({ ...request, type: 'PURCHASE' })
  assert.equal(result.kind, 'validation_error')
  assert.deepEqual(calls, [])
}

{
  const { service, calls } = createService({ parentRows: [] })
  assert.deepEqual(await service.append(request), { kind: 'package_not_found', customerPackageId: 'package-1' })
  assert.deepEqual(calls, ['parent.read'])
}

{
  const { service, calls } = createService({ parentRows: [{ id: 'package-1', customer_id: 'customer-1', deleted_at: '2026-08-20' }] })
  assert.equal((await service.append(request)).kind, 'created')
  assert.deepEqual(calls, ['parent.read', 'ledger.append'])
}

for (const [error, certainty] of [[new WriteRejectedError('APPEND', 'rejected'), 'rejected'], [new WriteTransportError('APPEND', 'network'), 'unknown']] as const) {
  const { service } = createService({ appendError: error })
  const result = await service.append(request)
  assert.equal(result.kind, 'transaction_write_failed')
  if (result.kind === 'transaction_write_failed') assert.equal(result.certainty, certainty)
}

{
  const generated = new PackageTransactionService({
    packageRepository: () => ({ read: async () => [{ id: 'package-1', customer_id: 'customer-1' }] }) as never,
    transactionRepository: () => ({ append: async (row: Row) => ({ ...row, created_at: '2026-08-25 12:00:00' }) }) as never,
  })
  const result = await generated.append(request)
  assert.equal(result.kind, 'created')
  if (result.kind === 'created') assert.match(result.transactionId, /^[0-9a-f]{8}$/)
}

console.log('package transaction service dry test passed')
