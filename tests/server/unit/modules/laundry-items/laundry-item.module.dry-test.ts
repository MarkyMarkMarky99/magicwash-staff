import assert from 'node:assert/strict'
import type { z } from 'zod'
import { laundryItemApiContract } from '../../../../../contracts/laundry-items/laundry-item-api.schema.js'
import { createLaundryItemService } from '../../../../../server/modules/laundry-items/laundry-item.module.js'
import type { laundryItemsRowSchema } from '../../../../../server/sheets/LaundryItems/LaundryItems.db-contract.js'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { createCrudRoutes } from '../../../../../server/shared/http/crud-routes.js'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import { laundryItemsDbContract } from '../../../../../server/sheets/LaundryItems/LaundryItems.db-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { SheetsApiClient, type SheetsApiValue } from '../../../../../server/shared/repositories/sheets-api.client.js'

type Row = z.infer<typeof laundryItemsRowSchema>
const row: Row = {
  id: 'aB01zZ89', customer_id: 'customer-1', item_id: 'shirt', wash_program: 'delicate', notes: 'silk',
  created_at: '2026-10-23 10:00:00', created_by: 'staff-1', updated_at: null,
  updated_by: null, deleted_at: null, deleted_by: null, image_url: null,
}
const rows: Row[] = [
  { ...row, id: 'deleted1', deleted_at: '2026-10-23 11:00:00' },
  row,
  { ...row, id: 'next0002', deleted_at: '' },
  { ...row, id: 'other003', customer_id: 'customer-2' },
]
const reads: Array<ReadQueryDTO<Partial<Row>> | undefined> = []
const appends: Array<Partial<Row>> = []
const updates: Array<{ id: string; patch: Partial<Row> }> = []
const service = createLaundryItemService(() => ({
  read: async (query) => {
    reads.push(query)
    let result = rows.filter((item) => query?.id === undefined || item.id === query.id)
    if (query?.where?.customer_id) result = result.filter((item) => item.customer_id === query.where!.customer_id)
    if (query?.search?.keyword) {
      const { keyword, fields } = query.search
      result = result.filter((item) => fields.some((field) => String(item[field as keyof Row] ?? '').includes(keyword)))
    }
    if (query?.pagination) {
      const { page, perPage } = query.pagination
      result = result.slice((page - 1) * perPage, page * perPage)
    }
    return result
  },
  append: async (data) => {
    appends.push(data)
    const created = { ...row, ...data }
    rows.push(created)
    return created
  },
  update: async (id, patch) => {
    updates.push({ id, patch })
    return { ...rows.find((item) => item.id === id)!, ...patch }
  },
}))
const routes = createCrudRoutes(service, laundryItemApiContract, { create: ['createdBy'], update: ['updatedBy'] })
const request = (method: string, body: unknown = {}, id = row.id): ApiHandlerRequest => ({
  method, body, query: {}, params: { id }, headers: {},
  staff: { staffId: 'session-staff', email: 'staff@example.test', name: 'Staff', role: 'staff' },
})

const first = await service.list({ customerId: 'customer-1', perPage: 1 })
assert.deepEqual(first.items.map((item) => item.id), [row.id])
assert.deepEqual((await service.list({ customerId: 'customer-1', page: 2, perPage: 1 })).items.map((item) => item.id), ['next0002'])
assert.equal(reads[0]?.pagination, undefined, 'pagination must follow deleted-row exclusion')
assert.deepEqual(reads[0]?.where, { customer_id: 'customer-1' })
assert.equal((await service.list({ keyword: 'silk' })).items.length, 3)
assert.equal((await service.list({ keyword: 'absent' })).items.length, 0)
assert.deepEqual(reads[0]?.search?.fields, ['id', 'customer_id', 'item_id', 'wash_program', 'notes'])
assert.deepEqual(await service.getById(row.id), {
  id: row.id, customerId: row.customer_id, itemId: row.item_id, washProgram: row.wash_program, notes: row.notes,
  createdAt: row.created_at, createdBy: row.created_by, updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null, imageUrl: null,
})
await assert.rejects(service.getById('missing0'), (error: unknown) => error instanceof ApiError && error.status === 404)
await assert.rejects(service.getById('bad'), (error: unknown) => error instanceof ApiError && error.status === 422)

for (const id of [row.id, 'deleted1']) {
  const result = await routes.collection.handleRequest(request('POST', { id, customerId: 'customer-1', createdBy: 'payload-staff' }))
  assert.equal(result.status, 409)
}
assert.equal(appends.length, 0, 'duplicate live or deleted ids must not append')
const created = await routes.collection.handleRequest(request('POST', {
  id: 'newID004', customerId: 'customer-2', itemId: 'towel', washProgram: 'hot', notes: 'white', createdBy: 'payload-staff', imageUrl: 'https://example.test/cover.jpg',
}))
assert.equal(created.status, 201)
assert.equal((await service.getById('newID004')).imageUrl, 'https://example.test/cover.jpg')
assert.deepEqual(appends[0], {
  id: 'newID004', customer_id: 'customer-2', item_id: 'towel', wash_program: 'hot', notes: 'white', created_by: 'session-staff', image_url: 'https://example.test/cover.jpg',
})
assert.equal((await routes.collection.handleRequest(request('POST', { customerId: 'customer-1' }))).status, 422)
assert.equal(appends.length, 1, 'id must never be generated')

