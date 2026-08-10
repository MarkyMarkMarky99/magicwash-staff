import type { z } from 'zod'
import type {
  SheetsApiAppendResponse,
  SheetsApiValue,
  SheetsApiValueRange,
} from '../../../../../server/shared/repositories/sheets-api.client.js'
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
} from '../../../../../contracts/appointments/appointment-api.schema.js'

type AppointmentCreateRequest = z.input<typeof appointmentCreateSchema>
type AppointmentUpdateRequest = z.input<typeof appointmentUpdateSchema>

export interface AppointmentCreateWriteFixture {
  name: string
  frontendRequest: AppointmentFrontendRequest
  expectedRow: readonly SheetsApiValue[]
  expectedAddressSnapshot: Readonly<Record<string, string>>
  sheetsApiResponse: SheetsApiAppendResponse
}

export interface AppointmentUpdateWriteFixture {
  name: string
  frontendRequest: AppointmentUpdateRequest
  keyValue: string
  rowNumber: number
  expectedUpdateData: readonly SheetsApiValueRange[]
  readBackRow: readonly SheetsApiValue[]
}

type AppointmentFrontendRequest = AppointmentCreateRequest

const pickupAddressSnapshot = {
  CustomerName: 'สมชาย ใจดี',
  CustomerLabel: 'CUST-1001',
  Phone: '0812345678',
  Address: '12 ถนนสุขุมวิท  เขตวัฒนา กรุงเทพฯ 10110',
  Location: 'https://maps.example/pickup-1001',
} as const

const pickupAddress = JSON.stringify(pickupAddressSnapshot)

const deliveryAddressSnapshot = {
  CustomerName: 'สุดา รุ่งเรือง',
  CustomerLabel: 'CUST-1002',
  Phone: '0898765432',
  Address: '99 ถนนรัชดาภิเษก เขตดินแดง กรุงเทพฯ 10400',
  Location: 'https://maps.example/delivery-1002',
} as const

const deliveryAddress = JSON.stringify(deliveryAddressSnapshot)

export const appointmentCreateFixtures: AppointmentCreateWriteFixture[] = [
  {
    name: 'create pickup appointment',
    frontendRequest: {
      customerId: 'CUST-1001',
      customerName: 'สมชาย ใจดี',
      customerCode: 'CUST-1001',
      phone: '0812345678',
      address: '12 ถนนสุขุมวิท  เขตวัฒนา กรุงเทพฯ 10110',
      location: 'https://maps.example/pickup-1001',
      appointmentType: 'PICKUP',
      appointmentDate: '2026-04-02',
      timeSlot: '10:00-12:00',
      pickupOrderId: null,
      deliveryOrderId: null,
      notes: 'โทรก่อนเข้ารับ 15 นาที',
      createdBy: 'admin@magicwash',
    },
    expectedRow: [
      'APPT-a1b2c3d4',
      'CUST-1001',
      'PICKUP',
      '2026-04-02',
      '10:00-12:00',
      'CONFIRMED',
      pickupAddress,
      '',
      '',
      'โทรก่อนเข้ารับ 15 นาที',
      '2026-04-01 09:15:00',
      '2026-04-01 09:15:00',
      'admin@magicwash',
      '',
      'STANDARD',
      '',
      '',
    ],
    expectedAddressSnapshot: pickupAddressSnapshot,
    sheetsApiResponse: {
      spreadsheetId: 'appointment-spreadsheet-id',
      updates: {
        updatedRows: 1,
        updatedData: {
          values: [[
            'APPT-a1b2c3d4',
            'CUST-1001',
            'PICKUP',
            '2026-04-02',
            '10:00-12:00',
            'CONFIRMED',
            pickupAddress,
            '',
            '',
            'โทรก่อนเข้ารับ 15 นาที',
            '2026-04-01 09:15:00',
            '2026-04-01 09:15:00',
            'admin@magicwash',
            '',
            'STANDARD',
            '',
            '',
          ]],
        },
      },
    },
  },
  {
    name: 'create delivery appointment',
    frontendRequest: {
      customerId: 'CUST-1002',
      customerName: 'สุดา รุ่งเรือง',
      customerCode: 'CUST-1002',
      phone: '0898765432',
      address: '99 ถนนรัชดาภิเษก เขตดินแดง กรุงเทพฯ 10400',
      location: 'https://maps.example/delivery-1002',
      appointmentType: 'DELIVERY',
      appointmentDate: '2026-04-03',
      timeSlot: '15:00-17:00',
      pickupOrderId: 'PO-20260403-001',
      deliveryOrderId: null,
      notes: null,
      createdBy: 'admin@magicwash',
    },
    expectedRow: [
      'APPT-e5f6a7b8',
      'CUST-1002',
      'DELIVERY',
      '2026-04-03',
      '15:00-17:00',
      'CONFIRMED',
      deliveryAddress,
      'PO-20260403-001',
      '',
      '',
      '2026-04-01 09:20:00',
      '2026-04-01 09:20:00',
      'admin@magicwash',
      '',
      'STANDARD',
      '',
      '',
    ],
    expectedAddressSnapshot: deliveryAddressSnapshot,
    sheetsApiResponse: {
      spreadsheetId: 'appointment-spreadsheet-id',
      updates: {
        updatedRows: 1,
        updatedData: {
          values: [[
            'APPT-e5f6a7b8',
            'CUST-1002',
            'DELIVERY',
            '2026-04-03',
            '15:00-17:00',
            'CONFIRMED',
            deliveryAddress,
            'PO-20260403-001',
            '',
            '',
            '2026-04-01 09:20:00',
            '2026-04-01 09:20:00',
            'admin@magicwash',
            '',
            'STANDARD',
            '',
            '',
          ]],
        },
      },
    },
  },
]

