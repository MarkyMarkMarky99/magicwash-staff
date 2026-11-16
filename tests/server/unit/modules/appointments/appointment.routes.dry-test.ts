import assert from 'node:assert/strict'
import { createAppointmentRoutes } from '../../../../../server/modules/appointments/appointment.routes.js'
import { AppointmentService, type AppointmentSheetDbRow } from '../../../../../server/modules/appointments/appointment.service.js'
import { createAppointmentTransformer } from '../../../../../server/modules/appointments/appointment.transformer.js'
import { appointmentsRowSchema } from '../../../../../server/sheets/Appointments/Appointments.db-contract.js'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'
import { appointmentCreateFixtures } from './appointment-write.fixtures.js'

const fixture = appointmentCreateFixtures[0]!
const row = Object.fromEntries(Object.keys(appointmentsRowSchema.shape).map((key, index) => [key, fixture.expectedRow[index]])) as AppointmentSheetDbRow
let storedDate = '2026-11-01'
let reads = 0
const writes: Partial<AppointmentSheetDbRow>[] = []
let instant = new Date('2026-11-16T02:59:59Z') // Monday 09:59 Bangkok
const service = new AppointmentService({
  repository: {
    read: async () => { reads += 1; return [{ ...row, AppointmentDate: storedDate }] },
    append: async (data) => { writes.push(data); return { ...row, ...data } },
    update: async (_id, data) => { writes.push(data); return { ...row, ...data } },
  },
  transformer: createAppointmentTransformer(),
  generateAppointmentId: () => 'APPT-test',
})
const routes = createAppointmentRoutes(service, () => instant)
const ai = { staffId: 'AI', name: 'Assistant', email: 'ai@example.com', role: 'staff' as const }
const human = { ...ai, staffId: 'worker' }
function request(method: string, body: unknown, staff = ai): ApiHandlerRequest {
  return { method, body, staff, query: {}, headers: {}, params: { id: 'APPT-test' } }
}
async function create(date: string, slot = '10:00-12:00', staff = ai) {
  return routes.collection.handleRequest(request('POST', {
    ...fixture.frontendRequest, appointmentDate: date, timeSlot: slot, createdBy: 'spoofed',
  }, staff))
}
async function patch(body: Record<string, unknown>, staff = ai) {
  return routes.item.handleRequest(request('PATCH', { ...body, updatedBy: 'spoofed' }, staff))
}
async function rejected(run: () => ReturnType<typeof create>, message: RegExp) {
  const before = writes.length
  const result = await run()
  assert.equal(result.status, 422, JSON.stringify(result.body))
  assert.match(JSON.stringify(result.body), message)
  assert.equal(writes.length, before, 'Rejected policy must not write')
}

assert.equal((await create('2026-11-16')).status, 201)
assert.equal(writes.at(-1)?.CreatedBy, 'AI')
assert.equal((await create('2026-11-29')).status, 201) // today + 13
await rejected(() => create('2026-11-15'), /between 2026-11-16 and 2026-11-29/)
await rejected(() => create('2026-11-30'), /between/)
await rejected(() => create('2026-11-17'), /Tuesday/)
await rejected(() => create('2026-11-24'), /Tuesday/)
await rejected(() => create('2026-11-31'), /valid calendar date/)
await rejected(() => create('not-a-date'), /YYYY-MM-DD/)
await rejected(() => create('2026-11-18', 'bad-slot'), /Invalid enum/)

for (const [slot, hour] of [['10:00-12:00', 10], ['13:00-15:00', 13], ['15:00-17:00', 15], ['18:00-20:00', 18]] as const) {
  instant = new Date(`2026-11-16T${String(hour - 7).padStart(2, '0')}:00:00Z`)
  await rejected(() => create('2026-11-16', slot), /already started today/)
  instant = new Date(instant.getTime() - 1)
  assert.equal((await create('2026-11-16', slot)).status, 201)
}
instant = new Date('2026-11-16T16:59:59Z') // Still Monday in Bangkok
assert.equal((await create('2026-11-18')).status, 201)
await rejected(() => create('2026-11-16', '18:00-20:00'), /already started/)
instant = new Date('2026-11-16T17:00:00Z') // Tuesday Bangkok, Monday UTC
await rejected(() => create('2026-11-17'), /Tuesday/)
await rejected(() => create('2026-11-16'), /between 2026-11-17 and 2026-11-30/)
instant = new Date('2026-12-31T17:00:00Z') // New year in Bangkok
assert.equal((await create('2027-01-14')).status, 201)
await rejected(() => create('2027-01-15'), /between 2027-01-01 and 2027-01-14/)

instant = new Date('2026-11-16T03:00:00Z')
assert.equal((await patch({ appointmentDate: '2026-11-17', timeSlot: '10:00-12:00', status: 'PENDING' })).status, 200) // Tuesday allowed
assert.equal(writes.at(-1)?.UpdatedBy, 'AI')
assert.equal((await patch({ appointmentDate: '2026-11-30' })).status, 200) // today + 14
await rejected(() => patch({ appointmentDate: '2026-11-16' }), /between 2026-11-17 and 2026-11-30/)
await rejected(() => patch({ appointmentDate: '2026-12-01' }), /between/)
await rejected(() => patch({ appointmentDate: '2026-11-31' }), /valid calendar date/)
const beforeOtherPatches = reads
assert.equal((await patch({ status: 'CANCELLED' })).status, 200)
assert.equal((await patch({ status: 'CANCELLED', appointmentDate: '2020-01-01' })).status, 200)
assert.equal((await patch({ notes: 'No date policy' })).status, 200)
assert.equal((await patch({ timeSlot: '10:00-12:00' })).status, 200)
assert.equal(reads - beforeOtherPatches, 4, 'Other PATCHes only perform the existing service read')
assert.equal((await patch({ appointmentDate: storedDate, notes: 'Unchanged old date' })).status, 200)
storedDate = 'Date(2026,10,1)'
assert.equal((await patch({ appointmentDate: '2026-11-01' })).status, 200, 'Normalize existing GViz date for comparison')

assert.equal((await create('2020-01-07', '10:00-12:00', human)).status, 201)
assert.equal((await patch({ appointmentDate: '2020-01-07' }, human)).status, 200)
assert.equal(writes.at(-1)?.UpdatedBy, 'worker')
assert.equal((await routes.collection.handleRequest({ ...request('POST', fixture.frontendRequest), staff: undefined })).status, 401)
assert.equal((await routes.collection.handleRequest(request('DELETE', {}))).status, 405)
assert.equal((await routes.item.handleRequest(request('POST', {}))).status, 405)
assert.equal((await routes.collection.handleRequest(request('GET', undefined))).status, 200)
assert.equal((await routes.item.handleRequest(request('GET', undefined))).status, 200)
console.log('appointment routes AI date policy dry test passed')
