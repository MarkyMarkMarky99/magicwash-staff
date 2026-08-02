import type { z } from 'zod'
import type {
  SheetLibRequest,
  SheetLibSuccessResponse,
} from '../../../../../server/shared/repositories/gsheet.repository.js'
import { appointmentContract } from '../../../../../server/modules/appointments/appointment.contract.js'

type AppointmentCreateRequest = z.input<typeof appointmentContract.api.request.create>
type AppointmentUpdateRequest = z.input<typeof appointmentContract.api.request.update>
type AppointmentFrontendRequest = AppointmentCreateRequest | AppointmentUpdateRequest
type AppointmentSheetRow = Record<string, unknown>

export interface AppointmentWriteFixture {
  name: string
  frontendRequest: AppointmentFrontendRequest
  appScriptRequest: SheetLibRequest<AppointmentSheetRow>
  appScriptResponse: SheetLibSuccessResponse<AppointmentSheetRow>
}

const pickupAddress = JSON.stringify({
  CustomerName: 'สมชาย ใจดี',
  CustomerLabel: 'CUST-1001',
  Phone: '0812345678',
  Address: '12 ถนนสุขุมวิท  เขตวัฒนา กรุงเทพฯ 10110',
  Location: 'https://maps.example/pickup-1001',
})

const deliveryAddress = JSON.stringify({
  CustomerName: 'สุดา รุ่งเรือง',
  CustomerLabel: 'CUST-1002',
  Phone: '0898765432',
  Address: '99 ถนนรัชดาภิเษก เขตดินแดง กรุงเทพฯ 10400',
  Location: 'https://maps.example/delivery-1002',
})

const pickupRow: AppointmentSheetRow = {
  AppointmentID: 'APPT-a1b2c3d4',
  CustomerID: 'CUST-1001',
  AppointmentType: 'PICKUP',
  AppointmentDate: '2026-04-02',
  TimeSlot: '10:00-12:00',
  Status: 'CONFIRMED',
  Address: pickupAddress,
  PickupOrderID: null,
  DeliveryOrderID: null,
  Notes: 'โทรก่อนเข้ารับ 15 นาที',
  CreatedAt: '2026-04-01 09:15:00',
  UpdatedAt: '2026-04-01 09:15:00',
  CreatedBy: 'admin@magicwash',
  UpdatedBy: null,
  ServiceTier: 'STANDARD',
  DeletedAt: null,
  DeletedBy: null,
}

const deliveryRow: AppointmentSheetRow = {
  AppointmentID: 'APPT-e5f6a7b8',
  CustomerID: 'CUST-1002',
  AppointmentType: 'DELIVERY',
  AppointmentDate: '2026-04-03',
  TimeSlot: '15:00-17:00',
  Status: 'CONFIRMED',
  Address: deliveryAddress,
  PickupOrderID: 'PO-20260403-001',
  DeliveryOrderID: null,
  Notes: null,
  CreatedAt: '2026-04-01 09:20:00',
  UpdatedAt: '2026-04-01 09:20:00',
  CreatedBy: 'admin@magicwash',
  UpdatedBy: null,
  ServiceTier: 'STANDARD',
  DeletedAt: null,
  DeletedBy: null,
}

const pickupCreateData: AppointmentSheetRow = {
  AppointmentID: 'APPT-a1b2c3d4',
  CustomerID: 'CUST-1001',
  AppointmentType: 'PICKUP',
  AppointmentDate: '2026-04-02',
  TimeSlot: '10:00-12:00',
  Status: 'CONFIRMED',
  Address: pickupAddress,
  PickupOrderID: null,
  DeliveryOrderID: null,
  Notes: 'โทรก่อนเข้ารับ 15 นาที',
  CreatedBy: 'admin@magicwash',
  ServiceTier: 'STANDARD',
  CreatedAt: '2026-04-01 09:15:00',
  UpdatedAt: '2026-04-01 09:15:00',
}

const deliveryCreateData: AppointmentSheetRow = {
  AppointmentID: 'APPT-e5f6a7b8',
  CustomerID: 'CUST-1002',
  AppointmentType: 'DELIVERY',
  AppointmentDate: '2026-04-03',
  TimeSlot: '15:00-17:00',
  Status: 'CONFIRMED',
  Address: deliveryAddress,
  PickupOrderID: 'PO-20260403-001',
  DeliveryOrderID: null,
  Notes: null,
  CreatedBy: 'admin@magicwash',
  ServiceTier: 'STANDARD',
  CreatedAt: '2026-04-01 09:20:00',
  UpdatedAt: '2026-04-01 09:20:00',
}

/**
 * Frontend payloads are public API input. SheetLib payloads are the expected
 * result after AppointmentService enrichment, field mapping, and Address JSON
 * storage encoding. App Script responses use DB/sheet field names.
 */
export const appointmentWriteFixtures: AppointmentWriteFixture[] = [
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
    appScriptRequest: {
      resource: 'sheet',
      action: 'APPEND',
      target: 'Appointment',
      data: pickupCreateData,
    },
    appScriptResponse: {
      status: 'ok',
      target: 'Appointment',
      data: pickupRow,
      write: { updated_range: 'Appointments!A2:Q2' },
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
    appScriptRequest: {
      resource: 'sheet',
      action: 'APPEND',
      target: 'Appointment',
      data: deliveryCreateData,
    },
    appScriptResponse: {
      status: 'ok',
      target: 'Appointment',
      data: deliveryRow,
      write: { updated_range: 'Appointments!A3:Q3' },
    },
  },
  {
    name: 'update appointment notes',
    frontendRequest: {
      notes: 'เลื่อนเป็นช่วงบ่าย กรุณาโทรยืนยัน',
      updatedBy: 'dispatcher@magicwash',
    },
    appScriptRequest: {
      resource: 'sheet',
      action: 'UPDATE',
      target: 'Appointment',
      key_value: 'APPT-a1b2c3d4',
      data: {
        Notes: 'เลื่อนเป็นช่วงบ่าย กรุณาโทรยืนยัน',
        UpdatedBy: 'dispatcher@magicwash',
        UpdatedAt: '2026-04-01 10:05:00',
      },
    },
    appScriptResponse: {
      status: 'ok',
      target: 'Appointment',
      data: {
        ...pickupRow,
        Notes: 'เลื่อนเป็นช่วงบ่าย กรุณาโทรยืนยัน',
        UpdatedBy: 'dispatcher@magicwash',
        UpdatedAt: '2026-04-01 10:05:00',
      },
      write: { updated_range: 'Appointments!J2:N2' },
    },
  },
  {
    name: 'update appointment status',
    frontendRequest: {
      status: 'IN_TRANSIT',
      updatedBy: 'driver@magicwash',
    },
    appScriptRequest: {
      resource: 'sheet',
      action: 'UPDATE',
      target: 'Appointment',
      key_value: 'APPT-e5f6a7b8',
      data: {
        Status: 'IN_TRANSIT',
        UpdatedBy: 'driver@magicwash',
        UpdatedAt: '2026-04-01 10:10:00',
      },
    },
    appScriptResponse: {
      status: 'ok',
      target: 'Appointment',
      data: {
        ...deliveryRow,
        Status: 'IN_TRANSIT',
        UpdatedBy: 'driver@magicwash',
        UpdatedAt: '2026-04-01 10:10:00',
      },
      write: { updated_range: 'Appointments!F3:N3' },
    },
  },
]
