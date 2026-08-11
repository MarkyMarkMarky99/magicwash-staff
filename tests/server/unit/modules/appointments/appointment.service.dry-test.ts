import assert from 'node:assert/strict'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'
import {
  type AppointmentSheetDbRow,
  type AppointmentCreateInput,
  type AppointmentUpdateInput,
  AppointmentService,
} from '../../../../../server/modules/appointments/appointment.service.js'
import { appointmentsFieldMap } from '../../../../../server/modules/appointments/appointment.mapping.js'
import { createAppointmentTransformer } from '../../../../../server/modules/appointments/appointment.transformer.js'
import { formatBangkokTimestamp } from '../../../../../server/shared/utils/bangkok-timestamp.js'

class RecordingRepository implements SheetRepositoryContract<AppointmentSheetDbRow> {
  readonly appendCalls: Record<string, unknown>[] = []
  readonly updateCalls: Array<{ id: string; data: Record<string, unknown> }> = []
  readonly readCalls: unknown[] = []

  async read(
    query?: ReadQueryDTO<Partial<AppointmentSheetDbRow>>,
  ): Promise<Array<Partial<AppointmentSheetDbRow>>> {
    this.readCalls.push(query)
    return [{ AppointmentID: 'APPT-existing' }]
  }

  async append(row: Partial<AppointmentSheetDbRow>): Promise<AppointmentSheetDbRow> {
    this.appendCalls.push(row as Record<string, unknown>)
    return responseRow('APPT-created')
  }

  async batchAppend(_rows: Array<Partial<AppointmentSheetDbRow>>): Promise<AppointmentSheetDbRow[]> {
    throw new Error('RecordingRepository.batchAppend is not used by this test')
  }

  async update(id: string, data: Partial<AppointmentSheetDbRow>): Promise<AppointmentSheetDbRow> {
    this.updateCalls.push({ id, data: data as Record<string, unknown> })
    return responseRow(id)
  }

  async delete(_id: string, _deletedBy: string): Promise<AppointmentSheetDbRow> {
    throw new Error('RecordingRepository.delete is not used by this test')
  }
}

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
  }
}

const fixedNow = new Date('2026-04-01T00:34:56.000Z')

function createService(repository = new RecordingRepository()): {
  service: AppointmentService
  repository: RecordingRepository
} {
  return {
    service: new AppointmentService({
      repository,
      fieldMap: appointmentsFieldMap,
      transformer: createAppointmentTransformer(),
      generateAppointmentId: () => 'APPT-generated',
      now: () => fixedNow,
    }),
    repository,
  }
}

const createPayload: AppointmentCreateInput = {
  customerId: 'CUST-1',
  customerName: 'Somchai',
  customerCode: 'WIX',
  phone: '0812345678',
  address: '12 ถนนสุขุมวิท',
  location: 'Bangkok',
  appointmentType: 'PICKUP',
  appointmentDate: '2026-04-02',
  timeSlot: '13:00-15:00',
  createdBy: 'admin',
}

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []
function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

test('formats a Date in the SheetLib Bangkok timestamp format', () => {
  assert.equal(formatBangkokTimestamp(fixedNow), '2026-04-01 07:34:56')
})

test('create validates once, enriches the command, maps it to DB fields, and packs Address', async () => {
  const { service, repository } = createService()

  await service.create({ ...createPayload, appointmentId: 'client-controlled' })

  assert.deepEqual(repository.appendCalls, [
    {
      AppointmentID: 'APPT-generated',
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
      CreatedBy: 'admin',
      ServiceTier: 'STANDARD',
      CreatedAt: '2026-04-01 07:34:56',
      UpdatedAt: '2026-04-01 07:34:56',
    },
  ])
})

test('create ignores a client-supplied service tier because the backend owns it', async () => {
  const { service, repository } = createService()

  await service.create({ ...createPayload, serviceTier: 'PRIORITY' })

  assert.equal(repository.appendCalls[0].ServiceTier, 'STANDARD')
  assert.equal(repository.appendCalls[0].AppointmentID, 'APPT-generated')
  assert.equal(repository.appendCalls[0].Status, 'CONFIRMED')
})

test('update checks that the row exists, maps the patch, and adds only UpdatedAt', async () => {
  const { service, repository } = createService()

  await service.update('  APPT-existing  ', { notes: 'โทรก่อน', updatedBy: 'admin' })

  assert.equal(repository.readCalls.length, 1)
  assert.deepEqual(repository.updateCalls, [
    {
      id: 'APPT-existing',
      data: {
        Notes: 'โทรก่อน',
        UpdatedBy: 'admin',
        UpdatedAt: '2026-04-01 07:34:56',
      },
    },
  ])
})

test('invalid public payload does not reach the repository', async () => {
  const { service, repository } = createService()

  await assert.rejects(() => service.create({ customerId: 'CUST-1' }))

  assert.equal(repository.appendCalls.length, 0)
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} appointment service dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
