import type { z } from 'zod'
import {
  appointmentListQuerySchema,
  appointmentListResponseSchema,
  MAX_APPOINTMENTS_PER_PAGE,
} from '@contracts/appointments/appointment-api.schema'
import { apiGetList } from '@/shared/api/api-client'

export type AppointmentListDto = z.infer<typeof appointmentListResponseSchema>

const APPOINTMENTS_ENDPOINT = '/api/appointments'

/** Fetch raw customer appointments; filtering stays in the store because the contract has no deletedAt or date-range query. */
export async function listAppointmentsByCustomer(customerId: string): Promise<AppointmentListDto[]> {
  const { items } = await apiGetList<AppointmentListDto>(APPOINTMENTS_ENDPOINT, {
    query: { customerId, perPage: MAX_APPOINTMENTS_PER_PAGE },
    querySchema: appointmentListQuerySchema,
  })
  return items
}