export const appointmentUpdateFixtures: AppointmentUpdateWriteFixture[] = [
  {
    name: 'update appointment notes',
    frontendRequest: {
      notes: 'เลื่อนเป็นช่วงบ่าย กรุณาโทรยืนยัน',
      updatedBy: 'dispatcher@magicwash',
    },
    keyValue: 'APPT-a1b2c3d4',
    rowNumber: 2,
    expectedUpdateData: [
      { range: 'Appointments!J2:J2', values: [['เลื่อนเป็นช่วงบ่าย กรุณาโทรยืนยัน']] },
      { range: 'Appointments!N2:N2', values: [['dispatcher@magicwash']] },
      { range: 'Appointments!L2:L2', values: [['2026-04-01 10:05:00']] },
    ],
    readBackRow: [
      'APPT-a1b2c3d4',
      'CUST-1001',
      'PICKUP',
      '2026-04-02',
      '10:00-12:00',
      'CONFIRMED',
      pickupAddress,
      '',
      '',
      'เลื่อนเป็นช่วงบ่าย กรุณาโทรยืนยัน',
      '2026-04-01 09:15:00',
      '2026-04-01 10:05:00',
      'admin@magicwash',
      'dispatcher@magicwash',
      'STANDARD',
      '',
      '',
    ],
  },
  {
    name: 'update appointment status',
    frontendRequest: {
      status: 'IN_TRANSIT',
      updatedBy: 'driver@magicwash',
    },
    keyValue: 'APPT-e5f6a7b8',
    rowNumber: 3,
    expectedUpdateData: [
      { range: 'Appointments!F3:F3', values: [['IN_TRANSIT']] },
      { range: 'Appointments!N3:N3', values: [['driver@magicwash']] },
      { range: 'Appointments!L3:L3', values: [['2026-04-01 10:10:00']] },
    ],
    readBackRow: [
      'APPT-e5f6a7b8',
      'CUST-1002',
      'DELIVERY',
      '2026-04-03',
      '15:00-17:00',
      'IN_TRANSIT',
      deliveryAddress,
      'PO-20260403-001',
      '',
      '',
      '2026-04-01 09:20:00',
      '2026-04-01 10:10:00',
      'admin@magicwash',
      'driver@magicwash',
      'STANDARD',
      '',
      '',
    ],
  },
]
