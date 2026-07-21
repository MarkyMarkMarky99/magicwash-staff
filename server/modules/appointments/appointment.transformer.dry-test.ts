import assert from 'node:assert/strict'
import {
  type AppointmentCreateTransformerData,
  buildCustomerSnapshot,
  flattenAddressSnapshot,
  transformAppointmentRequest,
  transformAppointmentResponse,
  transformResponseRow,
} from './appointment.transformer'
import { Mapper } from '../../shared/repositories/base.repository'
import { appointmentFieldMap } from './appointment.contract'

const realAddressSnapshot =
  '{"CustomerName": "", "CustomerLabel": "WIX", "Phone": "", "Address": "123 ถ.สุขุมวิท ซ.15", "Location": "123 ถ.สุขุมวิท ซ.15", "Facebook": "", "Line": "", "Whatsapp": "", "Email": ""}'

const sampleDbRow = {
  AppointmentID: 'APPT-5635eee8',
  CustomerID: 'a1b2c3d4',
  AppointmentType: 'PICKUP',
  AppointmentDate: '1 Apr 2026',
  TimeSlot: '13:00-15:00',
  Status: 'CONFIRMED',
  Address: realAddressSnapshot,
  PickupOrderID: null,
  DeliveryOrderID: null,
  Notes: null,
  CreatedAt: '27/03/2026 04:37:32',
  UpdatedAt: '31/03/2026 01:47:04',
  CreatedBy: 'admin',
  UpdatedBy: null,
  ServiceTier: null,
  DeletedAt: null,
  DeletedBy: null,
}

const sampleCreateData: AppointmentCreateTransformerData = {
  CustomerID: 'a1b2c3d4',
  customerName: 'Somchai',
  customerCode: 'WIX',
  phone: '0812345678',
  Address: '123 ถ.สุขุมวิท ซ.15',
  location: '123 ถ.สุขุมวิท ซ.15',
  AppointmentType: 'PICKUP',
  AppointmentDate: '2026-04-01',
  TimeSlot: '13:00-15:00',
  PickupOrderID: null,
  DeliveryOrderID: null,
  Notes: 'ฝากโทรก่อน',
  CreatedBy: 'admin',
  ServiceTier: 'STANDARD',
}

const sampleApiCreatePayload = {
  customerId: 'a1b2c3d4',
  customerName: 'Somchai',
  customerCode: 'WIX',
  phone: '0812345678',
  address: '123 ถ.สุขุมวิท ซ.15',
  location: '123 ถ.สุขุมวิท ซ.15',
  appointmentType: 'PICKUP',
  appointmentDate: '2026-04-01',
  timeSlot: '13:00-15:00',
  pickupOrderId: null,
  deliveryOrderId: null,
  notes: 'ฝากโทรก่อน',
  createdBy: 'admin',
  serviceTier: 'STANDARD',
}

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

// ── transformAppointmentRequest ─────────────────────────────────────────────

test('buildCustomerSnapshot packs flat create fields into the Address JSON shape', () => {
  assert.deepEqual(buildCustomerSnapshot(sampleCreateData), {
    CustomerName: 'Somchai',
    CustomerLabel: 'WIX',
    Phone: '0812345678',
    Address: '123 ถ.สุขุมวิท ซ.15',
    Location: '123 ถ.สุขุมวิท ซ.15',
    Facebook: '',
    Line: '',
    Whatsapp: '',
    Email: '',
  })
})

test('transformAppointmentRequest packs create flat customer fields into Address JSON', async () => {
  const transformed = await transformAppointmentRequest({
    operation: 'create',
    data: sampleCreateData,
  })

  assert.equal(transformed.operation, 'create')
  assert.deepEqual(transformed.query, undefined)

  const data = transformed.data as Record<string, unknown>
  assert.deepEqual(
    {
      ...data,
      Address: JSON.parse(data.Address as string),
    },
    {
      CustomerID: 'a1b2c3d4',
      AppointmentType: 'PICKUP',
      AppointmentDate: '2026-04-01',
      TimeSlot: '13:00-15:00',
      PickupOrderID: null,
      DeliveryOrderID: null,
      Notes: 'ฝากโทรก่อน',
      CreatedBy: 'admin',
      ServiceTier: 'STANDARD',
      Address: {
        CustomerName: 'Somchai',
        CustomerLabel: 'WIX',
        Phone: '0812345678',
        Address: '123 ถ.สุขุมวิท ซ.15',
        Location: '123 ถ.สุขุมวิท ซ.15',
        Facebook: '',
        Line: '',
        Whatsapp: '',
        Email: '',
      },
    },
  )
  assert.equal('customerName' in data, false)
  assert.equal('customerCode' in data, false)
  assert.equal('phone' in data, false)
  assert.equal('location' in data, false)
})

test('transformAppointmentRequest does not mutate create request data', async () => {
  const request = {
    operation: 'create' as const,
    data: { ...sampleCreateData },
  }
  const before = { ...request.data }

  await transformAppointmentRequest(request)

  assert.deepEqual(request.data, before)
})

