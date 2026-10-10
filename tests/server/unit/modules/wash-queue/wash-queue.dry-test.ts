import assert from 'node:assert/strict'
import type { z } from 'zod'
import { washQueueRoutes } from '../../../../../server/modules/wash-queue/wash-queue.module.js'
import { getWashProgramsRepository } from '../../../../../server/sheets/WashPrograms/WashPrograms.repository.js'
import { getWashProductsRepository } from '../../../../../server/sheets/WashProducts/WashProducts.repository.js'
import { washOptionsSchema, washQueueCreateSchema } from '../../../../../contracts/wash-queue/wash-queue-api.schema.js'
import { getMachinesRepository } from '../../../../../server/sheets/Machines/Machines.repository.js'
import { getWashQueueRepository } from '../../../../../server/sheets/WashQueue/WashQueue.repository.js'
import { washQueueDbContract } from '../../../../../server/sheets/WashQueue/WashQueue.db-contract.js'
import { formatBangkokTimestamp } from '../../../../../server/shared/utils/bangkok-timestamp.js'
import { bangkokToday } from '../../../../../shared/utils/bangkok-datetime.js'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import type { washQueueRowSchema } from '../../../../../contracts/wash-queue/wash-queue-api.schema.js'

type WashQueueDto = z.infer<typeof washQueueRowSchema>

