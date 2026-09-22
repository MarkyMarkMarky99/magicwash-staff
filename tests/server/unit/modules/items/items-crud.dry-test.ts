import assert from 'node:assert/strict'
import { itemsRoutes } from '../../../../../server/modules/items/items.module.js'
import { getItemsRepository } from '../../../../../server/sheets/Items/Items.repository.js'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'

process.env.PRICE_LIST_SPREADSHEET_ID = 'items-test'

type Row = Record<string, unknown>
const rows: Row[] = [{
  id: 'a1b2c3d4', item_code: 'ITM-0098', category: 'shirts', subcategory: 'formal',
  itemtype: 'shirt', variant: null, display_name_th: 'เสื้อ', display_name_en: 'Shirt',
  active: false, image_url: null,
}]
const calls: { kind: string; payload?: unknown }[] = []
const repository = getItemsRepository()
Object.assign(repository, {
  read: async (query?: { id?: string; where?: Row }) => {
    calls.push({ kind: 'read', payload: query })
    return rows.filter((row) => (query?.id === undefined || row.id === query.id) &&
      (query?.where?.active === undefined || query.where.active === null || row.active === query.where.active))
  },
  append: async (row: Row) => {
    calls.push({ kind: 'append', payload: row })
    rows.push({ ...row })
    return { ...row }
  },
  update: async (id: string, patch: Row) => {
    calls.push({ kind: 'update', payload: patch })
    const row = rows.find((candidate) => candidate.id === id)
    assert.ok(row)
    Object.assign(row, patch)
    return { ...row }
  },
})

function request(method: string, body?: unknown, query: Record<string, string> = {}, id?: string): ApiHandlerRequest {
  return { method, query, body, headers: {}, params: id === undefined ? {} : { id } }
}
function data(result: { status: number; body: unknown }): Row {
  assert.ok(result.status === 200 || result.status === 201)
  return (result.body as { data: Row }).data
}

for (const invalid of [
  { category: 'shirts', subcategory: 'formal', itemType: 'shirt', displayNameTh: 'Shirt', price: 100 },
  { category: 'shirts', subcategory: 'formal', itemType: 'shirt', displayNameTh: 'Shirt', id: 'aabbccdd' },
  { category: 'shirts', subcategory: 'formal', itemType: 'shirt', displayNameTh: 'Shirt', itemCode: 'ITM-0001' },
  { category: '  ', subcategory: 'formal', itemType: 'shirt', displayNameTh: 'Shirt' },
]) {
  const before = calls.length
  assert.equal((await itemsRoutes.collection.handleRequest(request('POST', invalid))).status, 422)
  assert.equal(calls.length, before, 'invalid POST must not read or write')
}

const created = data(await itemsRoutes.collection.handleRequest(request('POST', {
  category: ' shirts ', subcategory: ' formal ', itemType: ' shirt ', displayNameTh: ' เสื้อ ',
})))
assert.match(String(created.id), /^[a-z0-9]{8}$/)
assert.equal(created.itemCode, 'ITM-0099')
assert.equal(created.category, 'shirts')
assert.equal(created.active, true)
assert.equal(created.variant, null)
assert.equal(created.displayNameEn, null)
assert.equal(created.imageUrl, null)
assert.equal('price' in created, false)
assert.equal((calls.find((call) => call.kind === 'append')!.payload as Row).item_code, 'ITM-0099')

const list = data(await itemsRoutes.collection.handleRequest(request('GET')))
assert.equal((list as unknown as Row[]).length, 2, 'unfiltered list includes inactive')
const inactive = data(await itemsRoutes.collection.handleRequest(request('GET', undefined, { active: 'false' })))
assert.deepEqual((inactive as unknown as Row[]).map((row) => row.id), ['a1b2c3d4'])
const active = data(await itemsRoutes.collection.handleRequest(request('GET', undefined, { active: 'true' })))
assert.deepEqual((active as unknown as Row[]).map((row) => row.id), [created.id])
assert.deepEqual(data(await itemsRoutes.item!.handleRequest(request('GET', undefined, {}, 'a1b2c3d4'))).active, false)

const patched = data(await itemsRoutes.item!.handleRequest(request('PATCH', { displayNameEn: ' Formal shirt ' }, {}, 'a1b2c3d4')))
assert.equal(patched.displayNameEn, 'Formal shirt')
assert.equal(patched.active, false, 'omitted active must remain false')
assert.deepEqual(calls.find((call) => call.kind === 'update')!.payload, { display_name_en: 'Formal shirt' })
const before = calls.length
assert.equal((await itemsRoutes.item!.handleRequest(request('PATCH', { itemCode: 'ITM-0001' }, {}, 'a1b2c3d4'))).status, 422)
assert.equal(calls.length, before)
assert.equal((await itemsRoutes.item!.handleRequest(request('DELETE', undefined, {}, 'a1b2c3d4'))).status, 405)

console.log('items CRUD dry test passed')
