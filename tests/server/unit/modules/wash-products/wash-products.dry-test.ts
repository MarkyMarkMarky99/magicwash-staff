import assert from 'node:assert/strict'
import { washProductsApiContract } from '../../../../../contracts/wash-products/wash-products-api.schema.js'
import { washProductsRoutes } from '../../../../../server/modules/wash-products/wash-products.module.js'
import { getWashProductsRepository } from '../../../../../server/sheets/WashProducts/WashProducts.repository.js'
import { washProductsDbContract } from '../../../../../server/sheets/WashProducts/WashProducts.db-contract.js'
import { resolveRoute } from '../../../../../server/api/route-registry.js'

const product = (id: string, type: 'DETERGENT' | 'SOFTENER' | 'BLEACH', sortOrder: number | null, status = 'ACTIVE') => ({
  id, type, name: 'Product name', status, sort_order: sortOrder, note: '',
  created_at: '2026-10-10 07:00:00', updated_at: null,
})
let reads = 0
Object.assign(getWashProductsRepository(), {
  read: async () => {
    reads++
    return [
      product('SOF-02', 'SOFTENER', null), product('DET-02', 'DETERGENT', 1),
      product('BLC-03', 'BLEACH', null), product('BLC-02', 'BLEACH', 1),
      product('DET-01', 'DETERGENT', 1, 'INACTIVE'), product('BLC-01', 'BLEACH', 0),
      product('SOF-01', 'SOFTENER', -1, 'INACTIVE'), product('DET-03', 'DETERGENT', null),
    ]
  },
})
const staff = { staffId: 'STAFF-me', name: 'Me', email: 'me@example.test', role: 'staff' as const }
const request = { method: 'GET', query: {}, headers: {}, params: {}, body: undefined, staff }
assert.equal((await resolveRoute('wash-products')).collection, washProductsRoutes.collection)
const response = await washProductsRoutes.collection.handleRequest(request)
assert.equal(response.status, 200)
const body = response.body as { success: boolean; data: unknown[]; meta: Record<string, unknown> }
assert.equal(body.success, true)
const rows = body.data.map((row) => washProductsApiContract.response.list.parse(row))
assert.deepEqual(rows.map((row) => row.id), ['BLC-01', 'BLC-02', 'BLC-03', 'DET-01', 'DET-02', 'DET-03', 'SOF-01', 'SOF-02'])
assert.deepEqual(Object.keys(body.data[0] as object), ['id', 'type', 'name', 'status', 'sortOrder', 'note'])
assert.equal(rows[3]!.status, 'INACTIVE')
assert.equal(rows[6]!.status, 'INACTIVE')
assert.equal(rows[0]!.name, 'Product name')
assert.equal(rows[2]!.sortOrder, null)
assert.equal(rows[0]!.note, null)
assert.equal('pagination' in body.meta, false)
for (const method of ['POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
  const rejected = await washProductsRoutes.collection.handleRequest({ ...request, method })
  assert.equal(rejected.status, 405)
  assert.equal(rejected.headers?.Allow, 'GET')
}
assert.equal(reads, 1, 'unsupported methods must not read the sheet')
assert.deepEqual(washProductsDbContract.writes, { append: false, update: false, delete: false })
for (const operation of [
  () => getWashProductsRepository().append({ id: 'DET-04' }),
  () => getWashProductsRepository().update('DET-01', { name: 'Changed' }),
  () => getWashProductsRepository().delete('DET-01', staff.staffId),
]) await assert.rejects(operation)
console.log('wash products dry test passed (all statuses, type/order/id sorting, DTO, lazy route, 405, read-only writes)')
