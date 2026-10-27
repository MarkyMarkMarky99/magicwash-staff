import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { AttendanceService } from '../../../../server/modules/attendance/attendance.service.js'
import { createAttendanceRoutes } from '../../../../server/modules/attendance/attendance.module.js'
import type { AttendanceRow } from '../../../../server/sheets/Attendance/Attendance.db-contract.js'
import { ApiError } from '../../../../server/shared/http/api-error.js'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'
import { SheetsApiClient } from '../../../../server/shared/repositories/sheets-api.client.js'
import { invalidateStaffListCache, type StaffMember } from '../../../../server/shared/auth/staff-list.js'
import { routeRegistry } from '../../../../server/api/route-registry.js'

const admin: StaffMember = { staffId: 'admin', role: 'admin', name: 'Admin', email: 'admin@test' }
const staff: StaffMember = { ...admin, staffId: 'staff', role: 'staff' }
const device: StaffMember = { ...admin, staffId: 'device', role: 'device' }
const timestamp = '2026-10-28 00:30:00'
function row(id: string, staffId: string, date: string, status: AttendanceRow['status'] = 'DAY_OFF'): AttendanceRow {
  return {
    id, staff_id: staffId, work_date: date, status, notes: null, created_at: timestamp,
    created_by: 'original', updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
  }
}
function setup(initial: AttendanceRow[] = []) {
  const rows = initial.map((value) => ({ ...value }))
  const writes: Partial<AttendanceRow>[] = []
  let reads = 0
  const service = new AttendanceService(() => ({
    read: async () => { reads++; return rows.map((value) => ({ ...value })) },
    append: async (value) => {
      writes.push(value)
      const saved = { ...value, created_at: timestamp } as AttendanceRow
      rows.push(saved)
      return saved
    },
    update: async (id, patch) => {
      writes.push(patch)
      const saved = rows.find((value) => value.id === id)!
      Object.assign(saved, patch, { updated_at: timestamp })
      return { ...saved }
    },
  }), () => new Date('2026-10-27T17:30:00Z')) // Already Oct 28 in Bangkok.
  return { service, rows, writes, readCount: () => reads, routes: createAttendanceRoutes(service) }
}
async function fails(action: () => Promise<unknown>, status: number, reason?: RegExp) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, status)
    if (reason) assert.match(error.message, reason)
    return true
  })
}

// Every uniqueness rule on both create and update (including status transitions).
const conflicts = [
  { existing: row('other', 'someone', '2026-10-30'), date: '2026-10-30', status: 'DAY_OFF', reason: /someone.*day off/ },
  { existing: row('other', 'staff', '2026-10-29'), date: '2026-10-30', status: 'DAY_OFF', reason: /already.*week/ },
  ...(['DAY_OFF', 'LEAVE', 'ABSENT'] as const).flatMap((existingStatus) =>
    (['DAY_OFF', 'LEAVE', 'ABSENT'] as const).map((status) => ({
      existing: row('other', 'staff', '2026-10-30', existingStatus), date: '2026-10-30', status,
      reason: /already.*attendance record/,
    }))),
] as const
for (const scenario of conflicts) {
  const body = { staffId: 'staff', workDate: scenario.date, status: scenario.status }
  const create = setup([scenario.existing])
  await fails(() => create.service.create(body, admin), 409, scenario.reason)
  assert.equal(create.writes.length, 0)
  const update = setup([scenario.existing, row('target', 'staff', '2026-11-10', 'LEAVE')])
  await fails(() => update.service.update('target', { workDate: scenario.date, status: scenario.status }, admin), 409, scenario.reason)
  assert.equal(update.writes.length, 0)
  // The same physical row stops blocking either operation once cancelled.
  const deleted = { ...scenario.existing, deleted_at: timestamp, deleted_by: 'admin' }
  await setup([deleted]).service.create(body, admin)
  await setup([deleted, row('target', 'staff', '2026-11-10', 'LEAVE')]).service.update(
    'target', { workDate: scenario.date, status: scenario.status }, admin,
  )
}

// Staff day-off booking uses those same rules.
for (const existing of [row('a', 'someone', '2026-10-30'), row('a', 'staff', '2026-10-29'), row('a', 'staff', '2026-10-30', 'LEAVE')]) {
  await fails(() => setup([existing]).service.bookDayOff({ workDate: '2026-10-30' }, staff), 409)
}