process.env.JOB_TICKETS_SPREADSHEET_ID = 'wash-queue-test'
type Row = Record<string, unknown>
const rows: Row[] = []
const writes: Row[] = []
Object.assign(getWashQueueRepository(), {
  read: async (query?: { id?: string }) => rows.filter((row) => !query?.id || row.id === query.id),
  append: async (row: Row) => {
    assert.equal(row.created_at, undefined, 'repository owns audit timestamps')
    assert.equal(row.updated_at, undefined)
    writes.push({ ...row })
    const timestamp = formatBangkokTimestamp(new Date())
    const stored = { ...row, created_at: timestamp, updated_at: timestamp }
    rows.push(stored)
    return stored
  },
  update: async (id: string, patch: Row) => {
    assert.equal(patch.updated_at, undefined, 'repository owns update timestamp')
    writes.push({ ...patch })
    const row = rows.find((candidate) => candidate.id === id)!
    Object.assign(row, patch, { updated_at: formatBangkokTimestamp(new Date()) })
    return { ...row }
  },
})
Object.assign(getMachinesRepository(), {
  read: async () => [
    { id: 'WSH15-01', status: 'ACTIVE', type: 'WSH' },
    { id: 'DRY08-01', status: 'ACTIVE', type: 'DRY' },
    { id: 'WSH15-02', status: 'MAINTENANCE' },
    { id: 'DRY08-02', status: 'RETIRED' },
  ],
})
const options = {
  program: 'SPA', steps: [
    { type: 'quick_wash', products: ['BLC-01', 'SOF-01'], temperature: 'cold' },
    { type: 'soak', products: ['DET-01'], duration: 'overnight' },
    { type: 'rinse', products: [] },
  ],
}
let programReads = 0
Object.assign(getWashProgramsRepository(), {
  read: async () => {
    programReads++
    return [
      { id: 'SPA-01', program_id: 'SPA', program_name: 'Spa', step_no: 1, step_type: 'rinse', products: '', status: 'ACTIVE', sort_order: 1 },
      { id: 'OLD-01', program_id: 'OLD', program_name: 'Old', step_no: 1, step_type: 'rinse', products: '', status: 'INACTIVE', sort_order: null },
    ]
  },
})
let productReads = 0
Object.assign(getWashProductsRepository(), {
  read: async () => {
    productReads++
    return [
      { id: 'DET-01', type: 'DETERGENT', status: 'ACTIVE' },
      { id: 'SOF-01', type: 'SOFTENER', status: 'ACTIVE' },
      { id: 'BLC-01', type: 'BLEACH', status: 'ACTIVE' },
      { id: 'DET-02', type: 'DETERGENT', status: 'INACTIVE' },
      { id: 'SOF-02', type: 'SOFTENER', status: 'INACTIVE' },
      { id: 'BLC-02', type: 'BLEACH', status: 'INACTIVE' },
    ]
  },
})
const staff = { staffId: 'STAFF-operator', email: 'operator@example.com', name: 'Operator', role: 'staff' as const }
function request(method: string, body?: unknown, id?: string): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params: id ? { id } : {}, staff }
}
function data(result: { status: number; body: unknown }): WashQueueDto {
  assert.ok(result.status === 200 || result.status === 201)
  return (result.body as { data: WashQueueDto }).data
}
async function create(): Promise<WashQueueDto> {
  return data(await washQueueRoutes.collection.handleRequest(request('POST', { photoUrl: ' https://example.com/basket.jpg ', weightBeforeKg: 12.3, machineId: ' WSH15-01 ', tagCode: ' A ', washOptions: options, instruction: 'Ignored legacy input' })))
}
const invalidCreates = [
  { photoUrl: '', weightBeforeKg: 1 }, { photoUrl: '  ', weightBeforeKg: 1 },
  { photoUrl: 7, weightBeforeKg: 1 }, { photoUrl: 'x', weightBeforeKg: 1, createdBy: 'spoof' },
  { photoUrl: 'x', weightBeforeKg: 1, workMinutes: 10 },
  { photoUrl: 'x', weightBeforeKg: 1, machineId: 'M-1' }, { photoUrl: 'x' },
  ...[0, -1, 200.1, 1.23, '1', null].map((weightBeforeKg) => ({ photoUrl: 'x', weightBeforeKg })),
  ...['a', 'AB', '', '1', null, undefined].map((tagCode) => ({ photoUrl: 'x', weightBeforeKg: 1, tagCode })),
]
for (const body of invalidCreates) {
  const before = writes.length
  assert.equal((await washQueueRoutes.collection.handleRequest(request('POST', { machineId: 'WSH15-01', tagCode: 'A', washOptions: options, ...body }))).status, 422)
  assert.equal(writes.length, before)
}
for (const machineId of [undefined, '', '  ', 'unknown', 'WSH15-02', 'DRY08-02']) {
  const before = writes.length
  const rejected = await washQueueRoutes.collection.handleRequest(request('POST', {
    photoUrl: 'x', weightBeforeKg: 1, tagCode: 'A', washOptions: options, ...(machineId === undefined ? {} : { machineId }),
  }))
  assert.equal(rejected.status, 422)
  if (machineId && machineId.trim()) {
    assert.equal((rejected.body as { error: { message: string } }).error.message, 'Choose an available machine.')
  }
  assert.equal(writes.length, before)
}
const created = await create()
assert.match(created.id, /^WQ-[a-f0-9]{8}$/)
assert.equal(created.status, 'Pending')
assert.equal(created.photoUrl, 'https://example.com/basket.jpg')
assert.equal(created.createdBy, staff.staffId)
assert.equal(created.updatedBy, staff.staffId)
assert.equal(created.workMinutes, null)
assert.equal(created.weightBeforeKg, 12.3)
assert.equal(writes[0]!.weight_before_kg, 12.3)
assert.equal(created.weightAfterKg, null)
assert.equal(created.unloadPhotoUrl, null)
assert.equal(created.machineId, 'WSH15-01')
assert.equal(writes[0]!.machine_id, 'WSH15-01')
assert.equal(writes[0]!.tag_code, 'A')
assert.equal(created.tagCode, 'A')
assert.equal(created.instruction, null)
assert.equal(writes[0]!.instruction, null)
assert.equal(writes[0]!.wash_options, JSON.stringify(options))
assert.deepEqual(created.washOptions, options)
assert.equal(created.createdAt, created.updatedAt)
assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
assert.deepEqual(washQueueDbContract.audit.onAppend, ['created_at', 'updated_at'])
const noted = data(await washQueueRoutes.collection.handleRequest(request('POST', { photoUrl: 'x', instruction: 'Gentle wash', weightBeforeKg: 200, machineId: 'DRY08-01', tagCode: 'Z', washOptions: null })))
assert.equal(noted.instruction, null)
assert.equal(noted.washOptions, null)
assert.equal(writes.at(-1)!.wash_options, null)
assert.equal(productReads, 1, 'dryer does not read products')
assert.equal(noted.weightBeforeKg, 200)
assert.equal(noted.machineId, 'DRY08-01')
const light = data(await washQueueRoutes.collection.handleRequest(request('POST', { photoUrl: 'x', weightBeforeKg: 0.1, machineId: 'WSH15-01', tagCode: 'B', washOptions: options })))
assert.equal(light.weightBeforeKg, 0.1)

