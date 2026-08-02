import type { z } from 'zod'
import {
  appointmentDetailResponseSchema,
  appointmentCreateResponseSchema,
  appointmentCreateSchema,
  appointmentListQuerySchema,
  appointmentListResponseSchema,
  appointmentUpdateResponseSchema,
  appointmentUpdateSchema,
} from '@contracts/appointments/appointment-api.schema'
import { apiGet, apiGetList, apiPatch, apiPost, type ListResult } from '@/shared/api/api-client'

const APPOINTMENTS_ENDPOINT = '/api/appointments'

type AppointmentCreateRequest = z.input<typeof appointmentCreateSchema>
type AppointmentUpdateRequest = z.input<typeof appointmentUpdateSchema>
type AppointmentListQuery = z.input<typeof appointmentListQuerySchema>

export type AppointmentListDto = z.infer<typeof appointmentListResponseSchema>
export type AppointmentDetailDto = z.infer<typeof appointmentDetailResponseSchema>
export type AppointmentCreateDto = z.infer<typeof appointmentCreateResponseSchema>
export type AppointmentUpdateDto = z.infer<typeof appointmentUpdateResponseSchema>

// TODO(auth): replace this temporary migration actor with the authenticated user.
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
  )
}

/** Create an appointment through the backend's contract-validated API. */
export function createAppointment(
  data: Omit<AppointmentCreateRequest, 'createdBy'>,
): Promise<AppointmentCreateDto> {
  return apiPost<AppointmentCreateDto>(APPOINTMENTS_ENDPOINT, {
    data: { ...data, createdBy: LEGACY_APPOINTMENT_ACTOR },
    requestSchema: appointmentCreateSchema,
  })
}

/** Update an appointment through the backend's contract-validated API. */
export function updateAppointment(
  appointmentId: string,
  data: Omit<AppointmentUpdateRequest, 'updatedBy'>,
): Promise<AppointmentUpdateDto> {
  return apiPatch<AppointmentUpdateDto>(
    `${APPOINTMENTS_ENDPOINT}/${encodeURIComponent(appointmentId)}`,
    {
      data: { ...data, updatedBy: LEGACY_APPOINTMENT_ACTOR },
      requestSchema: appointmentUpdateSchema,
    },
  )
}
