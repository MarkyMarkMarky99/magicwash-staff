import type { z } from 'zod'
import {
  appointmentCreateResponseSchema,
  appointmentCreateSchema,
  appointmentUpdateResponseSchema,
  appointmentUpdateSchema,
} from '@contracts/appointments/appointment-api.schema'
import { apiPatch, apiPost } from '@/shared/api/api-client'

const APPOINTMENTS_ENDPOINT = '/api/appointments'

type AppointmentCreateRequest = z.input<typeof appointmentCreateSchema>
type AppointmentUpdateRequest = z.input<typeof appointmentUpdateSchema>

export type AppointmentCreateDto = z.infer<typeof appointmentCreateResponseSchema>
export type AppointmentUpdateDto = z.infer<typeof appointmentUpdateResponseSchema>

// TODO(auth): replace this temporary migration actor with the authenticated user.
export const LEGACY_APPOINTMENT_ACTOR = 'admin'

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
