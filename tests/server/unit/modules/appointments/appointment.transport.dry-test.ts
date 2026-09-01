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
import {
  appointmentCreateFixtures,
  appointmentUpdateFixtures,
  type AppointmentCreateWriteFixture,
  type AppointmentUpdateWriteFixture,
} from './appointment-write.fixtures.js'

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
    sheetsApiClientOptions: {
      accessTokenProvider: async () => 'test-access-token',
    },
    now: () => now,
  })

  return new AppointmentService({
    repository,
    fieldMap: appointmentsFieldMap,
    transformer: createAppointmentTransformer(),
    generateAppointmentId: () => id,
  })
}

function postBody(call: FetchCall): unknown {
  assert.equal(call.init?.method, 'POST')
  return JSON.parse(call.init?.body as string)
}

function apiPath(call: FetchCall): string {
  return decodeURIComponent(new URL(call.url).pathname)
}

const appointmentHeaders = Object.keys(appointmentsRowSchema.shape)

function assertAppendRequest(
  call: FetchCall,
  fixture: AppointmentCreateWriteFixture,
): void {
  const url = new URL(call.url)
  assert.equal(apiPath(call), '/v4/spreadsheets/appointment-spreadsheet-id/values/Appointments!A:A:append')
  assert.equal(url.searchParams.get('valueInputOption'), 'USER_ENTERED')
  assert.equal(url.searchParams.getAll('valueInputOption').length, 1)
  assert.equal(url.searchParams.get('insertDataOption'), 'INSERT_ROWS')
  assert.equal(url.searchParams.get('includeValuesInResponse'), 'true')
  assert.equal(url.searchParams.get('responseValueRenderOption'), 'UNFORMATTED_VALUE')

  const body = postBody(call) as { majorDimension: string; values: readonly (readonly unknown[])[] }

  const addressCell = body.values[0]?.[6]
  assert.equal(typeof addressCell, 'string')
  assert.deepEqual(JSON.parse(addressCell as string), fixture.expectedAddressSnapshot)

  assert.deepEqual(body, {
    majorDimension: 'ROWS',
    values: [fixture.expectedRow],
  })
  assert.equal(body.values.length, 1)
  assert.equal(body.values[0]?.length, appointmentHeaders.length)
}

async function assertCreateTransport(
  fixture: AppointmentCreateWriteFixture,
  id: string,
  now: Date,
): Promise<void> {
  await withMockFetch(
    async (url, init) => {
      const path = decodeURIComponent(new URL(url).pathname)
      if (init?.method === 'GET' && path.endsWith('/values/Appointments!1:1')) {
        return response({ json: { values: [appointmentHeaders] } })
      }
      if (init?.method === 'GET' && path.endsWith('/values/Appointments!A:A')) {
        return response({ json: { values: [['AppointmentID']] } })
      }
      if (init?.method === 'POST' && path.endsWith('/values/Appointments!A:A:append')) {
        return response({
          json: {
            ...fixture.sheetsApiResponse,
            updates: { ...fixture.sheetsApiResponse.updates, updatedRange: 'Appointments!A2:Q2' },
          },
        })
      }
      throw new Error(`Unexpected Sheets API request: ${init?.method} ${path}`)
    },
    async (calls) => {
      const service = createService(id, now)
      await service.create(fixture.frontendRequest)

      assert.equal(calls.length, 2)
      assert.equal(apiPath(calls[0]), '/v4/spreadsheets/appointment-spreadsheet-id/values/Appointments!1:1')
      assertAppendRequest(calls[1], fixture)
    },
  )
}

test('create pickup sends one full-width Sheets API APPEND row', async () => {
  await assertCreateTransport(
    appointmentCreateFixtures[0],
    'APPT-a1b2c3d4',
    new Date('2026-04-01T02:15:00.000Z'),
  )
})

test('create delivery sends one full-width Sheets API APPEND row', async () => {
  await assertCreateTransport(
    appointmentCreateFixtures[1],
    'APPT-e5f6a7b8',
    new Date('2026-04-01T02:20:00.000Z'),
  )
})

function gvizAppointmentRow(id: string): string {
  return gvizBody({
    cols: [{ id: 'A' }],
    rows: [{ c: [{ v: id }] }],
  })
}

async function assertUpdateTransport(
  fixture: AppointmentUpdateWriteFixture,
  now: Date,
): Promise<void> {
  await withMockFetch(
    async (url, init) => {
      if (url.includes('/gviz/tq')) {
        return response({ text: gvizAppointmentRow(fixture.keyValue) })
      }

      const path = decodeURIComponent(new URL(url).pathname)
      if (init?.method === 'GET' && path.endsWith('/values/Appointments!1:1')) {
        return response({ json: { values: [appointmentHeaders] } })
      }
      if (init?.method === 'GET' && path.endsWith('/values/Appointments!A:A')) {
        return response({
          json: {
            values: Array.from({ length: fixture.rowNumber }, (_unused, index) =>
              index === 0
                ? ['AppointmentID']
                : index === fixture.rowNumber - 1
                  ? [fixture.keyValue]
                  : [null],
            ),
          },
        })
      }
      if (init?.method === 'POST' && path.endsWith('/values:batchUpdate')) {
        const request = JSON.parse(String(init.body)) as { data?: unknown[] }
        return response({
          json: {
            spreadsheetId: 'appointment-spreadsheet-id',
            responses: Array.isArray(request.data) ? request.data.map(() => ({})) : [],
          },
        })
      }
      if (init?.method === 'GET' && path.endsWith(
        `/values/Appointments!A${fixture.rowNumber}:Q${fixture.rowNumber}`,
      )) {
        return response({ json: { values: [fixture.readBackRow] } })
      }

      throw new Error(`Unexpected Sheets API request: ${init?.method} ${path}`)
    },
    async (calls) => {
      const service = createService('unused', now)
      await service.update(fixture.keyValue, fixture.frontendRequest)

      assert.equal(calls.length, 5)
      assert.ok(calls[0].url.includes('/gviz/tq'))
      assert.deepEqual(calls.slice(1).map(apiPath), [
        '/v4/spreadsheets/appointment-spreadsheet-id/values/Appointments!1:1',
        '/v4/spreadsheets/appointment-spreadsheet-id/values/Appointments!A:A',
        '/v4/spreadsheets/appointment-spreadsheet-id/values:batchUpdate',
        `/v4/spreadsheets/appointment-spreadsheet-id/values/Appointments!A${fixture.rowNumber}:Q${fixture.rowNumber}`,
      ])
      assert.deepEqual(postBody(calls[3]), {
        valueInputOption: 'USER_ENTERED',
        data: fixture.expectedUpdateData,
      })
    },
  )
}

test('update notes sends route AppointmentID as key_value and only the changed patch', async () => {
  await assertUpdateTransport(appointmentUpdateFixtures[0], new Date('2026-04-01T03:05:00.000Z'))
})

test('update status sends route AppointmentID as key_value and only the changed patch', async () => {
  await assertUpdateTransport(appointmentUpdateFixtures[1], new Date('2026-04-01T03:10:00.000Z'))
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
