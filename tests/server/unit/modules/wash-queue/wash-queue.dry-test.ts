import assert from 'node:assert/strict'
import type { z } from 'zod'
import { washQueueRoutes } from '../../../../../server/modules/wash-queue/wash-queue.module.js'
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
const staff = { staffId: 'STAFF-operator', email: 'operator@example.com', name: 'Operator', role: 'staff' as const }
function request(method: string, body?: unknown, id?: string): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params: id ? { id } : {}, staff }
}
function data(result: { status: number; body: unknown }): WashQueueDto {
  assert.ok(result.status === 200 || result.status === 201)
  return (result.body as { data: WashQueueDto }).data
}
async function create(): Promise<WashQueueDto> {
  return data(await washQueueRoutes.collection.handleRequest(request('POST', { photoUrl: ' https://example.com/basket.jpg ', weightBeforeKg: 12.3 })))
}
const invalidCreates = [
  { photoUrl: '', weightBeforeKg: 1 }, { photoUrl: '  ', weightBeforeKg: 1 },
  { photoUrl: 7, weightBeforeKg: 1 }, { photoUrl: 'x', weightBeforeKg: 1, createdBy: 'spoof' },
  { photoUrl: 'x', weightBeforeKg: 1, workMinutes: 10 },
  { photoUrl: 'x', weightBeforeKg: 1, machineId: 'M-1' }, { photoUrl: 'x' },
  ...[0, -1, 200.1, 1.23, '1', null].map((weightBeforeKg) => ({ photoUrl: 'x', weightBeforeKg })),
]
for (const body of invalidCreates) {
  const before = writes.length
  assert.equal((await washQueueRoutes.collection.handleRequest(request('POST', body))).status, 422)
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
assert.equal(created.machineId, null)
assert.equal(writes[0]!.machine_id, null)
assert.equal(created.instruction, null)
assert.equal(created.createdAt, created.updatedAt)
assert.match(created.createdAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
assert.deepEqual(washQueueDbContract.audit.onAppend, ['created_at', 'updated_at'])
const noted = data(await washQueueRoutes.collection.handleRequest(request('POST', { photoUrl: 'x', instruction: 'Gentle wash', weightBeforeKg: 200 })))
assert.equal(noted.instruction, 'Gentle wash')
assert.equal(noted.weightBeforeKg, 200)
const light = data(await washQueueRoutes.collection.handleRequest(request('POST', { photoUrl: 'x', weightBeforeKg: 0.1 })))
assert.equal(light.weightBeforeKg, 0.1)

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
  assert.equal(result.machineId, null)
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
]) rows.push({ id, status, created_at: createdAt, updated_at: updatedAt, photo_url: 'x', work_minutes: '', weight_before_kg: '12.3', weight_after_kg: '', unload_photo_url: '', machine_id: '' })
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
rows[0]!.weight_before_kg = null
rows[0]!.weight_after_kg = '15.4'
const numericList = (await washQueueRoutes.collection.handleRequest(request('GET'))).body as { data: WashQueueDto[] }
const later = numericList.data.find((row) => row.id === 'later')!
assert.equal(later.weightBeforeKg, null)
assert.equal(later.weightAfterKg, 15.4)
console.log('wash queue dry test passed (create, 6 transitions, 18 conflicts, 6 missing IDs, list, weight validation, strict payloads)')