// Inclusive tomorrow..today+14, calculated in Bangkok; admins can record the past.
for (const date of ['2026-10-27', '2026-10-28', '2026-11-12']) {
  await fails(() => setup().service.bookDayOff({ workDate: date }, staff), 400, /tomorrow.*14 days/)
  await fails(() => setup().service.bookDayOff({ workDate: date }, admin), 400)
}
for (const date of ['2026-10-29', '2026-11-11']) {
  const booked = await setup().service.bookDayOff({ workDate: date }, staff)
  assert.equal(booked.staffId, staff.staffId)
  assert.equal(booked.createdBy, staff.staffId)
  assert.equal(booked.status, 'DAY_OFF')
  assert.equal(booked.notes, null)
  await setup().service.bookDayOff({ workDate: date }, admin)
}
for (const status of ['DAY_OFF', 'LEAVE', 'ABSENT'] as const) {
  const past = setup()
  const created = await past.service.create({ staffId: 'staff', workDate: '2020-01-01', status }, admin)
  assert.equal(created.createdBy, admin.staffId)
  assert.equal((await past.service.update(created.id, { workDate: '2019-01-01' }, admin)).workDate, '2019-01-01')
}
for (const status of ['LEAVE', 'ABSENT'] as const) {
  const allowed = setup([row('occupied', 'other', '2026-10-30'), row('quota', 'staff', '2026-10-29')])
  await allowed.service.create({ staffId: 'staff', workDate: '2026-10-30', status }, admin)
  await allowed.service.update(allowed.rows[2]!.id, { notes: 'No day-off quota applies' }, admin)
  const transition = setup([row('occupied', 'other', '2026-10-30'), row('target', 'staff', '2026-11-10')])
  await transition.service.update('target', { workDate: '2026-10-30', status }, admin)
}

// Sunday and Monday belong to distinct weeks on create, update, and list.
const boundary = setup([row('sunday', 'staff', '2026-11-01')])
await boundary.service.create({ staffId: 'staff', workDate: '2026-11-02', status: 'DAY_OFF' }, admin)
const moved = setup([row('sunday', 'staff', '2026-11-01'), row('target', 'staff', '2026-11-10', 'LEAVE')])
await moved.service.update('target', { workDate: '2026-11-02', status: 'DAY_OFF' }, admin)
await fails(() => moved.service.update('target', { workDate: '2026-10-31' }, admin), 409, /week/)
const listing = setup([
  row('sunday', 'staff', '2026-11-01'), row('monday', 'staff', '2026-11-02'),
  row('leave', 'other', '2026-10-28', 'LEAVE'), row('absent', 'third', '2026-10-26', 'ABSENT'),
  { ...row('deleted', 'gone', '2026-10-29'), deleted_at: timestamp },
])
assert.deepEqual((await listing.service.list({ week: '2026-11-01' })).map((value) => value.id), ['sunday', 'leave', 'absent'])
assert.deepEqual((await listing.service.list({ week: '2026-10-26' })).map((value) => value.id), ['sunday', 'leave', 'absent'])
assert.deepEqual((await listing.service.list({ week: '2026-11-02' })).map((value) => value.id), ['monday'])

// Self exclusion, null clearing, fixed staff identity and a released quota after status change.
const edit = setup([row('self', 'staff', '2026-10-30')])
const edited = await edit.service.update('self', { notes: 'personal' }, admin)
assert.equal(edited.staffId, 'staff')
assert.equal(edited.updatedBy, 'admin')
assert.equal(edited.createdBy, 'original')
assert.equal(edited.notes, 'personal')
assert.equal((await edit.service.update('self', { notes: null }, admin)).notes, null)
await edit.service.update('self', { status: 'LEAVE' }, admin)
await edit.service.create({ staffId: 'other', workDate: '2026-10-30', status: 'DAY_OFF' }, admin)
await edit.service.create({ staffId: 'staff', workDate: '2026-10-31', status: 'DAY_OFF' }, admin)

const cancel = setup([row('cancel', 'staff', '2026-10-30')])
assert.deepEqual(await cancel.service.cancel('cancel', admin), { id: 'cancel' })
assert.equal(cancel.rows[0]!.deleted_at, timestamp)
assert.equal(cancel.rows[0]!.deleted_by, 'admin')
assert.equal(cancel.rows[0]!.updated_by, 'admin')
assert.deepEqual(await cancel.service.list({ week: '2026-10-30' }), [])
await cancel.service.create({ staffId: 'staff', workDate: '2026-10-30', status: 'DAY_OFF' }, admin)
for (const id of ['missing', 'cancel']) {
  await fails(() => cancel.service.update(id, { notes: 'x' }, admin), 404)
  await fails(() => cancel.service.cancel(id, admin), 404)
}

