import type {
  RepositoryRequest,
  RepositoryTransformer,
} from '../../shared/repositories/base.repository.js'
import { isRecord } from '../../shared/repositories/utils/gviz-cell.js'
import { appointmentsRowSchema } from '../../sheets/Appointments/Appointments.db-contract.js'
import type { z } from 'zod'

export type AppointmentDbRow = z.infer<typeof appointmentsRowSchema>

type AppointmentDbCreateRequest = Omit<Partial<AppointmentDbRow>, 'Address'> & {
  AppointmentID: string
  CustomerID: string
  AppointmentType: AppointmentDbRow['AppointmentType']
  AppointmentDate: string
  TimeSlot: AppointmentDbRow['TimeSlot']
  Status: AppointmentDbRow['Status']
  Address: string
  CreatedBy: string
  ServiceTier: 'STANDARD'
  CreatedAt: string
  UpdatedAt: string
}

type AppointmentDbUpdateRequest = Partial<AppointmentDbRow> & {
  UpdatedBy: string
  UpdatedAt: string
}

export interface AppointmentCustomerSnapshot {
  CustomerName: string
  CustomerLabel: string
  Phone: string
  Address: string
  Location: string
}

export type AppointmentTransformerRequest = RepositoryRequest<
  unknown,
  AppointmentDbCreateRequest | AppointmentDbUpdateRequest
>

export type AppointmentCreateTransformerData = AppointmentDbCreateRequest & {
  customerName: string
  customerCode: string
  phone: string
  location: string
}

export function createAppointmentTransformer(): RepositoryTransformer {
  return {
    async request(request) {
      return transformAppointmentRequest(request)
    },
    response(response) {
      return transformAppointmentResponse(response)
    },
  }
}

export async function transformAppointmentRequest(
  request: RepositoryRequest<unknown, unknown>,
): Promise<RepositoryRequest<unknown, unknown>> {
  if (request.operation !== 'create') {
    return request
  }

  // BaseCrudService has already validated the public request. This transformer
  // only adapts the flat API snapshot into the legacy Address JSON cell.
  const data = request.data as AppointmentCreateTransformerData
  const snapshot = buildCustomerSnapshot(data)
  const {
    customerName: _customerName,
    customerCode: _customerCode,
    phone: _phone,
    location: _location,
    ...dbData
  } = data

  return {
    ...request,
    data: {
      ...dbData,
      Address: JSON.stringify(snapshot),
    },
  }
}

export function transformAppointmentResponse(_response: unknown): unknown {
  if (Array.isArray(_response)) {
    return _response.map((item) =>
      isRecord(item) ? transformResponseRow(item) : item,
    )
  }

  if (isRecord(_response)) {
    return transformResponseRow(_response)
  }

  return _response
}

export function buildCustomerSnapshot(
  data: AppointmentCreateTransformerData,
): AppointmentCustomerSnapshot {
  return {
    CustomerName: data.customerName,
    CustomerLabel: data.customerCode,
    Phone: data.phone,
    Address: data.Address,
    Location: data.location,
  }
}

export function flattenAddressSnapshot(
  value: unknown,
): Record<string, unknown> | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed)) {
      return undefined
    }

    // Decode the storage representation only. Do not check, trim, default, or
    // otherwise repair values originating from the sheet.
    return {
      Address: parsed.Address,
      customerName: parsed.CustomerName,
      customerCode: parsed.CustomerLabel,
      phone: parsed.Phone,
      location: parsed.Location,
    }
  } catch {
    // A legacy plain-text or malformed cell is returned untouched by the row
    // transformer; dirty database data must not be coerced into a clean shape.
    return undefined
  }
}

export function transformResponseRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const snapshot = flattenAddressSnapshot(row.Address)

  return {
    ...row,
    ...snapshot,
  }
}
