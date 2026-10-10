import assert from 'node:assert/strict'
import { machinesApiContract } from '../../../../../contracts/machines/machines-api.schema.js'
import { machinesRoutes } from '../../../../../server/modules/machines/machines.module.js'
import { getMachinesRepository } from '../../../../../server/sheets/Machines/Machines.repository.js'
import { machinesDbContract } from '../../../../../server/sheets/Machines/Machines.db-contract.js'
import { resolveRoute } from '../../../../../server/api/route-registry.js'

const machine = (id: string, type: 'WSH' | 'DRY', sortOrder: number | null, status = 'ACTIVE') => ({
  id, type, name: 'เครื่องอบ 15 kg', capacity_kg: 15, status,
  sort_order: sortOrder, note: null, created_at: '2026-10-10 07:00:00', updated_at: null,
})
let reads = 0
Object.assign(getMachinesRepository(), {
  read: async () => {
    reads++
    return [
      machine('DRY08-03', 'DRY', null), machine('WSH15-03', 'WSH', null),
      machine('DRY08-02', 'DRY', 1), machine('WSH15-02', 'WSH', 1),
      machine('WSH15-01', 'WSH', 1), machine('DRY08-01', 'DRY', 0),
      machine('WSH15-04', 'WSH', 0), machine('DRY08-04', 'DRY', 0, 'MAINTENANCE'),
      machine('WSH15-05', 'WSH', -1, 'RETIRED'),
      { ...machine('legacy-id', 'WSH', null), capacity_kg: null, note: '' },
    ]
  },
})
const staff = { staffId: 'STAFF-me', name: 'Me', email: 'me@example.test', role: 'staff' as const }
const request = { method: 'GET', query: {}, headers: {}, params: {}, body: undefined, staff }
assert.equal((await resolveRoute('machines')).collection, machinesRoutes.collection)
const response = await machinesRoutes.collection.handleRequest(request)
assert.equal(response.status, 200)
const body = response.body as { success: boolean; data: unknown[]; meta: Record<string, unknown> }
assert.equal(body.success, true)
const rows = body.data.map((row) => machinesApiContract.response.list.parse(row))
assert.deepEqual(rows.map((row) => row.id), [
  'WSH15-04', 'WSH15-01', 'WSH15-02', 'legacy-id', 'WSH15-03',
  'DRY08-01', 'DRY08-02', 'DRY08-03',
])
assert.deepEqual(Object.keys(body.data[0] as object), ['id', 'type', 'name', 'capacityKg', 'status', 'sortOrder', 'note'])
assert.equal(rows[0]!.name, 'เครื่องอบ 15 kg')
assert.equal(rows[3]!.capacityKg, null)
assert.equal(rows[3]!.note, null)
assert.equal('pagination' in body.meta, false)
for (const method of ['POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
  const rejected = await machinesRoutes.collection.handleRequest({ ...request, method })
  assert.equal(rejected.status, 405)
  assert.equal(rejected.headers?.Allow, 'GET')
}
assert.equal(reads, 1, 'unsupported methods must not read the sheet')
assert.deepEqual(machinesDbContract.writes, { append: false, update: false, delete: false })
for (const operation of [
  () => getMachinesRepository().append({ id: 'WSH15-06' }),
  () => getMachinesRepository().update('WSH15-01', { name: 'Changed' }),
  () => getMachinesRepository().delete('WSH15-01', staff.staffId),
]) await assert.rejects(operation)
console.log('machines dry test passed (ACTIVE filtering, type/order/id sorting, DTO, lazy route, 405, read-only writes)')
