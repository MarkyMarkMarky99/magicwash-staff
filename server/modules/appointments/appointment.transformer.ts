import type { z } from 'zod'
import type {
  RepositoryRequest,
  RepositoryTransformer,
} from '../../shared/repositories/base.repository'
import type { appointmentContract } from './appointment.contract'

export type AppointmentDbRow = z.infer<typeof appointmentContract.db.row>
export type AppointmentDbCreateRequest = z.infer<
  typeof appointmentContract.db.request.create
>
export type AppointmentDbUpdateRequest = z.infer<
  typeof appointmentContract.db.request.update
>

export interface AppointmentCustomerSnapshot {
  CustomerName: string
  CustomerLabel: string
  Phone: string
  Address: string
  Location: string
  Facebook: string
  Line: string
  Whatsapp: string
  Email: string
}

export interface FlattenedAddressSnapshot {
  Address: string | null
  customerName: string | null
  customerCode: string | null
  phone: string | null
  location: string | null
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

  if (!isRecord(request.data)) {
    throw new Error('Appointment create requires data object')
  }

  const data = request.data
  const snapshot = buildCustomerSnapshot(data as AppointmentCreateTransformerData)
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
    CustomerName: requireString(data.customerName, 'customerName'),
    CustomerLabel: requireString(data.customerCode, 'customerCode'),
    Phone: requireString(data.phone, 'phone'),
    Address: requireString(data.Address, 'address'),
    Location: requireString(data.location, 'location'),
    Facebook: '',
    Line: '',
    Whatsapp: '',
    Email: '',
  }
}

export function flattenAddressSnapshot(
  value: unknown,
): FlattenedAddressSnapshot {
  const empty = emptyAddressSnapshot()

  if (typeof value !== 'string' || value.trim() === '') {
    return empty
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return { ...empty, Address: nullableString(value) }
  }

  if (!isRecord(parsed)) {
    return { ...empty, Address: nullableString(value) }
  }

  return {
    Address: nullableString(parsed.Address),
    customerName: nullableString(parsed.CustomerName),
    customerCode: nullableString(parsed.CustomerLabel),
    phone: nullableString(parsed.Phone),
    location: nullableString(parsed.Location),
  }
}

export function transformResponseRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...row,
    ...flattenAddressSnapshot(row.Address),
  }
}

export function nullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function emptyAddressSnapshot(): FlattenedAddressSnapshot {
  return {
    Address: null,
    customerName: null,
    customerCode: null,
    phone: null,
    location: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Appointment create requires ${field}`)
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    throw new Error(`Appointment create requires ${field}`)
  }

  return trimmed
}
