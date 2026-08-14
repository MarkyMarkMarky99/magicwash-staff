import assert from 'node:assert/strict'

import { appointmentsDbContract } from '../../../../../server/sheets/Appointments/Appointments.db-contract.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import {
  buildRowValues,
  parseRowValues,
  resolveRowValueInputOptions,
  resolveValueInputOption,
  serializeCellValue,
} from '../../../../../server/shared/repositories/sheet-value-serializer.js'

type DryTest = { readonly name: string; readonly run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

const appointmentHeaders = [
  'AppointmentID',
  'CustomerID',
  'AppointmentType',
  'AppointmentDate',
  'TimeSlot',
  'Status',
] as const

function mapFor(liveHeaders: readonly unknown[]) {
  return buildSheetHeaderMap(liveHeaders, appointmentHeaders, 'AppointmentID')
}

test('serializes objects and arrays as JSON strings', async () => {
  assert.equal(
    serializeCellValue({ customerId: 'CUS-001', active: true }),
    '{"customerId":"CUS-001","active":true}',
  )
  assert.equal(serializeCellValue(['PICKUP', 'DELIVERY']), '["PICKUP","DELIVERY"]')
})

test('serializes missing values as empty strings and preserves primitives', async () => {
  assert.equal(serializeCellValue(undefined), '')
  assert.equal(serializeCellValue(null), '')
  assert.equal(serializeCellValue('PENDING'), 'PENDING')
  assert.equal(serializeCellValue(3), 3)
  assert.equal(serializeCellValue(false), false)
})

test('rejects unsupported cell values', async () => {
  assert.throws(() => serializeCellValue(new Date('2030-01-01')), TypeError)
  assert.throws(() => serializeCellValue(Number.NaN), TypeError)
  assert.throws(() => serializeCellValue(Symbol('cell')), TypeError)
  assert.throws(() => serializeCellValue(() => 'cell'), TypeError)
})

test('builds full-width row values in live header order and blanks missing keys', async () => {
  const headerMap = mapFor(appointmentHeaders)
  const row = {
    Status: 'PENDING',
    AppointmentDate: '2030-03-01',
    AppointmentID: 'APPT-001',
  }

  const values = buildRowValues(row, headerMap)

  assert.equal(values.length, headerMap.width)
  assert.deepEqual(values, ['APPT-001', '', '', '2030-03-01', '', 'PENDING'])
  assert.equal(values[headerMap.indexByName.AppointmentID], 'APPT-001')
  assert.equal(values[headerMap.indexByName.AppointmentDate], '2030-03-01')
  assert.equal(values[headerMap.indexByName.Status], 'PENDING')
})

test('buildRowValues follows reordered live columns instead of schema key order', async () => {
  const liveHeaders = [
    'AppointmentType',
    'AppointmentID',
    'CustomerID',
    'AppointmentDate',
    'Status',
    'TimeSlot',
  ] as const
  const headerMap = mapFor(liveHeaders)
  const row = {
    AppointmentID: 'APPT-002',
    CustomerID: 'CUS-001',
    AppointmentType: 'PICKUP',
    AppointmentDate: '2030-03-02',
    TimeSlot: '10:00-12:00',
    Status: 'CONFIRMED',
  }

  assert.deepEqual(buildRowValues(row, headerMap), [
    'PICKUP',
    'APPT-002',
    'CUS-001',
    '2030-03-02',
    'CONFIRMED',
    '10:00-12:00',
  ])
})

test('parses a full-width row in live header order', async () => {
  const headerMap = mapFor(appointmentHeaders)

  assert.deepEqual(
    parseRowValues(
      ['APPT-003', 'CUS-001', 'PICKUP', '2030-03-03', '10:00-12:00', 'CONFIRMED'],
      headerMap,
    ),
    {
      AppointmentID: 'APPT-003',
      CustomerID: 'CUS-001',
      AppointmentType: 'PICKUP',
      AppointmentDate: '2030-03-03',
      TimeSlot: '10:00-12:00',
      Status: 'CONFIRMED',
    },
  )
})

test('fills omitted trailing row values with null', async () => {
  const headerMap = mapFor(appointmentHeaders)

  assert.deepEqual(
    parseRowValues(['APPT-004', 'CUS-002'], headerMap),
    {
      AppointmentID: 'APPT-004',
      CustomerID: 'CUS-002',
      AppointmentType: null,
      AppointmentDate: null,
      TimeSlot: null,
      Status: null,
    },
  )
})

test('rejects more row values than the header map width', async () => {
  const headerMap = mapFor(appointmentHeaders)

  assert.throws(
    () => parseRowValues([...appointmentHeaders, 'extra'], headerMap),
    (error: unknown) => {
      assert.ok(error instanceof RangeError)
      assert.match(error.message, /received 7 values.*width 6/i)
      return true
    },
  )
})

test('resolves value input policy defaults and overrides by column', async () => {
  assert.equal(resolveValueInputOption('AppointmentDate', undefined), 'RAW')
  assert.equal(
    resolveValueInputOption('AppointmentDate', { AppointmentDate: 'USER_ENTERED' }),
    'USER_ENTERED',
  )
  assert.equal(resolveValueInputOption('Status', { AppointmentDate: 'USER_ENTERED' }), 'RAW')
})

test('resolves one value input option for every live header', async () => {
  const headerMap = mapFor(appointmentHeaders)

  assert.deepEqual(
    resolveRowValueInputOptions(headerMap, { AppointmentDate: 'USER_ENTERED' }),
    {
      AppointmentID: 'RAW',
      CustomerID: 'RAW',
      AppointmentType: 'RAW',
      AppointmentDate: 'USER_ENTERED',
      TimeSlot: 'RAW',
      Status: 'RAW',
    },
  )
})

test('uses the Appointments contract date policy for audit timestamps', async () => {
  assert.equal(
    resolveValueInputOption('AppointmentDate', appointmentsDbContract.valueInput),
    'USER_ENTERED',
  )
  assert.equal(resolveValueInputOption('CreatedAt', appointmentsDbContract.valueInput), 'USER_ENTERED')
  assert.equal(resolveValueInputOption('UpdatedAt', appointmentsDbContract.valueInput), 'USER_ENTERED')
  assert.equal(resolveValueInputOption('DeletedAt', appointmentsDbContract.valueInput), 'USER_ENTERED')
})

const orderedTests = process.env.REVERSE_TESTS === '1' ? [...tests].reverse() : tests
let failures = 0

for (const currentTest of orderedTests) {
  try {
    await currentTest.run()
    console.log(`ok - ${currentTest.name}`)
  } catch (error: unknown) {
    failures += 1
    console.error(`not ok - ${currentTest.name}`)
    console.error(error)
  }
}

if (failures !== 0) {
  throw new Error(`${failures} dry-test(s) failed.`)
}

console.log(`passed - ${orderedTests.length} value-serialization dry-tests`)