const booking = { photoUrl: 'x', weightBeforeKg: 1, machineId: 'WSH15-01', tagCode: 'A', washOptions: options }
for (const [body, message] of [
  [{ ...booking, washOptions: null }, 'Choose the wash program.'],
  [{ ...booking, machineId: 'DRY08-01' }, 'Dryer bookings have no wash options.'],
] as const) {
  const before = writes.length
  const readsBefore: number = productReads
  const rejected = await washQueueRoutes.collection.handleRequest(request('POST', body))
  assert.equal(rejected.status, 422)
  assert.equal((rejected.body as { error: { message: string } }).error.message, message)
  assert.equal(writes.length, before)
  assert.equal(productReads, readsBefore)
}
assert.equal(washQueueCreateSchema.safeParse({ photoUrl: 'x', weightBeforeKg: 1, machineId: 'WSH15-01', tagCode: 'A' }).success, false)
assert.equal(programReads, 2, 'dryer does not read programs')
for (const program of ['unknown', 'OLD']) {
  const before = writes.length
  const rejected = await washQueueRoutes.collection.handleRequest(request('POST', { ...booking, washOptions: { ...options, program } }))
  assert.equal(rejected.status, 422)
  assert.equal((rejected.body as { error: { message: string } }).error.message, 'Choose an available program.')
  assert.equal(writes.length, before)
}
for (const type of ['stain_removal', 'normal_wash', 'quick_wash', 'rinse', 'soak']) for (const id of ['unknown', 'DET-02', 'SOF-02', 'BLC-02']) {
  const step = { type, products: [id], ...(type === 'soak' ? { duration: 'overnight' } : type === 'stain_removal' || type === 'rinse' ? {} : { temperature: 'cold' }) }
  const before = writes.length
  const rejected = await washQueueRoutes.collection.handleRequest(request('POST', { ...booking, washOptions: { program: 'CUSTOM', steps: [step] } }))
  assert.equal(rejected.status, 422)
  const message = (rejected.body as { error: { message: string } }).error.message
  assert.ok(message.includes(id) && message.endsWith(' is not an available product. Remove it from the step.'), message)
  assert.equal(writes.length, before)
}
for (const invalid of [
  { program: '', steps: options.steps }, { program: 'CUSTOM', steps: [] },
  { program: 'CUSTOM', steps: Array.from({ length: 21 }, () => ({ type: 'rinse', products: [] })) },
  { program: 'CUSTOM', steps: [{ type: 'rinse', products: ['DET-01', ' DET-01 '] }] },
  { program: 'CUSTOM', steps: [{ type: 'rinse', products: [''] }] },
  { program: 'CUSTOM', steps: [{ type: 'rinse', products: Array.from({ length: 11 }, (_, i) => String(i)) }] },
  ...[0, 721, 1.5, '1', 'OVERNIGHT'].map((duration) => ({ program: 'CUSTOM', steps: [{ type: 'soak', products: [], duration }] })),
  { program: 'CUSTOM', steps: [{ type: 'normal_wash', products: [], temperature: '30' }] },
  { program: 'CUSTOM', steps: [{ type: 'normal_wash', products: [] }] },
  { program: 'CUSTOM', steps: [{ type: 'rinse', products: [], temperature: 'cold' }] },
  { program: 'CUSTOM', steps: [{ type: 'soak', products: [], duration: 30, unknown: true }] },
  { program: 'CUSTOM', steps: [{ type: 'stain_removal', products: [], temperature: 'cold' }] },
  { program: 'CUSTOM', steps: [{ type: 'stain_removal', products: [], duration: 30 }] },
  { program: 'CUSTOM', steps: [{ type: 'stain_removal', products: ['DET-01', ' DET-01 '] }] },
  { program: 'CUSTOM', steps: [{ type: 'stain_removal', products: [''] }] },
  { program: 'CUSTOM', steps: [{ type: 'stain_removal', products: Array.from({ length: 11 }, (_, i) => String(i)) }] },
  { ...options, unknown: true },
]) {
  const before = writes.length
  assert.equal(washOptionsSchema.safeParse(invalid).success, false)
  assert.equal((await washQueueRoutes.collection.handleRequest(request('POST', { ...booking, washOptions: invalid }))).status, 422)
  assert.equal(writes.length, before)
}
for (const duration of [1, 720, 'overnight']) assert.ok(washOptionsSchema.safeParse({ program: 'CUSTOM', steps: [{ type: 'soak', products: [], duration }] }).success)
assert.ok(washOptionsSchema.safeParse({ program: 'CUSTOM', steps: [{ type: 'stain_removal', products: [] }] }).success)
assert.ok(washOptionsSchema.safeParse({ program: 'CUSTOM', steps: [{ type: 'stain_removal', products: Array.from({ length: 10 }, (_, i) => String(i)) }] }).success)
const readsBeforeCustom = programReads
for (const type of ['stain_removal', 'quick_wash', 'normal_wash', 'rinse', 'soak']) {
  const step = { type, products: ['DET-01', 'BLC-01', 'SOF-01'], ...(type === 'soak' ? { duration: 'overnight' } : type === 'stain_removal' || type === 'rinse' ? {} : { temperature: 'cold' }) }
  const custom = { program: 'CUSTOM', steps: [step] }
  assert.deepEqual(data(await washQueueRoutes.collection.handleRequest(request('POST', { ...booking, washOptions: custom }))).washOptions, custom, 'any product type is accepted in any step')
}
assert.equal(programReads, readsBeforeCustom, 'CUSTOM does not read WashPrograms')
const noProducts = { program: 'CUSTOM', steps: [{ type: 'rinse', products: [] }] }
assert.deepEqual(data(await washQueueRoutes.collection.handleRequest(request('POST', { ...booking, washOptions: noProducts }))).washOptions, noProducts)

