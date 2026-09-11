import type { z } from 'zod'
import {
  appointmentDetailResponseSchema,
  appointmentCreateResponseSchema,
  createAppointmentRequestSchema,
  appointmentWriteFailureCertaintySchema,
  appointmentListQuerySchema,
  appointmentListResponseSchema,
  appointmentUpdateResponseSchema,
  updateAppointmentRequestSchema,
} from '@contracts/appointments/appointment-api.schema'
import { apiErrorResponseSchema } from '@contracts/shared/api.schema'
import { apiGet, apiGetList, ApiError, type ListResult } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'
import { normalizeSheetDate } from '@/shared/utils/sheet-date'
import { currentActor } from '@/shared/config/actor'

const APPOINTMENTS_ENDPOINT = '/api/appointments'

type AppointmentCreateRequest = z.input<typeof createAppointmentRequestSchema>
type AppointmentUpdateRequest = z.input<typeof updateAppointmentRequestSchema>
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

export function listAppointments(query: AppointmentListQuery = {}): Promise<ListResult<AppointmentListDto>> {
  return apiGetList<AppointmentListDto>(APPOINTMENTS_ENDPOINT, {
    query,
    querySchema: appointmentListQuerySchema,
  })
}

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

export async function createAppointment(
  data: Omit<AppointmentCreateRequest, 'createdBy'>,
): Promise<AppointmentCreateDto> {
  const result = await appointmentWrite<AppointmentCreateDto>(APPOINTMENTS_ENDPOINT, 'POST', {
    data: { ...data, createdBy: currentActor() },
    requestSchema: createAppointmentRequestSchema,
  })
  invalidate('/api/appointments')
  return result
}

export async function updateAppointment(
  appointmentId: string,
  data: Omit<AppointmentUpdateRequest, 'updatedBy'>,
): Promise<AppointmentUpdateDto> {
  const result = await appointmentWrite<AppointmentUpdateDto>(
    `${APPOINTMENTS_ENDPOINT}/${encodeURIComponent(appointmentId)}`,
    'PATCH',
    {
      data: { ...data, updatedBy: currentActor() },
      requestSchema: updateAppointmentRequestSchema,
    },
  )
  invalidate('/api/appointments')
  return result
}

interface AppointmentWriteOptions {
  data: unknown
  requestSchema: z.ZodTypeAny
}

/**
 * Appointment writes read the existing error envelope's details field so the
 * API-provided certainty reaches the two write-facing pages without changing
 * the shared client behavior used by other features.
 */
async function appointmentWrite<TResponse>(
  path: string,
  method: 'POST' | 'PATCH',
  options: AppointmentWriteOptions,
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
  }

  return new ApiError(`Request failed: ${response.status}`, response.status)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