// Invalid requests fail with 400 before a repository read or write.
const invalid = setup()
for (const workDate of ['2026-02-29', '2026-04-31', '2026-1-01', 'today', '', null, 123]) {
  await fails(() => invalid.service.create({ staffId: 's', workDate, status: 'LEAVE' }, admin), 400)
  await fails(() => invalid.service.update('id', { workDate }, admin), 400)
  await fails(() => invalid.service.bookDayOff({ workDate }, staff), 400)
  await fails(() => invalid.service.list({ week: workDate }), 400)
}
for (const body of [{}, { staffId: 'changed' }, { updatedBy: 'forged' }, { status: 'WORKED' }, { notes: 123 }]) {
  await fails(() => invalid.service.update('id', body, admin), 400)
}
for (const body of [ {}, { staffId: '', workDate: '2026-10-30', status: 'LEAVE' },
  { staffId: 's', workDate: '2026-10-30', status: 'WORKED' },
  { staffId: 's', workDate: '2026-10-30', status: 'LEAVE', createdBy: 'forged' }]) {
  await fails(() => invalid.service.create(body, admin), 400)
}
await fails(() => invalid.service.bookDayOff({ workDate: '2026-10-30', staffId: 'other' }, staff), 400)
await fails(() => invalid.service.list({}), 400)
await fails(() => invalid.service.list({ week: ['2026-10-30'] }), 400)
assert.equal(invalid.readCount(), 0)

const { routes } = setup()
function request(method: string, actor?: StaffMember, body?: unknown, id?: string): ApiHandlerRequest {
  return { method, staff: actor, body, query: { week: '2026-10-30' }, params: id ? { id } : {}, headers: {} }
}
for (const actor of [staff, device]) {
  assert.equal((await routes.collection.handleRequest(request('POST', actor, {}))).status, 403)
  assert.equal((await routes.item!.handleRequest(request('PATCH', actor, {}, 'id'))).status, 403)
  assert.equal((await routes.item!.handleRequest(request('DELETE', actor, undefined, 'id'))).status, 403)
}
for (const actor of [admin, staff, device]) {
  assert.equal((await routes.collection.handleRequest(request('GET', actor))).status, 200)
}
assert.equal((await routes.collection.handleRequest(request('GET'))).status, 401)
assert.equal((await routes.item!.handleRequest(request('POST', staff, {}, 'unknown'))).status, 404)
const result = await routes.item!.handleRequest(request('POST', staff, { workDate: '2026-10-30' }, 'day-off'))
assert.equal(result.status, 201)
assert.equal((result.body as { success: boolean }).success, true)
assert.equal((await routes.item!.handleRequest(request('POST', device, { workDate: '2026-10-30' }, 'day-off'))).status, 403)
assert.equal((await routeRegistry.attendance()).item !== undefined, true)
const adminRoutes = setup().routes
const adminCreated = await adminRoutes.collection.handleRequest(request('POST', admin, {
  staffId: 'staff', workDate: '2020-01-01', status: 'ABSENT',
}))
assert.equal(adminCreated.status, 201)
const adminId = (adminCreated.body as { data: { id: string } }).data.id
assert.equal((await adminRoutes.item!.handleRequest(request('PATCH', admin, { notes: 'late record' }, adminId))).status, 200)
assert.equal((await adminRoutes.item!.handleRequest(request('DELETE', admin, undefined, adminId))).status, 200)
assert.equal((await adminRoutes.item!.handleRequest(request('PATCH', admin, { notes: 'gone' }, adminId))).status, 404)

// Use the existing gateway operator resolution: a scanned admin is capped to staff.
const originalRead = SheetsApiClient.prototype.readRange
const originalSpreadsheet = process.env.STAFF_SPREADSHEET_ID
try {
  process.env.STAFF_SPREADSHEET_ID = 'staff-test'
  invalidateStaffListCache()
  SheetsApiClient.prototype.readRange = async () => [
    ['Email', 'Name', 'Role', 'Active', 'StaffId'],
    ['admin@test', 'Scanned Admin', 'admin', true, 'scanned-admin'],
  ]
  const shared = setup()
  const gateway = new ApiGateway({ attendance: async () => shared.routes }, async () => device)
  const call = (method: string, path: string, operator?: string) => gateway.handleRequest({
    method, url: `/api/attendance${path}`, query: { week: '2026-10-30' },
    headers: operator ? { 'x-operator-id': operator } : {}, body: { workDate: '2026-10-30' },
  } as unknown as VercelRequest)
  assert.equal((await call('POST', '/day-off')).status, 403)
  assert.equal((await call('GET', '')).status, 200)
  assert.equal((await call('POST', '/day-off', 'scanned-admin')).status, 201)
  assert.equal(shared.rows[0]!.staff_id, 'scanned-admin')
  assert.equal(shared.rows[0]!.created_by, 'scanned-admin')
  assert.equal((await call('POST', '', 'scanned-admin')).status, 403)
  assert.equal((await call('PATCH', '/id', 'scanned-admin')).status, 403)
  assert.equal((await call('DELETE', '/id', 'scanned-admin')).status, 403)
} finally {
  SheetsApiClient.prototype.readRange = originalRead
  invalidateStaffListCache()
  if (originalSpreadsheet === undefined) delete process.env.STAFF_SPREADSHEET_ID
  else process.env.STAFF_SPREADSHEET_ID = originalSpreadsheet
}
console.log('Attendance service, routes and shared-device tests passed')
