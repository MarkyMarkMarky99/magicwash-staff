import assert from 'node:assert/strict'

import { API_ERROR_CODES } from '../../../../../contracts/shared/api.schema.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { CustomerPackageReadService } from '../../../../../server/modules/customer-packages/customer-package-read.service.js'

type Row = Record<string, unknown>
type ReadCall = { repository: string; dto: { id?: unknown; where?: Record<string, unknown>; pagination?: unknown } }

function createService(input: { packages?: Row[]; transactions?: Row[]; catalog?: Row[]; customers?: Row[] } = {}) {
  const calls: ReadCall[] = []
  const repository = (name: string, rows: Row[]) => () => ({
    read: async (dto: ReadCall['dto']) => {
      const where = dto.id === undefined ? dto.where : { id: dto.id }
      calls.push({ repository: name, dto: { ...dto, where } })
      return rows.filter((row) => Object.entries(where ?? {}).every(([key, value]) =>
        key === 'id'
          ? String(row[key] ?? '').trim() === String(value)
          : row[key] === value,
      ))
    },
  })

  return {
    calls,
    service: new CustomerPackageReadService({
      packageRepository: repository('packages', input.packages ?? [
        { id: ' package-1 ', customer_id: 'customer-1', package_code: 'GOLD', start_date: '2026-08-01', expiry_date: '2026-08-31' },
        { id: 'package-2', customer_id: 'customer-2', package_code: 'SILVER', deleted_at: '2026-01-01' },
        { id: 'package-3', customer_id: 'customer-3', package_code: 'BRONZE' },
      ]) as never,
      transactionRepository: repository('transactions', input.transactions ?? [
        { id: 't1', customer_package_id: ' package-1 ', credit_change: 10, type: 'PURCHASE', created_at: 'Date(2026,7,1,9,30,0)' },
        { id: 't2', customer_package_id: ' package-1 ', credit_change: -3, type: 'USAGE', created_at: 'Date(2026,7,2,9,30,0)' },
        { id: 't3', customer_package_id: 'package-3', credit_change: -2, type: 'USAGE', created_at: '2026-08-03 00:00:00' },
      ]) as never,
      catalogRepository: repository('catalog', input.catalog ?? [
        { package_code: 'GOLD', name: 'Gold package', eligible_service: 'wash' },
        { package_code: 'SILVER', name: 'Silver package', eligible_service: 'iron', deleted_at: '2026-01-01' },
      ]) as never,
      customerRepository: repository('customers', input.customers ?? [
        { CustomerID: 'customer-1', CustomerName: 'Anne' },
        { CustomerID: 'customer-2', CustomerName: 'Bob' },
      ]) as never,
      now: () => new Date('2026-08-01T18:00:00.000Z'),
    }),
  }
}

async function expectApiError(action: () => Promise<unknown>, code: string, status: number, message: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.code, code)
    assert.equal(error.status, status)
    assert.equal(error.message, message)
    return true
  })
}

{
  const { service, calls } = createService()
  const result = await service.list({ customerId: 'customer-1', packageCode: 'GOLD', keyword: 'Anne', sortBy: 'remainingCredit', sortOrder: 'desc', page: 2, perPage: 1 })
  assert.equal(calls.length, 4)
  assert.deepEqual(calls.map((call) => call.repository), ['packages', 'transactions', 'catalog', 'customers'])
  assert.deepEqual(calls[0]?.dto.where, { customer_id: 'customer-1', package_code: 'GOLD' })
  assert.equal(calls[1]?.dto.where, undefined)
  assert.deepEqual(calls[2]?.dto.where, { package_code: 'GOLD' })
  assert.deepEqual(calls[3]?.dto.where, { CustomerID: 'customer-1' })
  assert.ok(calls.every((call) => call.dto.pagination === undefined))
  assert.deepEqual(result, { items: [], pagination: { page: 2, perPage: 1 } })
}

{
  const { service } = createService()
  const result = await service.list({ keyword: '', sortBy: 'remainingCredit', sortOrder: 'desc', page: 1, perPage: 3 })
  assert.deepEqual(result.pagination, { page: 1, perPage: 3 })
  assert.deepEqual(result.items.map((row) => row.customerPackageId), [' package-1 ', 'package-2', 'package-3'])
  assert.equal('transactions' in result.items[0]!, false)
  assert.equal(result.items[2]?.remainingCredit, -2)
  assert.equal(result.items[2]?.usedCredit, 2)
  assert.equal(result.items[2]?.totalCredit, 0)
  assert.equal(result.items[1]?.status, 'CANCELLED')
}

{
  const { service } = createService()
  const result = await service.list({ status: 'ACTIVE', keyword: '', page: 1, perPage: 20 })
  assert.deepEqual(result.items.map((row) => row.customerPackageId), [' package-1 ', 'package-3'])
}

{
  const { service } = createService({ packages: [] })
  assert.deepEqual(await service.list({}), { items: [], pagination: { page: 1, perPage: 20 } })
}

{
  const { service } = createService({
    packages: [{ id: 'bangkok-boundary', customer_id: 'customer-1', package_code: 'GOLD', start_date: '2026-08-02' }],
    transactions: [],
  })
  const result = await service.list({})
  assert.equal(result.items[0]?.status, 'ACTIVE')
}

{
  const { service, calls } = createService()
  const detail = await service.getById(' package-1 ')
  assert.equal(calls.length, 4)
  assert.deepEqual(calls[0]?.dto.where, { id: 'package-1' })
  assert.deepEqual(calls[1]?.dto.where, { customer_package_id: ' package-1 ' })
  assert.equal(detail.customerName, 'Anne')
  assert.equal(detail.packageName, 'Gold package')
  assert.deepEqual(detail.transactions.map((entry) => entry.remainingCredit), [10, 7])
  assert.ok(detail.transactions.every((entry) => !entry.createdAt.includes('T') && !entry.createdAt.includes('+07:00')))
}

{
  const { service } = createService({ transactions: [] })
  const detail = await service.getById('package-2')
  assert.deepEqual(
    { transactions: detail.transactions, remainingCredit: detail.remainingCredit, usedCredit: detail.usedCredit, totalCredit: detail.totalCredit },
    { transactions: [], remainingCredit: 0, usedCredit: 0, totalCredit: 0 },
  )
}

{
  const { service, calls } = createService()
  await expectApiError(() => service.getById('   '), API_ERROR_CODES.BAD_REQUEST, 400, 'id is required')
  assert.deepEqual(calls, [])
}

{
  const { service } = createService({ packages: [] })
  await expectApiError(() => service.getById('missing'), API_ERROR_CODES.NOT_FOUND, 404, "Resource 'missing' not found")
}

{
  const { service } = createService({ packages: [{ id: 'duplicate' }, { id: 'duplicate' }] })
  await expectApiError(() => service.getById('duplicate'), API_ERROR_CODES.CONFLICT, 409, "Resource 'duplicate' resolved to multiple rows")
}

console.log('customer package read service dry test passed')
