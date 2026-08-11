import type { z } from 'zod'
import {
  appointmentDetailResponseSchema,
  appointmentCreateResponseSchema,
  appointmentCreateSchema,
  appointmentWriteFailureCertaintySchema,
  appointmentListQuerySchema,
  appointmentListResponseSchema,
  appointmentUpdateResponseSchema,
  appointmentUpdateSchema,
} from '@contracts/appointments/appointment-api.schema'
import { apiErrorResponseSchema } from '@contracts/shared/api.schema'
import { apiGet, apiGetList, ApiError, type ListResult } from '@/shared/api/api-client'
import { normalizeSheetDate } from '@/shared/utils/sheet-date'

const APPOINTMENTS_ENDPOINT = '/api/appointments'

type AppointmentCreateRequest = z.input<typeof appointmentCreateSchema>
type AppointmentUpdateRequest = z.input<typeof appointmentUpdateSchema>
type AppointmentListQuery = z.input<typeof appointmentListQuerySchema>
type AppointmentWriteFailureCertainty = z.infer<typeof appointmentWriteFailureCertaintySchema>

export type AppointmentListDto = z.infer<typeof appointmentListResponseSchema>
export type AppointmentDetailDto = z.infer<typeof appointmentDetailResponseSchema>
export type AppointmentCreateDto = z.infer<typeof appointmentCreateResponseSchema>
export type AppointmentUpdateDto = z.infer<typeof appointmentUpdateResponseSchema>

/** Error from an appointment write whose outcome was classified by the API. */
export class AppointmentWriteApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    code: string | undefined,
    readonly certainty: AppointmentWriteFailureCertainty,
  ) {
    super(message, status, code)
    this.name = 'AppointmentWriteApiError'
  }
}

/** Keep retry guidance tied to the certainty value returned by the API. */
export function appointmentWriteErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof AppointmentWriteApiError) {
    return reason.certainty === 'rejected'
      ? 'This appointment was not saved. It is safe to try again.'
      : 'We could not confirm whether this appointment was saved. Check before retrying.'
  }

  return reason instanceof Error && reason.message ? reason.message : fallback
}

/** Actor supplied at the appointment write boundary. */
export const LEGACY_APPOINTMENT_ACTOR = 'admin'

/** List appointments through the backend; filters are validated before the request. */
export function listAppointments(query: AppointmentListQuery = {}): Promise<ListResult<AppointmentListDto>> {
  return apiGetList<AppointmentListDto>(APPOINTMENTS_ENDPOINT, {
    query,
    querySchema: appointmentListQuerySchema,
  })
}

/** Load a single appointment for a direct, bookmarkable reschedule route. */
export function getAppointment(appointmentId: string): Promise<AppointmentDetailDto> {
  return apiGet<AppointmentDetailDto>(
    `${APPOINTMENTS_ENDPOINT}/${encodeURIComponent(appointmentId)}`,
  ).then(normalizeAppointmentDetail)
}

function normalizeAppointmentDetail(appointment: AppointmentDetailDto): AppointmentDetailDto {
  const appointmentDate = normalizeSheetDate(appointment.appointmentDate)
  return appointmentDate && appointmentDate !== appointment.appointmentDate
    ? { ...appointment, appointmentDate }
    : appointment
}

/** Create an appointment through the backend's contract-validated API. */
export function createAppointment(
  data: Omit<AppointmentCreateRequest, 'createdBy'>,
): Promise<AppointmentCreateDto> {
  return appointmentWrite<AppointmentCreateDto>(APPOINTMENTS_ENDPOINT, 'POST', {
    data: { ...data, createdBy: LEGACY_APPOINTMENT_ACTOR },
    requestSchema: appointmentCreateSchema,
  })
}

/** Update an appointment through the backend's contract-validated API. */
export function updateAppointment(
  appointmentId: string,
  data: Omit<AppointmentUpdateRequest, 'updatedBy'>,
): Promise<AppointmentUpdateDto> {
  return appointmentWrite<AppointmentUpdateDto>(
    `${APPOINTMENTS_ENDPOINT}/${encodeURIComponent(appointmentId)}`,
    'PATCH',
    {
      data: { ...data, updatedBy: LEGACY_APPOINTMENT_ACTOR },
      requestSchema: appointmentUpdateSchema,
    },
  )
}

interface AppointmentWriteOptions<TRequest extends z.ZodTypeAny> {
  data: unknown
  requestSchema: TRequest
}

/**
 * Appointment writes read the existing error envelope's details field so the
 * API-provided certainty reaches the two write-facing pages without changing
 * the shared client behavior used by other features.
 */
async function appointmentWrite<
  TResponse,
  TRequest extends z.ZodTypeAny,
>(
  path: string,
  method: 'POST' | 'PATCH',
  options: AppointmentWriteOptions<TRequest>,
): Promise<TResponse> {
  const validatedData = options.requestSchema.parse(options.data)
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedData),
  })

  if (!response.ok) throw await toAppointmentWriteError(response)

  const body = (await response.json()) as { data: TResponse }
  return body.data
}

async function toAppointmentWriteError(response: Response): Promise<ApiError> {
  try {
    const parsed = apiErrorResponseSchema.safeParse(await response.json())
    if (parsed.success) {
      const details = parsed.data.error.details
      const certainty = appointmentWriteFailureCertaintySchema.safeParse(
        isRecord(details) ? details.certainty : undefined,
      )
      if (certainty.success) {
        return new AppointmentWriteApiError(
          parsed.data.error.message,
          response.status,
          parsed.data.error.code,
          certainty.data,
        )
      }

      return new ApiError(parsed.data.error.message, response.status, parsed.data.error.code)
    }
  } catch {
    // Body was not JSON / not an error envelope — fall through to a generic message.
  }

  return new ApiError(`Request failed: ${response.status}`, response.status)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