const cases = [
  { action: 'load', from: ['Pending'], to: 'In Progress', at: 'loadedAt', by: 'loadedBy' },
  { action: 'unload', from: ['In Progress'], to: 'Completed', at: 'unloadedAt', by: 'unloadedBy' },
  { action: 'collect', from: ['Completed'], to: 'Collected', at: 'collectedAt', by: 'collectedBy' },
  { action: 'cancel', from: ['Pending', 'In Progress', 'Completed'], to: 'Cancelled', at: 'cancelledAt', by: 'cancelledBy' },
] as const
for (const transition of cases) for (const from of transition.from) {
  const body = transition.action === 'unload'
    ? { action: transition.action, weightAfterKg: 15.4, unloadPhotoUrl: ' https://example.com/wet.jpg ' }
    : { action: transition.action }
  const basket = await create()
  const row = rows.find((row) => row.id === basket.id)!
  row.status = from
  row.created_by = 'STAFF-sender'
  const result = data(await washQueueRoutes.item.handleRequest(request('PATCH', body, basket.id)))
  assert.equal(result.status, transition.to)
  assert.equal(result[transition.by], staff.staffId)
  assert.match(result[transition.at]!, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(result.updatedBy, staff.staffId)
  assert.equal(result.workMinutes, null)
  assert.equal(result.weightBeforeKg, 12.3)
  assert.equal(result.machineId, 'WSH15-01')
  assert.equal(result.weightAfterKg, transition.action === 'unload' ? 15.4 : null)
  assert.equal(result.unloadPhotoUrl, transition.action === 'unload' ? 'https://example.com/wet.jpg' : null)
  if (transition.action === 'unload') {
    assert.equal(writes.at(-1)!.weight_after_kg, 15.4)
    assert.equal(writes.at(-1)!.unload_photo_url, 'https://example.com/wet.jpg')
  }
  assert.equal(result.createdBy, 'STAFF-sender', 'ordinary staff may act on another sender basket')
  for (const status of ['Pending', 'In Progress', 'Completed', 'Collected', 'Cancelled']) {
    if ((transition.from as readonly string[]).includes(status)) continue
    row.status = status
    const before = writes.length
    const rejected = await washQueueRoutes.item.handleRequest(request('PATCH', body, basket.id))
    assert.equal(rejected.status, 409)
    assert.ok((rejected.body as { error: { message: string } }).error.message.length > 10)
    assert.equal(writes.length, before)
  }
  assert.equal((await washQueueRoutes.item.handleRequest(request('PATCH', body, 'missing'))).status, 404)
}
const id = created.id
const invalidUpdates = [
  { action: 'delete' }, { action: 'load', updatedBy: 'spoof' }, {},
  { action: 'unload' }, { action: 'unload', weightAfterKg: 1 },
  { action: 'unload', unloadPhotoUrl: 'x' },
  { action: 'unload', weightAfterKg: 1, unloadPhotoUrl: '  ' },
  { action: 'unload', weightAfterKg: 1, unloadPhotoUrl: 'x', machineId: 'M-1' },
  ...[0, -1, 200.1, 1.23, '1', null].map((weightAfterKg) => ({ action: 'unload', weightAfterKg, unloadPhotoUrl: 'x' })),
  ...['load', 'collect', 'cancel'].flatMap((action) => [
    { action, weightAfterKg: 1 }, { action, unloadPhotoUrl: 'x' }, { action, machineId: 'M-1' },
  ]),
]
for (const body of invalidUpdates) {
  const before = writes.length
  assert.equal((await washQueueRoutes.item.handleRequest(request('PATCH', body, id))).status, 422)
  assert.equal(writes.length, before)
}
assert.equal((await washQueueRoutes.item.handleRequest(request('DELETE', undefined, id))).status, 405)
const today = bangkokToday()
rows.length = 0
for (const [id, status, createdAt, updatedAt] of [
  ['later', 'Pending', '2026-01-03 01:00:00', '2000-01-01 00:00:00'],
  ['first', 'In Progress', 'Date(2026,0,1,1,0,0)', '2000-01-01 00:00:00'],
  ['second', 'Completed', '2026-01-02 01:00:00', '2000-01-01 00:00:00'],
  ['collected-today', 'Collected', '2026-01-04 01:00:00', `${today} 00:00:00`],
  ['cancelled-today', 'Cancelled', '2026-01-05 01:00:00', `${today} 23:59:59`],
  ['collected-old', 'Collected', '2026-01-06 01:00:00', '2000-01-01 23:59:59'],
  ['cancelled-old', 'Cancelled', '2026-01-07 01:00:00', '2000-01-01 00:00:00'],
]) rows.push({ id, status, created_at: createdAt, updated_at: updatedAt, photo_url: 'x', work_minutes: '', weight_before_kg: '12.3', weight_after_kg: '', unload_photo_url: '', machine_id: '', tag_code: '' })
const response = await washQueueRoutes.collection.handleRequest(request('GET'))
assert.equal(response.status, 200)
const list = (response.body as { data: WashQueueDto[] }).data
assert.deepEqual(list.map((row) => row.id), ['first', 'second', 'later', 'collected-today', 'cancelled-today'])
assert.equal(list[0]!.createdAt, '2026-01-01 01:00:00')
assert.equal(list[0]!.workMinutes, null)
assert.equal(list[0]!.loadedAt, null)
assert.equal(list[0]!.weightBeforeKg, 12.3)
assert.equal(list[0]!.weightAfterKg, null)
assert.equal(list[0]!.unloadPhotoUrl, null)
assert.equal(list[0]!.machineId, null)
assert.equal(list[0]!.tagCode, null)
rows[0]!.weight_before_kg = null
rows[0]!.weight_after_kg = '15.4'
const numericList = (await washQueueRoutes.collection.handleRequest(request('GET'))).body as { data: WashQueueDto[] }
const later = numericList.data.find((row) => row.id === 'later')!
assert.equal(later.weightBeforeKg, null)
assert.equal(later.weightAfterKg, 15.4)
for (const [value, expected] of [
  [JSON.stringify(options), options], ['', null], [null, null], [undefined, null],
  ['{broken', null], ['{}', null], ['null', null],
  [JSON.stringify({ ...options, steps: [] }), null],
  [JSON.stringify({ ...options, unknown: true }), null],
] as const) {
  rows[0]!.wash_options = value
  rows[0]!.instruction = 'Legacy note'
  const result = (await washQueueRoutes.collection.handleRequest(request('GET'))).body as { data: WashQueueDto[] }
  const row = result.data.find((row) => row.id === 'later')!
  assert.deepEqual(row.washOptions, expected)
  assert.equal(row.instruction, 'Legacy note')
}
console.log('wash queue dry test passed (create, 6 transitions, 18 conflicts, 6 missing IDs, list, weight validation, strict payloads)')