test('transformAppointmentRequest packs payload after real mapper.toDb conversion', async () => {
  const mapper = new Mapper(appointmentFieldMap)
  const transformed = await transformAppointmentRequest({
    operation: 'create',
    data: mapper.toDb(sampleApiCreatePayload),
  })

  const data = transformed.data as Record<string, unknown>
  assert.deepEqual(
    {
      ...data,
      Address: JSON.parse(data.Address as string),
    },
    {
      CustomerID: 'a1b2c3d4',
      AppointmentType: 'PICKUP',
      AppointmentDate: '2026-04-01',
      TimeSlot: '13:00-15:00',
      PickupOrderID: null,
      DeliveryOrderID: null,
      Notes: 'ฝากโทรก่อน',
      CreatedBy: 'admin',
      ServiceTier: 'STANDARD',
      Address: {
        CustomerName: 'Somchai',
        CustomerLabel: 'WIX',
        Phone: '0812345678',
        Address: '123 ถ.สุขุมวิท ซ.15',
        Location: '123 ถ.สุขุมวิท ซ.15',
        Facebook: '',
        Line: '',
        Whatsapp: '',
        Email: '',
      },
    },
  )
})

test('transformAppointmentRequest leaves non-create requests unchanged', async () => {
  const request = {
    operation: 'update' as const,
    query: { where: { AppointmentID: 'APPT-1' } },
    data: {
      Notes: 'keep me',
      UpdatedBy: 'admin',
    },
  }

  assert.strictEqual(await transformAppointmentRequest(request), request)
})

test('transformAppointmentRequest rejects create requests without a data object', async () => {
  await assert.rejects(
    () => transformAppointmentRequest({ operation: 'create' }),
    /Appointment create requires data object/,
  )
})

test('transformAppointmentRequest rejects missing required snapshot fields', async () => {
  const { customerCode: _customerCode, ...data } = sampleCreateData

  await assert.rejects(
    () => transformAppointmentRequest({ operation: 'create', data }),
    /Appointment create requires customerCode/,
  )
})

// ── flattenAddressSnapshot ──────────────────────────────────────────────────

test('flattenAddressSnapshot parses the real Address JSON snapshot', () => {
  assert.deepEqual(flattenAddressSnapshot(realAddressSnapshot), {
    Address: '123 ถ.สุขุมวิท ซ.15',
    customerName: null,
    customerCode: 'WIX',
    phone: null,
    location: '123 ถ.สุขุมวิท ซ.15',
  })
})

test('flattenAddressSnapshot maps snapshot keys to flat response fields', () => {
  const snapshot = JSON.stringify({
    CustomerName: 'Somchai',
    CustomerLabel: 'VIP-001',
    Phone: '0812345678',
    Address: '12 Sukhumvit',
    Location: 'https://maps.example/place',
  })

  assert.deepEqual(flattenAddressSnapshot(snapshot), {
    Address: '12 Sukhumvit',
    customerName: 'Somchai',
    customerCode: 'VIP-001',
    phone: '0812345678',
    location: 'https://maps.example/place',
  })
})

test('flattenAddressSnapshot normalizes null and empty Address snapshots', () => {
  const expected = {
    Address: null,
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  }

  assert.deepEqual(flattenAddressSnapshot(null), expected)
  assert.deepEqual(flattenAddressSnapshot(''), expected)
  assert.deepEqual(flattenAddressSnapshot('   '), expected)
})

test('flattenAddressSnapshot falls back to legacy plain Address strings for invalid or non-object JSON', () => {
  const expected = {
    Address: '{bad json',
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  }

  assert.deepEqual(flattenAddressSnapshot('{bad json'), expected)
  assert.deepEqual(flattenAddressSnapshot('[]'), { ...expected, Address: '[]' })
  assert.deepEqual(flattenAddressSnapshot('"plain string"'), {
    ...expected,
    Address: '"plain string"',
  })
  assert.deepEqual(flattenAddressSnapshot('123'), { ...expected, Address: '123' })
})

test('flattenAddressSnapshot treats legacy plain Address strings as address only', () => {
  assert.deepEqual(flattenAddressSnapshot('  123 ถ.สุขุมวิท ซ.15  '), {
    Address: '123 ถ.สุขุมวิท ซ.15',
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  })
})

test('flattenAddressSnapshot normalizes missing empty and non-string snapshot fields', () => {
  const snapshot = JSON.stringify({
    CustomerName: '   ',
    CustomerLabel: 123,
    Phone: null,
    Address: '  12 Sukhumvit  ',
  })

  assert.deepEqual(flattenAddressSnapshot(snapshot), {
    Address: '12 Sukhumvit',
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  })
})

test('flattenAddressSnapshot resolves address and location independently', () => {
  const snapshot = JSON.stringify({
    Location: '  https://maps.example/place  ',
  })

  assert.deepEqual(flattenAddressSnapshot(snapshot), {
    Address: null,
    customerName: null,
    customerCode: null,
    phone: null,
    location: 'https://maps.example/place',
  })
})