const patched = await routes.item!.handleRequest(request('PATCH', { itemId: null, washProgram: 'cold', notes: '', updatedBy: 'payload-staff' }))
assert.equal(patched.status, 200)
assert.deepEqual(updates[0], { id: row.id, patch: { item_id: null, wash_program: 'cold', notes: '', updated_by: 'session-staff' } })
for (const body of [{ updatedBy: 'staff' }, { id: 'newID004', notes: 'bad' }, { customerId: 'bad', notes: 'bad' }, { createdBy: 'bad', notes: 'bad' }]) {
  assert.equal((await routes.item!.handleRequest(request('PATCH', body))).status, 422)
}
assert.equal((await routes.item!.handleRequest(request('PATCH', { notes: 'missing' }, 'missing0'))).status, 404)
assert.equal((await routes.item!.handleRequest(request('PATCH', { notes: 'bad' }, 'bad'))).status, 422)
assert.equal(updates.length, 1)
const imagePatched = await routes.item!.handleRequest(request('PATCH', { imageUrl: 'https://example.test/replacement.jpg', updatedBy: 'payload-staff' }))
assert.equal(imagePatched.status, 200)
assert.deepEqual(updates[1], { id: row.id, patch: { image_url: 'https://example.test/replacement.jpg', updated_by: 'session-staff' } })
const imageCleared = await routes.item!.handleRequest(request('PATCH', { imageUrl: null, updatedBy: 'payload-staff' }))
assert.equal(imageCleared.status, 200)
assert.deepEqual(updates[2], { id: row.id, patch: { image_url: null, updated_by: 'session-staff' } })
assert.equal((await routes.item!.handleRequest(request('DELETE'))).status, 405)
const unauthenticated = { ...request('POST', { id: 'newID005', customerId: 'customer-1', createdBy: 'staff' }), staff: undefined }
assert.equal((await routes.collection.handleRequest(unauthenticated)).status, 401)

// Exercise this module's real contract and repository stamping without Google access.
const headers = Object.keys(laundryItemsDbContract.row.shape)
const headerMap = buildSheetHeaderMap(headers, headers, 'id')
let stored: SheetsApiValue[] = []
const client = new SheetsApiClient({
  spreadsheetId: 'laundry-items-test',
  sheetName: 'LaundryItems',
  fetchImpl: async () => { throw new Error('Live Google access is forbidden in this dry test') },
  accessTokenProvider: async () => 'test-token',
})
client.appendRows = async (values, option, width) => {
  assert.equal(option, 'USER_ENTERED')
  assert.equal(width, 12)
  stored = [...values[0]]
  return { updates: { updatedRows: 1, updatedData: { values: [stored] } } }
}
client.readColumn = async () => [['id'], [stored[0]]]
client.updateCells = async (ranges, option) => {
  assert.equal(option, 'USER_ENTERED')
  for (const range of ranges) {
    const match = /^LaundryItems!([A-L])2:[A-L]2$/.exec(range.range)
    assert.ok(match, range.range)
    assert.equal(range.range, `LaundryItems!${match[1]}2:${match[1]}2`)
    stored[match[1].charCodeAt(0) - 65] = range.values[0][0]
  }
  return { responses: [] }
}
client.readRange = async () => [stored]
let now = new Date('2026-10-23T03:00:00Z')
const realRepository = new SheetRepository<Row>({
  contract: laundryItemsDbContract,
  sheetsApiClient: client,
  sheetHeaderMapLoader: { load: async () => headerMap },
  now: () => now,
})
realRepository.read = async (query) => {
  if (stored.length === 0 || (query?.id !== undefined && query.id !== stored[0])) return []
  return [Object.fromEntries(headers.map((header, index) => [header, stored[index]])) as Row]
}
const realService = createLaundryItemService(() => realRepository)
const stamped = await realService.create({ id: 'realID01', customerId: 'customer-1', notes: 'clear me', createdBy: 'staff-1', imageUrl: 'https://example.test/cover.jpg' })
assert.equal(stamped.id, 'realID01')
assert.equal(stamped.imageUrl, 'https://example.test/cover.jpg')
assert.equal(stored[11], stamped.imageUrl)
assert.equal(stamped.createdAt, '2026-10-23 10:00:00')
assert.equal(stamped.createdBy, 'staff-1')
assert.equal(stamped.updatedAt, '', 'append must not stamp updated_at')
now = new Date('2026-10-23T04:01:02Z')
const changed = await realService.update('realID01', { notes: null, imageUrl: null, updatedBy: 'staff-2' })
assert.equal(changed.updatedAt, '2026-10-23 11:01:02')
assert.equal(changed.createdAt, stamped.createdAt)
assert.equal(changed.createdBy, 'staff-1')
assert.equal(changed.updatedBy, 'staff-2')
assert.equal(changed.notes, '', 'null must serialize to an empty cell to clear the value')
assert.equal(changed.customerId, 'customer-1')
assert.equal(changed.deletedAt, '')
assert.equal(changed.imageUrl, '', 'null must clear the cover photo cell')
assert.equal(stored[11], '')
const imageOnly = await realService.update('realID01', { imageUrl: 'https://example.test/replacement.jpg', updatedBy: 'staff-2' })
assert.equal(imageOnly.imageUrl, 'https://example.test/replacement.jpg')
assert.equal(stored[11], imageOnly.imageUrl)

console.log('laundry-items module dry tests passed')
