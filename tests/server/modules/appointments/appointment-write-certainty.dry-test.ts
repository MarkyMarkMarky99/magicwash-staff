import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  appointmentApiContract,
  appointmentDetailResponseSchema,
} from '../../../../contracts/appointments/appointment-api.schema.js'
import { AppointmentService } from '../../../../server/modules/appointments/appointment.service.js'
import { appointmentsFieldMap } from '../../../../server/modules/appointments/appointment.mapping.js'
import { createAppointmentTransformer } from '../../../../server/modules/appointments/appointment.transformer.js'
import { createCrudRoutes } from '../../../../server/shared/http/crud-routes.js'
import type { ApiHandlerRequest } from '../../../../server/shared/http/api-handler.js'
import type { SheetRepositoryContract } from '../../../../server/shared/repositories/sheet-repository.contract.js'
import {
  WriteCommittedUnreadableError,
  WriteRejectedError,
} from '../../../../server/shared/repositories/sheets-api.client.js'
import type { appointmentsRowSchema } from '../../../../server/sheets/Appointments/Appointments.db-contract.js'

type AppointmentRow = z.infer<typeof appointmentsRowSchema>

const appointmentPayload = {
  customerId: 'CUST-001',
  customerName: 'Test Customer',
  customerCode: 'C001',
  phone: '0800000000',
  address: '1 Test Road',
  location: 'Bangkok',
  appointmentType: 'PICKUP' as const,
  appointmentDate: '2026-08-11',
  timeSlot: '10:00-12:00' as const,
  pickupOrderId: null,
  deliveryOrderId: null,
  notes: 'Test appointment',
  createdBy: 'admin',
}

const persistedRow: AppointmentRow = {
  AppointmentID: 'APPT-12345678',
  CustomerID: 'CUST-001',
  AppointmentType: 'PICKUP',
  AppointmentDate: '2026-08-11',
  TimeSlot: '10:00-12:00',
  Status: 'CONFIRMED',
  Address: JSON.stringify({
    CustomerName: 'Test Customer',
    CustomerLabel: 'C001',
    Phone: '0800000000',
    Address: '1 Test Road',
    Location: 'Bangkok',
  }),
  PickupOrderID: null,
  DeliveryOrderID: null,
  Notes: 'Test appointment',
  CreatedAt: '2026-08-11 10:00:00',
  UpdatedAt: '2026-08-11 10:00:00',
  CreatedBy: 'admin',
  UpdatedBy: null,
  ServiceTier: 'STANDARD',
  DeletedAt: null,
  DeletedBy: null,
}

interface Failures {
  append?: unknown
  update?: unknown
}

function makeRoutes(failures: Failures = {}) {
  const repository: SheetRepositoryContract<AppointmentRow> = {
    read: async () => [persistedRow],
    append: async () => {
      if (failures.append !== undefined) throw failures.append
      return persistedRow
    },
    batchAppend: async () => [persistedRow],
    update: async () => {
      if (failures.update !== undefined) throw failures.update
      return persistedRow
    },
    delete: async () => persistedRow,
  }

  const service = new AppointmentService({
    repository,
    fieldMap: appointmentsFieldMap,
    transformer: createAppointmentTransformer(),
    generateAppointmentId: () => persistedRow.AppointmentID,
    now: () => new Date('2026-08-11T03:00:00.000Z'),
  })

  return createCrudRoutes(service, appointmentApiContract)
}

function request(
  method: string,
  body: unknown,
  params: Record<string, string> = {},
): ApiHandlerRequest {
  return { method, query: {}, body, headers: {}, params }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assertCertainty(response: unknown, expected: 'rejected' | 'unknown', name: string): void {
  assert.ok(isRecord(response), `${name}: response is an object`)
  const error = response.error
  assert.ok(isRecord(error), `${name}: error envelope exists`)
  const details = error.details
  assert.ok(isRecord(details), `${name}: error details exist`)
  assert.equal(details.certainty, expected, name)
}

function assertSuccessfulDetail(response: unknown, name: string): void {
  assert.ok(isRecord(response), `${name}: response is an object`)
  assert.equal(response.success, true, `${name}: response is successful`)
  assert.ok(isRecord(response.data), `${name}: response data exists`)
  assert.deepEqual(
    Object.keys(response.data).sort(),
    Object.keys(appointmentDetailResponseSchema.shape).sort(),
    name,
  )
  assert.equal('certainty' in response.data, false, `${name}: success data has no certainty`)
}

async function main(): Promise<void> {
  const rejected = await makeRoutes({
    append: new WriteRejectedError('appendRows', 'Google rejected the appointment write.'),
  }).collection.handleRequest(request('POST', appointmentPayload))
  assert.equal(rejected.status, 500)
  assertCertainty(
    rejected.body,
    'rejected',
    'rejected write response carries certainty=rejected',
  )

  const unknown = await makeRoutes({
    update: new WriteCommittedUnreadableError('updateCells'),
  }).item?.handleRequest(
    request(
      'PATCH',
      { appointmentDate: '2026-08-12', updatedBy: 'admin' },
      { id: persistedRow.AppointmentID },
    ),
  )
  assert.ok(unknown, 'unknown write response exists')
  assert.equal(unknown.status, 500)
  assertCertainty(unknown.body, 'unknown', 'unknown write response carries certainty=unknown')

  const unrecognised = await makeRoutes({ append: new Error('unrecognised write failure') })
    .collection.handleRequest(request('POST', appointmentPayload))
  assert.equal(unrecognised.status, 500)
  assertCertainty(
    unrecognised.body,
    'unknown',
    'unrecognised write response fails safe with certainty=unknown',
  )

  const created = await makeRoutes().collection.handleRequest(request('POST', appointmentPayload))
  assert.equal(created.status, 201)
  assertSuccessfulDetail(created.body, 'successful create response shape is unchanged')

  const updated = await makeRoutes().item?.handleRequest(
    request(
      'PATCH',
      { appointmentDate: '2026-08-12', updatedBy: 'admin' },
      { id: persistedRow.AppointmentID },
    ),
  )
  assert.ok(updated, 'successful update response exists')
  assert.equal(updated.status, 200)
  assertSuccessfulDetail(updated.body, 'successful update response shape is unchanged')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
