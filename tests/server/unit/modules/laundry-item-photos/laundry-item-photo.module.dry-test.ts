import assert from 'node:assert/strict'
import type { z } from 'zod'
import { laundryItemPhotoApiContract } from '../../../../../contracts/laundry-item-photos/laundry-item-photo-api.schema.js'
import { createLaundryItemPhotoService } from '../../../../../server/modules/laundry-item-photos/laundry-item-photo.module.js'
import type { laundryItemPhotosRowSchema } from '../../../../../server/sheets/LaundryItemPhotos/LaundryItemPhotos.db-contract.js'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { createCrudRoutes } from '../../../../../server/shared/http/crud-routes.js'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import { laundryItemPhotosDbContract } from '../../../../../server/sheets/LaundryItemPhotos/LaundryItemPhotos.db-contract.js'
import type { orderGarmentsRowSchema } from '../../../../../server/sheets/OrderGarments/OrderGarments.db-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { SheetsApiClient, type SheetsApiValue } from '../../../../../server/shared/repositories/sheets-api.client.js'

type Row = z.infer<typeof laundryItemPhotosRowSchema>
const row: Row = {
  id: 'row-id-1', laundry_item_id: 'aB01zZ89', order_id: 'order-1', photo_type: 'BEFORE',
  image_url: 'https://example.test/photo.jpg', notes: 'silk', created_at: '2026-10-23 10:00:00',
  created_by: 'staff-1', updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
}
const rows: Row[] = [{ ...row, id: 'deleted1', deleted_at: '2026-10-23 11:00:00' }, row, { ...row, id: 'next0002', deleted_at: '' }]
type LinkRow = z.infer<typeof orderGarmentsRowSchema>
const link: LinkRow = {
  id: 'link-1', order_id: 'order-1', laundry_item_id: 'aB01zZ89', orderitem_id: null, notes: null, status: 'RECEIVED',
  created_at: '2026-10-23 09:00:00', created_by: 'staff-1', updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
}
const linkRows: LinkRow[] = [link, { ...link, id: 'link-gone', order_id: 'order-gone', deleted_at: '2026-10-23 10:00:00' }]
const linkReads: Array<Partial<LinkRow> | undefined> = []
const orderGarments = () => ({
  read: async (query?: ReadQueryDTO<Partial<LinkRow>>) => {
    linkReads.push(query?.where)
    return linkRows.filter((item) => Object.entries(query?.where ?? {}).every(([field, value]) => item[field as keyof LinkRow] === value))
  },
})
const reads: Array<ReadQueryDTO<Partial<Row>> | undefined> = []
const appends: Array<Partial<Row>> = []
const updates: Array<{ id: string; patch: Partial<Row> }> = []
const service = createLaundryItemPhotoService(() => ({
  read: async (query) => {
    reads.push(query)
    let result = rows.filter((item) => query?.id === undefined || item.id === query.id)
    for (const [field, value] of Object.entries(query?.where ?? {})) {
      result = result.filter((item) => item[field as keyof Row] === value)
    }
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
}), orderGarments)
const routes = createCrudRoutes(service, laundryItemPhotoApiContract, { create: ['createdBy'], update: ['updatedBy'] })
const request = (method: string, body: unknown = {}, id = row.id): ApiHandlerRequest => ({
  method, body, query: {}, params: { id }, headers: {},
  staff: { staffId: 'session-staff', email: 'staff@example.test', name: 'Staff', role: 'staff' },
})

const filters = {laundryItemId: 'aB01zZ89', orderId: 'order-1', photoType: 'BEFORE'}
const first = await service.list({ ...filters, perPage: 1, sortBy: 'updatedAt', sortOrder: 'desc' })
assert.deepEqual(first.items.map((item) => item.id), [row.id])
assert.deepEqual((await service.list({ ...filters, page: 2, perPage: 1 })).items.map((item) => item.id), ['next0002'])
assert.equal(reads[0]?.pagination, undefined, 'pagination must follow deleted-row exclusion')
assert.deepEqual(reads[0]?.where, {laundry_item_id: 'aB01zZ89', order_id: 'order-1', photo_type: 'BEFORE'})
assert.deepEqual(reads[0]?.sort, { field: 'updated_at', order: 'desc' })
assert.deepEqual(reads[0]?.search, { keyword: '', fields: [] })
await assert.rejects(service.list({ ...filters, keyword: 'absent' }), (error: unknown) => error instanceof ApiError && error.status === 422)
assert.deepEqual(await service.getById(row.id), {
  id: 'row-id-1', laundryItemId: 'aB01zZ89', orderId: 'order-1', photoType: 'BEFORE',
  imageUrl: 'https://example.test/photo.jpg', notes: 'silk', createdAt: '2026-10-23 10:00:00',
  createdBy: 'staff-1', updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null,
})
await assert.rejects(service.getById('missing'), (error: unknown) => error instanceof ApiError && error.status === 404)
const create = {
  laundryItemId: 'aB01zZ89', photoType: 'BEFORE', imageUrl: 'https://example.test/photo.jpg',
  orderId: 'order-1', notes: 'silk', createdBy: 'staff-1',
}
const created = await routes.collection.handleRequest(request('POST', { ...create, createdBy: 'payload-staff' }))
assert.equal(created.status, 201)
assert.match(appends[0]!.id!, /^[0-9a-f]{8}$/)
assert.deepEqual(appends[0], { id: appends[0]!.id, laundry_item_id: create.laundryItemId, order_id: create.orderId, photo_type: create.photoType, image_url: create.imageUrl, notes: create.notes, created_by: 'session-staff' })
assert.equal((await service.getById(appends[0]!.id!)).id, appends[0]!.id)
for (const body of [{ ...create, id: 'client-id' }, {}]) {
  assert.equal((await routes.collection.handleRequest(request('POST', body))).status, 422)
}
assert.equal(appends.length, 1)
assert.deepEqual(linkReads, [{ laundry_item_id: 'aB01zZ89', order_id: 'order-1' }], 'one OrderGarments read, only for the order check')

const badRequest = (error: unknown, message: string) => error instanceof ApiError && error.status === 400 && error.message === message
for (const orderId of ['order-other', 'order-gone']) {
  await assert.rejects(service.create({ ...create, orderId }), (error: unknown) => badRequest(error, 'Garment is not in this order'))
}
await assert.rejects(service.create({ ...create, laundryItemId: 'zZ99aB01' }), (error: unknown) => badRequest(error, 'Garment is not in this order'))
assert.equal((await routes.collection.handleRequest(request('POST', { ...create, orderId: 'order-other' }))).status, 400)
assert.equal(appends.length, 1, 'rejected order links must not append')
const linkReadsBefore = linkReads.length
for (const orderId of [null, '', undefined]) {
  await service.create({ ...create, orderId })
}
assert.equal(linkReads.length, linkReadsBefore, 'shared history photos skip the order check')
assert.equal(appends.length, 4)
assert.equal(appends[3]!.order_id, undefined)
for (const photoType of ['BEFORE', 'AFTER', 'DEFECT']) {
  await service.create({ ...create, photoType })
}
assert.equal(appends.length, 7)
await assert.rejects(service.create({ ...create, photoType: 'REGISTRATION' }), (error: unknown) => badRequest(error, 'Registration photos cannot be added here'))
await assert.rejects(service.create({ ...create, photoType: 'REGISTRATION', orderId: null }), (error: unknown) => badRequest(error, 'Registration photos cannot be added here'))
assert.equal((await routes.collection.handleRequest(request('POST', { ...create, photoType: 'REGISTRATION' }))).status, 400)
assert.equal(appends.length, 7, 'registration photos must not append')
const patched = await routes.item!.handleRequest(request('PATCH', { orderId: null, notes: '', photoType: 'AFTER', updatedBy: 'payload-staff' }))
assert.equal(patched.status, 200)
assert.deepEqual(updates[0], { id: row.id, patch: { order_id: null, notes: '', photo_type: 'AFTER', updated_by: 'session-staff' } })
for (const field of ['id', 'laundryItemId', 'createdAt', 'createdBy', 'created_at', 'updatedAt', 'deletedAt', 'deletedBy', 'imageUrl']) {
  assert.equal((await routes.item!.handleRequest(request('PATCH', { notes: 'bad', [field]: 'forbidden' }))).status, 422)
}
assert.equal((await routes.item!.handleRequest(request('PATCH', { updatedBy: 'staff' }))).status, 422)
assert.equal((await routes.item!.handleRequest(request('PATCH', { notes: 'missing' }, 'missing'))).status, 404)
assert.equal(updates.length, 1)
assert.equal((await routes.item!.handleRequest(request('DELETE'))).status, 405)
assert.equal((await routes.collection.handleRequest({ ...request('POST', create), staff: undefined })).status, 401)
assert.equal((await routes.item!.handleRequest({ ...request('PATCH', { notes: 'value' }), staff: undefined })).status, 401)

// Exercise this module's real contract and repository stamping without Google access.
const headers = Object.keys(laundryItemPhotosDbContract.row.shape)
const headerMap = buildSheetHeaderMap(headers, headers, 'id')
let stored: SheetsApiValue[] = []
const client = new SheetsApiClient({
  spreadsheetId: 'laundry-item-photos-test',
  sheetName: 'LaundryItemPhotos',
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
    const match = /^LaundryItemPhotos!([A-L])2:[A-L]2$/.exec(range.range)
    assert.ok(match, range.range)
    assert.equal(range.range, `LaundryItemPhotos!${match[1]}2:${match[1]}2`)
    stored[match[1].charCodeAt(0) - 65] = range.values[0][0]
  }
  return { responses: [] }
}
client.readRange = async () => [stored]
let now = new Date('2026-10-23T03:00:00Z')
const realRepository = new SheetRepository<Row>({
  contract: laundryItemPhotosDbContract,
  sheetsApiClient: client,
  sheetHeaderMapLoader: { load: async () => headerMap },
  now: () => now,
})
realRepository.read = async (query) => {
  if (stored.length === 0 || (query?.id !== undefined && query.id !== stored[0])) return []
  return [Object.fromEntries(headers.map((header, index) => [header, stored[index]])) as Row]
}
const realService = createLaundryItemPhotoService(() => realRepository, orderGarments)
const stamped = await realService.create(create)
assert.match(stamped.id, /^[0-9a-f]{8}$/)
assert.equal(stored[0], stamped.id)
assert.equal(stamped.createdAt, '2026-10-23 10:00:00')
assert.equal(stamped.createdBy, 'staff-1')
assert.equal(stamped.updatedAt, '', 'append must not stamp updated_at')
now = new Date('2026-10-23T04:01:02Z')
const changed = await realService.update(stamped.id, { orderId: null, notes: null, updatedBy: 'staff-2' })
assert.equal(changed.updatedAt, '2026-10-23 11:01:02')
assert.equal(changed.createdAt, stamped.createdAt)
assert.equal(changed.createdBy, 'staff-1')
assert.equal(changed.updatedBy, 'staff-2')
assert.equal(changed.notes, '', 'null must serialize to an empty cell')
assert.equal(changed.orderId, '')
assert.equal(changed.laundryItemId, create.laundryItemId)
assert.equal(changed.deletedAt, '')
const enumOnly = await realService.update(stamped.id, { photoType: 'DEFECT', updatedBy: 'staff-2' })
assert.equal(enumOnly.photoType, 'DEFECT')
console.log('laundry-item-photos module dry tests passed')
