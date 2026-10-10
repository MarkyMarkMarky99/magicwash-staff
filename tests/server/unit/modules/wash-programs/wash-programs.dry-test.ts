import assert from 'node:assert/strict'
import { washProgramsApiContract } from '../../../../../contracts/wash-programs/wash-programs-api.schema.js'
import { washProgramsRoutes } from '../../../../../server/modules/wash-programs/wash-programs.module.js'
import { getWashProgramsRepository } from '../../../../../server/sheets/WashPrograms/WashPrograms.repository.js'
import { washProgramsDbContract } from '../../../../../server/sheets/WashPrograms/WashPrograms.db-contract.js'
import { resolveRoute, routeRegistry } from '../../../../../server/api/route-registry.js'

const row = (program: string, order: number, type: string, extra: Record<string, unknown> = {}) => ({
  id: `${program}-${order}`, program_id: program, program_name: `${program} name`, step_no: order,
  step_type: type, products: '', temperature: '', duration: '', status: 'ACTIVE', sort_order: null, ...extra,
})
let reads = 0
Object.assign(getWashProgramsRepository(), { read: async () => {
  reads++
  return [
    row('SPA', 4, 'normal_wash', { products: ' DET-A, , DET-B ', temperature: '60', sort_order: 2 }),
    row('SPA', 2, 'rinse', { program_name: 'Ignored later name', status: 'INACTIVE', sort_order: 99 }),
    row('SPA', 3, 'soak', { duration: ' OvErNiGhT ' }),
    row('SPA', 1, 'quick_wash'),
    row('SPA', 5, 'soak', { duration: '30' }),
    row('SPA', 6, 'soak', { duration: '1.5' }),
    row('SPA', 7, 'normal_wash', { temperature: '90' }),
    row('SPA', 8, 'rinse', { products: 'A,A' }),
    row('SPA', 9, 'nonsense'), row('SPA', 10, 'soak', { duration: '' }),
    row('SPA', 0, 'rinse'), row('SPA', NaN, 'rinse'),
    row('BAD', 1, 'soak', { duration: 'invalid' }),
    row('OLD', 1, 'rinse', { status: 'INACTIVE', sort_order: 1 }),
    row('Z', 1, 'rinse'),
    row('A', 1, 'stain_removal', { products: ' DET-A, , PRD-06 ', temperature: 'invalid', duration: 'invalid' }),
    row('A', 2, 'stain_removal'), row('B', 1, 'rinse', { sort_order: 2 }),
    row('', 1, 'rinse'), row('CUSTOM', 1, 'rinse'),
    row('BAD_STATUS', 1, 'rinse', { status: 'garbage' }),
  ]
} })
const staff = { staffId: 'STAFF-me', name: 'Me', email: 'me@example.test', role: 'staff' as const }
const request = { method: 'GET', query: {}, headers: {}, params: {}, body: undefined, staff }
assert.match(String(routeRegistry['wash-programs']), /import/)
assert.equal((await resolveRoute('wash-programs')).collection, washProgramsRoutes.collection)
const response = await washProgramsRoutes.collection.handleRequest(request)
assert.equal(response.status, 200)
const body = response.body as { data: unknown[]; meta: Record<string, unknown> }
const programs = body.data.map((value) => washProgramsApiContract.response.list.parse(value))
assert.deepEqual(programs.map((program) => program.id), ['OLD', 'B', 'SPA', 'A', 'Z'])
assert.equal(programs[0]!.status, 'INACTIVE')
const spa = programs.find((program) => program.id === 'SPA')!
assert.equal(spa.name, 'SPA name')
assert.equal(spa.status, 'ACTIVE')
assert.equal(spa.sortOrder, 2)
assert.deepEqual(spa.steps, [
  { type: 'quick_wash', products: [], temperature: 'cold' },
  { type: 'rinse', products: [] },
  { type: 'soak', products: [], duration: 'overnight' },
  { type: 'normal_wash', products: ['DET-A', 'DET-B'], temperature: '60' },
  { type: 'soak', products: [], duration: 30 },
])
assert.deepEqual(programs.find((program) => program.id === 'A')!.steps, [
  { type: 'stain_removal', products: ['DET-A', 'PRD-06'] },
  { type: 'stain_removal', products: [] },
])
assert.ok(washProgramsDbContract.row.shape.step_type.safeParse('stain_removal').success)
assert.equal('pagination' in body.meta, false)
for (const method of ['POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
  const rejected = await washProgramsRoutes.collection.handleRequest({ ...request, method })
  assert.equal(rejected.status, 405)
  assert.equal(rejected.headers?.Allow, 'GET')
}
assert.equal(reads, 1)
assert.deepEqual(washProgramsDbContract.writes, { append: false, update: false, delete: false })
for (const operation of [
  () => getWashProgramsRepository().append({ id: 'NEW' }),
  () => getWashProgramsRepository().update('SPA-1', { program_name: 'Changed' }),
  () => getWashProgramsRepository().delete('SPA-1', staff.staffId),
]) await assert.rejects(operation)
console.log('wash programs dry test passed (grouping, ordered steps, lenient parsing, bad rows, all statuses, lazy route, read-only)')
