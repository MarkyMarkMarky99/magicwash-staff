import assert from 'node:assert/strict'
import type { z } from 'zod'
import { bagItemApiContract } from '../../../../contracts/bag-items/bag-item-api.schema.js'
import { bagItemsDbContract, bagItemsRowSchema } from '../../../../server/sheets/BagItems/BagItems.db-contract.js'
import { createBagItemService } from '../../../../server/modules/bag-items/bag-item.module.js'
import type { ReadQueryDTO } from '../../../../server/shared/dtos/read-query.dto.js'
import { createCrudRoutes } from '../../../../server/shared/http/crud-routes.js'
import type { SheetRepositoryContract } from '../../../../server/shared/repositories/sheet-repository.contract.js'

type Row = z.infer<typeof bagItemsRowSchema>
const existing: Row = {
  id: 'existing-id', bag_id: 'bag-1', order_id: 'order-1', laundry_item_id: 'tag-1',
  created_at: '2026-10-08 10:00:00', created_by: 'original-staff',
}
const expectedDto = {
  bagItemId: 'existing-id', bagId: 'bag-1', orderId: 'order-1', laundryItemId: 'tag-1',
  createdAt: '2026-10-08 10:00:00', createdBy: 'original-staff',
}
let rows: Row[] = []
const reads: Array<ReadQueryDTO<Partial<Row>> | undefined> = []
const appends: Array<Partial<Row>> = []
let getterCalls = 0
const repository: SheetRepositoryContract<Row> = {
  read: async (query) => { reads.push(query); return rows },
  append: async (row) => {
    appends.push(row)
    return { ...row, created_at: '2026-10-08 11:00:00' } as Row
  },
  batchAppend: async () => { throw new Error('Unexpected batch append') },
  update: async () => { throw new Error('Unexpected update') },
  delete: async () => { throw new Error('Unexpected delete') },
}
const service = createBagItemService(() => { getterCalls++; return repository })
const routes = createCrudRoutes(service, bagItemApiContract)
assert.equal(getterCalls, 0, 'Constructing the module must stay lazy')

for (const query of [{}, { keyword: 'tag' }, { bagId: '' }, { orderId: '  ' }, { bagId: ['bag-1'] }]) {
  await assert.rejects(() => service.list(query), (error: unknown) => (error as { status: number }).status === 422)
}
assert.equal(getterCalls, 0, 'Invalid queries must fail before reading')
for (const query of [{ bagId: ' bag-1 ' }, { orderId: ' order-1 ' }, { bagId: 'bag-1', orderId: 'order-1' }]) {
  const result = await service.list(query)
  assert.deepEqual(result.pagination, { page: 1, perPage: 500 })
  assert.deepEqual(reads.at(-1)?.where, {
    ...(query.bagId === undefined ? {} : { bag_id: 'bag-1' }),
    ...(query.orderId === undefined ? {} : { order_id: 'order-1' }),
  })
  assert.deepEqual(reads.at(-1)?.sort, { field: 'created_at', order: 'asc' })
}
await service.list({ bagId: 'bag-1', keyword: 'tag', page: '2', perPage: '10', sortOrder: 'desc' })
assert.deepEqual(reads.at(-1)?.pagination, { page: 2, perPage: 10 })
assert.deepEqual(reads.at(-1)?.sort, { field: 'created_at', order: 'desc' })
assert.equal(reads.at(-1)?.search?.keyword, 'tag')

const payload = { bagId: ' bag-1 ', orderId: ' order-1 ', laundryItemId: ' tag-1 ', createdBy: ' staff-1 ' }
for (const field of ['bagId', 'orderId', 'laundryItemId', 'createdBy'] as const) {
  for (const value of ['', '  ', null, 123]) {
    await assert.rejects(() => service.create({ ...payload, [field]: value }),
      (error: unknown) => (error as { status: number }).status === 422)
  }
}
for (const field of ['bagItemId', 'createdAt', 'id', 'unexpected']) {
  await assert.rejects(() => service.create({ ...payload, [field]: 'client-value' }),
    (error: unknown) => (error as { status: number }).status === 422)
}
assert.equal(appends.length, 0)
const created = await service.create(payload)
assert.equal(appends.length, 1)
assert.match(created.bagItemId, /^[0-9a-f]{8}$/)
assert.deepEqual(appends[0], {
  bag_id: 'bag-1', order_id: 'order-1', laundry_item_id: 'tag-1', created_by: 'staff-1',
  id: created.bagItemId,
})
assert.deepEqual(reads.at(-1)?.where, { bag_id: 'bag-1', laundry_item_id: 'tag-1' })
assert.equal(reads.at(-1)?.pagination, undefined, 'Duplicate lookup must not be paginated')
assert.deepEqual(created, {
  bagItemId: created.bagItemId, bagId: 'bag-1', orderId: 'order-1', laundryItemId: 'tag-1',
  createdAt: '2026-10-08 11:00:00', createdBy: 'staff-1',
})

rows = [existing]
const duplicate = await service.create({ ...payload, orderId: 'different-order', createdBy: 'different-staff' })
assert.deepEqual(duplicate, expectedDto, 'Duplicate must return the original row verbatim')
assert.equal(appends.length, 1, 'Duplicate must not append')
assert.deepEqual(reads.at(-1)?.where, { bag_id: 'bag-1', laundry_item_id: 'tag-1' })
const request = { query: {}, headers: {}, params: {}, body: payload }
const response = await routes.collection.handleRequest({ ...request, method: 'POST' })
assert.equal(response.status, 201)
assert.deepEqual((response.body as { data: unknown }).data, expectedDto)
assert.equal(appends.length, 1)
const listResponse = await routes.collection.handleRequest({ ...request, query: { bagId: 'bag-1' }, method: 'GET' })
assert.equal(listResponse.status, 200)
assert.deepEqual((listResponse.body as { data: unknown }).data, [expectedDto])
assert.equal((await routes.collection.handleRequest({ ...request, method: 'GET' })).status, 422)
assert.equal(routes.item, undefined)

assert.deepEqual(bagItemsRowSchema.parse(existing), existing)
for (const column of Object.keys(existing)) {
  assert.equal(bagItemsRowSchema.safeParse({ ...existing, [column]: null }).success, false)
  assert.equal(bagItemsRowSchema.safeParse({ ...existing, [column]: 1 }).success, false)
  const missing = { ...existing } as Record<string, unknown>
  delete missing[column]
  assert.equal(bagItemsRowSchema.safeParse(missing).success, false)
}
assert.equal(bagItemsRowSchema.safeParse({ ...existing, extra: 'value' }).success, false)
assert.deepEqual(bagItemsDbContract.writes, { append: true, update: false, delete: false })
console.log('bag-items module dry tests passed (validation, filters, mapping, idempotency, routes, strict DB row)')
