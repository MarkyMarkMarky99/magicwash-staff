import assert from 'node:assert/strict'
import type { z } from 'zod'
import { AppointmentService } from '../../../../../server/modules/appointments/appointment.service.js'
import { createAppointmentTransformer } from '../../../../../server/modules/appointments/appointment.transformer.js'
import {
  appointmentsDbContract,
  appointmentsRowSchema,
} from '../../../../../server/sheets/Appointments/Appointments.db-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { appointmentsFieldMap } from '../../../../../server/modules/appointments/appointment.mapping.js'
import { appointmentWriteFixtures } from './appointment-write.fixtures.js'

process.env.APPOINTMENTS_SPREADSHEET_ID = 'appointment-spreadsheet-id'
process.env.TEST_APPOINTMENTS_SCRIPT_URL = 'https://script.example/exec'

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function response(input: { text?: string; json?: unknown }): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => input.text ?? '',
    json: async () => input.json,
  } as Response
}

function gvizBody(table: unknown): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table,
  })});`
}

async function withMockFetch<T>(
  handler: FetchHandler,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string | { url?: string }, init?: RequestInit) => {
    const stringUrl = String(url)
    calls.push({ url: stringUrl, init })
    return handler(stringUrl, init)
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function createService(id: string, now: Date): AppointmentService {
  const repository = new SheetRepository<z.infer<typeof appointmentsRowSchema>>({
    contract: appointmentsDbContract,
    scriptUrl: 'TEST_APPOINTMENTS_SCRIPT_URL',
  })

  return new AppointmentService({
    repository,
    fieldMap: appointmentsFieldMap,
    transformer: createAppointmentTransformer(),
    generateAppointmentId: () => id,
    now: () => now,
  })
}

function postBody(call: FetchCall): unknown {
  assert.equal(call.init?.method, 'POST')
  return JSON.parse(call.init?.body as string)
}

const [createPickup, createDelivery, updateNotes, updateStatus] = appointmentWriteFixtures

test('create pickup sends the enriched and serialized SheetLib APPEND payload', async () => {
  const service = createService('APPT-a1b2c3d4', new Date('2026-04-01T02:15:00.000Z'))

  await withMockFetch(
    async () => response({ json: createPickup.appScriptResponse }),
    async (calls) => {
      await service.create(createPickup.frontendRequest)

      assert.equal(calls.length, 1)
      assert.deepEqual(postBody(calls[0]), createPickup.appScriptRequest)
    },
  )
})

test('create delivery sends the enriched and serialized SheetLib APPEND payload', async () => {
  const service = createService('APPT-e5f6a7b8', new Date('2026-04-01T02:20:00.000Z'))

  await withMockFetch(
    async () => response({ json: createDelivery.appScriptResponse }),
    async (calls) => {
      await service.create(createDelivery.frontendRequest)

      assert.equal(calls.length, 1)
      assert.deepEqual(postBody(calls[0]), createDelivery.appScriptRequest)
    },
  )
})

function gvizAppointmentRow(id: string): string {
  return gvizBody({
    cols: [{ id: 'A' }],
    rows: [{ c: [{ v: id }] }],
  })
}

async function assertUpdateTransport(
  fixture: (typeof appointmentWriteFixtures)[number],
  now: Date,
): Promise<void> {
  const keyValue = fixture.appScriptRequest.key_value
  if (keyValue === undefined) {
    throw new Error(`${fixture.name} must define an UPDATE key_value`)
  }
  const service = createService('unused', now)

  await withMockFetch(
    async (url) =>
      url.includes('/gviz/tq')
        ? response({ text: gvizAppointmentRow(keyValue) })
        : response({ json: fixture.appScriptResponse }),
    async (calls) => {
      await service.update(keyValue, fixture.frontendRequest)

      assert.equal(calls.length, 2)
      assert.ok(calls[0].url.includes('/gviz/tq'))
      assert.deepEqual(postBody(calls[1]), fixture.appScriptRequest)
    },
  )
}

test('update notes sends route AppointmentID as key_value and only the changed patch', async () => {
  await assertUpdateTransport(updateNotes, new Date('2026-04-01T03:05:00.000Z'))
})

test('update status sends route AppointmentID as key_value and only the changed patch', async () => {
  await assertUpdateTransport(updateStatus, new Date('2026-04-01T03:10:00.000Z'))
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} appointment transport dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
