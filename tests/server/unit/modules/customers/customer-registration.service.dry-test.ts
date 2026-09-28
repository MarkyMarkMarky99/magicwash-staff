import assert from 'node:assert/strict'
import type { z } from 'zod'
import { CustomerRegistrationService } from '../../../../../server/modules/customers/customer-registration.service.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { WriteRejectedError, WriteTransportError } from '../../../../../server/shared/repositories/sheets-api.client.js'
import { customerIdMappingRowSchema } from '../../../../../server/sheets/CustomerIDMapping/CustomerIDMapping.db-contract.js'
import { customersRowSchema } from '../../../../../server/sheets/Customers/Customers.db-contract.js'

type CustomerRow = z.infer<typeof customersRowSchema>
type MappingRow = z.infer<typeof customerIdMappingRowSchema>

const fixedNow = new Date('2026-09-29T17:30:00.000Z')
const request = { customerName: 'Somjai', phone: '0812345678', updatedBy: 'staff' }

function setup(customerRows: Array<Partial<CustomerRow>> = [], mappingRows: Array<Partial<MappingRow>> = []) {
  const events: string[] = []
  const appended: Array<Partial<CustomerRow>> = []
  const updates: Array<{ label: string; patch: Partial<MappingRow> }> = []
  let appendFailure: Error | null = null
  const customers = {
    read: async () => { events.push('customers.read'); return customerRows },
    append: async (row: Partial<CustomerRow>) => {
      events.push('customers.append')
      appended.push(row)
      if (appendFailure) throw appendFailure
      return row as CustomerRow
    },
  }
  const mapping = {
    read: async () => { events.push('mapping.read'); return mappingRows },
    update: async (label: string, patch: Partial<MappingRow>) => {
      events.push('mapping.update')
      updates.push({ label, patch })
      return { CustomerLabel: label, CustomerID: patch.CustomerID ?? null }
    },
  }
  const service = new CustomerRegistrationService({
    customers: () => customers,
    mapping: () => mapping,
    generateId: () => { events.push('generateId'); return 'new-id' },
    random: () => 0,
    now: () => fixedNow,
  })
  return { service, events, appended, updates, failAppend: (error: Error) => { appendFailure = error } }
}

async function successPath() {
  const fake = setup([], [{ CustomerLabel: 'ABC', CustomerID: '' }])
  const created = await fake.service.create(request)
  assert.deepEqual(fake.events, ['generateId', 'customers.read', 'mapping.read', 'mapping.update', 'customers.append'])
  assert.deepEqual(fake.updates, [{ label: 'ABC', patch: { CustomerID: 'new-id' } }])
  assert.equal(fake.appended[0].CustomerID, 'new-id')
  assert.equal(fake.appended[0].CustomerIndex, 'ABC')
  assert.equal(fake.appended[0].Timestamp, '2026-09-30 00:30:00')
  assert.equal(fake.appended[0].RegisteredDate, '2026-09-30')
  assert.equal(fake.appended[0].UpdatedBy, 'staff')
  assert.equal(fake.appended[0].ScheduledDays, null)
  assert.equal(fake.appended[0].DeletedAt, null)
  assert.equal(created.customerId, 'new-id')
  assert.equal(created.customerIndex, 'ABC')
  assert.equal(created.phone, request.phone)
}

async function duplicatePhone() {
  const fake = setup([
    { Phone: '081-234-5678', DeletedAt: '' },
  ], [{ CustomerLabel: 'ABC', CustomerID: '' }])
  await assert.rejects(() => fake.service.create(request), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 409)
    assert.deepEqual(error.details, { code: 'duplicate_phone' })
    return true
  })
  assert.deepEqual(fake.events, ['generateId', 'customers.read'])

  const deleted = setup([
    { Phone: '081 234 5678', DeletedAt: '2026-01-01 00:00:00' },
  ], [{ CustomerLabel: 'ABC', CustomerID: null }])
  await deleted.service.create(request)
  assert.equal(deleted.appended.length, 1)
}

async function rejectsFormattedPhone() {
  const fake = setup()
  await assert.rejects(() => fake.service.create({ ...request, phone: '081-234-5678' }), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 422)
    return true
  })
  assert.deepEqual(fake.events, [])
}

async function randomFreeLabel() {
  const fake = setup([], [
    { CustomerLabel: 'USED', CustomerID: 'old-id' },
    { CustomerLabel: 'AAA', CustomerID: null },
    { CustomerLabel: 'BBB', CustomerID: '' },
  ])
  const service = new CustomerRegistrationService({
    customers: () => ({ read: async () => [], append: async (row) => row as CustomerRow }),
    mapping: () => ({
      read: async () => [
        { CustomerLabel: 'USED', CustomerID: 'old-id' },
        { CustomerLabel: 'AAA', CustomerID: null },
        { CustomerLabel: 'BBB', CustomerID: '' },
      ],
      update: async (label, patch) => {
        fake.updates.push({ label, patch })
        return { CustomerLabel: label, CustomerID: patch.CustomerID ?? null }
      },
    }),
    generateId: () => 'new-id',
    random: () => 0.75,
    now: () => fixedNow,
  })
  const created = await service.create(request)
  assert.equal(created.customerIndex, 'BBB')
  assert.deepEqual(fake.updates, [{ label: 'BBB', patch: { CustomerID: 'new-id' } }])
}

async function releaseOnRejectedAppend() {
  const fake = setup([], [{ CustomerLabel: 'ABC', CustomerID: null }])
  const failure = new WriteRejectedError('append', 'append rejected')
  fake.failAppend(failure)
  await assert.rejects(() => fake.service.create(request), (error) => error === failure)
  assert.deepEqual(fake.updates, [
    { label: 'ABC', patch: { CustomerID: 'new-id' } },
    { label: 'ABC', patch: { CustomerID: '' } },
  ])
  assert.deepEqual(fake.events.slice(-3), ['mapping.update', 'customers.append', 'mapping.update'])
}

async function keepLabelOnUnknownAppend() {
  for (const failure of [new WriteTransportError('append', 'connection reset'), new Error('unrecognised')]) {
    const fake = setup([], [{ CustomerLabel: 'ABC', CustomerID: null }])
    fake.failAppend(failure)
    await assert.rejects(() => fake.service.create(request), (error) => error === failure)
    assert.deepEqual(fake.updates, [{ label: 'ABC', patch: { CustomerID: 'new-id' } }])
    assert.deepEqual(fake.events.slice(-2), ['mapping.update', 'customers.append'])
  }
}

await successPath()
await duplicatePhone()
await rejectsFormattedPhone()
await randomFreeLabel()
await releaseOnRejectedAppend()
await keepLabelOnUnknownAppend()
console.log('6 customer registration dry tests passed')
