import assert from 'node:assert/strict'
import type { RepositoryRequest } from '../../../../../server/shared/repositories/base.repository.js'
import { BaseRepository } from '../../../../../server/shared/repositories/base.repository.js'
import type { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import {
  type AppointmentApiRow,
  type AppointmentCreateInput,
  type AppointmentReadWhere,
  type AppointmentUpdateInput,
  AppointmentService,
  formatBangkokTimestamp,
} from '../../../../../server/modules/appointments/appointment.service.js'
import { appointmentContract } from '../../../../../server/modules/appointments/appointment.contract.js'

class RecordingRepository extends BaseRepository<
  AppointmentApiRow,
  AppointmentReadWhere,
  AppointmentCreateInput,
  AppointmentUpdateInput
> {
  readonly createCalls: Record<string, unknown>[] = []
  readonly updateCalls: Array<{ id: string; data: Record<string, unknown> }> = []
  readonly readCalls: unknown[] = []

  constructor() {
    super({
      fieldMap: appointmentContract.db.fieldMap,
      primaryKey: appointmentContract.db.primaryKey,
    })
  }

  protected async execute<TResponse, TQuery = unknown, TData = unknown>(
    _request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse> {
    throw new Error('RecordingRepository.execute is not used by this test')
  }

  async read(
    query?: ReadQueryDTO<AppointmentReadWhere>,
  ): Promise<Array<Partial<AppointmentApiRow>>> {
    this.readCalls.push(query)
    return [{ appointmentId: 'APPT-existing' }]
  }

  async create(data: AppointmentCreateInput): Promise<AppointmentApiRow> {
    this.createCalls.push(data as Record<string, unknown>)
    return responseRow('APPT-created')
  }

  async update(id: string, data: AppointmentUpdateInput): Promise<AppointmentApiRow> {
    this.updateCalls.push({ id, data: data as Record<string, unknown> })
    return responseRow(id)
  }

  async delete(_id: string): Promise<unknown> {
    throw new Error('RecordingRepository.delete is not used by this test')
  }
}

function responseRow(appointmentId: string): AppointmentApiRow {
  return {
    appointmentId,
    customerId: 'CUST-1',
    appointmentType: 'PICKUP',
    appointmentDate: '2026-04-02',
    timeSlot: '13:00-15:00',
    status: 'CONFIRMED',
    address: null,
    pickupOrderId: null,
    deliveryOrderId: null,
    notes: null,
    createdAt: '2026-04-01 07:34:56',
    updatedAt: null,
    createdBy: null,
    updatedBy: null,
    serviceTier: null,
    deletedAt: null,
    deletedBy: null,
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
      generateAppointmentId: () => 'APPT-generated',
      now: () => fixedNow,
    }),
    repository,
  }
}

const createPayload = {
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

test('create validates once then adds Appointment-owned defaults before persistence', async () => {
  const { service, repository } = createService()

  await service.create({ ...createPayload, appointmentId: 'client-controlled' })

  assert.deepEqual(repository.createCalls, [
    {
      ...createPayload,
      appointmentId: 'APPT-generated',
      status: 'CONFIRMED',
      serviceTier: 'STANDARD',
      createdAt: '2026-04-01 07:34:56',
      updatedAt: '2026-04-01 07:34:56',
    },
  ])
})

test('create ignores a client-supplied service tier because the backend owns it', async () => {
  const { service, repository } = createService()

  await service.create({ ...createPayload, serviceTier: 'PRIORITY' })

  assert.equal(repository.createCalls[0].serviceTier, 'STANDARD')
  assert.equal(repository.createCalls[0].appointmentId, 'APPT-generated')
  assert.equal(repository.createCalls[0].status, 'CONFIRMED')
})

test('update checks that the row exists and adds only UpdatedAt to the validated patch', async () => {
  const { service, repository } = createService()

  await service.update('  APPT-existing  ', { notes: 'โทรก่อน', updatedBy: 'admin' })

  assert.equal(repository.readCalls.length, 1)
  assert.deepEqual(repository.updateCalls, [
    {
      id: 'APPT-existing',
      data: {
        notes: 'โทรก่อน',
        updatedBy: 'admin',
        updatedAt: '2026-04-01 07:34:56',
      },
    },
  ])
})

test('invalid public payload does not reach the repository', async () => {
  const { service, repository } = createService()

  await assert.rejects(() => service.create({ customerId: 'CUST-1' }))

  assert.equal(repository.createCalls.length, 0)
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
