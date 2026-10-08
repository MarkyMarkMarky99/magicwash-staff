import assert from 'node:assert/strict'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import { AppointmentService, type AppointmentSheetDbRow } from '../../../../../server/modules/appointments/appointment.service.js'
import { createAppointmentTransformer } from '../../../../../server/modules/appointments/appointment.transformer.js'

function responseRow(appointmentId: string): AppointmentSheetDbRow {
  return {
    AppointmentID: appointmentId,
    CustomerID: 'CUST-1',
    AppointmentType: 'PICKUP',
    AppointmentDate: '2026-04-02',
    TimeSlot: '13:00-15:00',
    Status: 'CONFIRMED',
    Address: JSON.stringify({
      CustomerName: 'Somchai',
      CustomerLabel: 'WIX',
      Phone: '0812345678',
      Address: '12 ถนนสุขุมวิท',
      Location: 'Bangkok',
    }),
    PickupOrderID: null,
    DeliveryOrderID: null,
    Notes: null,
    CreatedAt: '2026-04-01 07:34:56',
    UpdatedAt: null,
    CreatedBy: null,
    UpdatedBy: null,
    ServiceTier: null,
    DeletedAt: null,
    DeletedBy: null,
    Vehicle: null,
  }
}

let row = responseRow('APPT-existing')
let updateFails = false
const repository: SheetRepositoryContract<AppointmentSheetDbRow> = {
  async read() { return [row] },
  async append() { throw new Error('unexpected append') },
  async batchAppend() { throw new Error('unexpected batch') },
  async update(id, patch) { if (updateFails) throw new Error('update failed'); row = { ...row, ...patch }; return row },
  async delete() { throw new Error('unexpected delete') },
}
const calls: Array<{ orderId: string; payload: unknown }> = []
let completeFails = false
const service = new AppointmentService({ repository, transformer: createAppointmentTransformer(),
  async completeDeliveryOrder(orderId, payload) { calls.push({ orderId, payload }); if (completeFails) throw new Error('completion failed') },
})
for (const type of ['PICKUP', 'DELIVERY', 'PICKUP_DELIVERY'] as const) {
  for (const deliveryId of [null, '', '   ', 'order-1']) {
    for (const status of ['CONFIRMED', 'COMPLETED'] as const) {
      row = { ...responseRow('APPT-existing'), AppointmentType: type, DeliveryOrderID: deliveryId }
      const count = calls.length
      const result = await service.update('APPT-existing', { status, updatedBy: ' driver ' })
      assert.equal(result.status, status)
      const eligible = type !== 'PICKUP' && deliveryId === 'order-1' && status === 'COMPLETED'
      assert.equal(calls.length, count + (eligible ? 1 : 0))
      if (eligible) assert.deepEqual(calls.at(-1), { orderId: 'order-1', payload: { status: 'COMPLETED', updatedBy: ' driver ' } })
    }
  }
}
row = { ...responseRow('APPT-existing'), AppointmentType: 'DELIVERY', DeliveryOrderID: 'order-1', Status: 'COMPLETED' }
let before = calls.length
await service.update('APPT-existing', { notes: 'Already complete', updatedBy: 'driver' })
assert.equal(calls.length, before)
const logs: unknown[][] = []
const originalError = console.error
try {
  console.error = (...args) => logs.push(args)
  completeFails = true
  const result = await service.update('APPT-existing', { status: 'COMPLETED', updatedBy: 'driver' })
  assert.equal(result.status, 'COMPLETED')
  assert.equal(result.deliveryOrderId, 'order-1')
  assert.equal(logs[0]?.[0], 'Failed to complete delivery order')
  before = calls.length
  updateFails = true
  await assert.rejects(() => service.update('APPT-existing', { status: 'COMPLETED', updatedBy: 'driver' }))
  assert.equal(calls.length, before)
  updateFails = false
  await assert.rejects(() => service.update('APPT-existing', { status: 'invalid', updatedBy: 'driver' }))
  assert.equal(calls.length, before)
} finally { console.error = originalError }
console.log('appointment completer dry test passed')