test('flattenAddressSnapshot normalizes location whitespace and non-string values', () => {
  assert.deepEqual(
    flattenAddressSnapshot(JSON.stringify({ Address: 'A', Location: '   ' })),
    {
      Address: 'A',
      customerName: null,
      customerCode: null,
      phone: null,
      location: null,
    },
  )

  assert.deepEqual(
    flattenAddressSnapshot(JSON.stringify({ Address: 'A', Location: 123 })),
    {
      Address: 'A',
      customerName: null,
      customerCode: null,
      phone: null,
      location: null,
    },
  )
})

test('flattenAddressSnapshot normalizes undefined snapshots', () => {
  assert.deepEqual(flattenAddressSnapshot(undefined), {
    Address: null,
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  })
})

// ── transformResponseRow ────────────────────────────────────────────────────

test('transformResponseRow flattens Address and preserves appointment DB fields', () => {
  assert.deepEqual(transformResponseRow(sampleDbRow), {
    ...sampleDbRow,
    Address: '123 ถ.สุขุมวิท ซ.15',
    customerName: null,
    customerCode: 'WIX',
    phone: null,
    location: '123 ถ.สุขุมวิท ซ.15',
  })
})

test('transformResponseRow handles rows without Address without emitting undefined fields', () => {
  const { Address: _Address, ...rowWithoutAddress } = sampleDbRow

  assert.deepEqual(transformResponseRow(rowWithoutAddress), {
    ...rowWithoutAddress,
    Address: null,
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  })
})

test('transformResponseRow falls back to raw Address text and preserves the raw row', () => {
  const row = { ...sampleDbRow, Address: '{bad json', Notes: 'keep me' }

  assert.deepEqual(transformResponseRow(row), {
    ...row,
    Address: '{bad json',
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  })
})

test('transformResponseRow does not mutate the input row', () => {
  const row = { ...sampleDbRow }
  const before = { ...row }

  transformResponseRow(row)

  assert.deepEqual(row, before)
})

// ── transformAppointmentResponse ────────────────────────────────────────────

test('transformAppointmentResponse preserves empty read arrays', () => {
  assert.deepEqual(transformAppointmentResponse([]), [])
})

test('transformAppointmentResponse transforms read array responses row by row', () => {
  assert.deepEqual(transformAppointmentResponse([sampleDbRow]), [
    {
      ...sampleDbRow,
      Address: '123 ถ.สุขุมวิท ซ.15',
      customerName: null,
      customerCode: 'WIX',
      phone: null,
      location: '123 ถ.สุขุมวิท ซ.15',
    },
  ])
})

test('transformAppointmentResponse transforms multi-row arrays independently', () => {
  const invalidRow = {
    ...sampleDbRow,
    AppointmentID: 'APPT-invalid',
    Address: '{bad json',
  }

  assert.deepEqual(transformAppointmentResponse([sampleDbRow, invalidRow]), [
    {
      ...sampleDbRow,
      Address: '123 ถ.สุขุมวิท ซ.15',
      customerName: null,
      customerCode: 'WIX',
      phone: null,
      location: '123 ถ.สุขุมวิท ซ.15',
    },
    {
      ...invalidRow,
      Address: '{bad json',
      customerName: null,
      customerCode: null,
      phone: null,
      location: null,
    },
  ])
})

test('transformAppointmentResponse transforms create update and detail object responses', () => {
  assert.deepEqual(transformAppointmentResponse(sampleDbRow), {
    ...sampleDbRow,
    Address: '123 ถ.สุขุมวิท ซ.15',
    customerName: null,
    customerCode: 'WIX',
    phone: null,
    location: '123 ถ.สุขุมวิท ซ.15',
  })
})

test('transformAppointmentResponse leaves primitive and null responses unchanged', () => {
  assert.equal(transformAppointmentResponse(null), null)
  assert.equal(transformAppointmentResponse(undefined), undefined)
  assert.equal(transformAppointmentResponse('unexpected'), 'unexpected')
  assert.equal(transformAppointmentResponse(123), 123)
})

test('transformed response maps cleanly through repository mapper to API fields', () => {
  const mapper = new Mapper(appointmentFieldMap)
  const transformed = transformResponseRow(sampleDbRow)

  assert.deepEqual(mapper.toApi(transformed), {
    appointmentId: 'APPT-5635eee8',
    customerId: 'a1b2c3d4',
    appointmentType: 'PICKUP',
    appointmentDate: '1 Apr 2026',
    timeSlot: '13:00-15:00',
    status: 'CONFIRMED',
    address: '123 ถ.สุขุมวิท ซ.15',
    pickupOrderId: null,
    deliveryOrderId: null,
    notes: null,
    createdAt: '27/03/2026 04:37:32',
    updatedAt: '31/03/2026 01:47:04',
    createdBy: 'admin',
    updatedBy: null,
    serviceTier: null,
    deletedAt: null,
    deletedBy: null,
    customerName: null,
    customerCode: 'WIX',
    phone: null,
    location: '123 ถ.สุขุมวิท ซ.15',
  })
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} appointment transformer dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
