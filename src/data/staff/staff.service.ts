import type { z } from 'zod'
import {
  registerStaffBodySchema,
  staffSchema,
  updateStaffBodySchema,
} from '@contracts/staff/staff-api.schema'
import { apiGet, apiPatch, apiPost } from '@/shared/api/api-client'

export type StaffDto = z.infer<typeof staffSchema>
export type RegisterStaffInput = z.infer<typeof registerStaffBodySchema>
export type UpdateStaffInput = z.infer<typeof updateStaffBodySchema>

const STAFF_ENDPOINT = '/api/staff'

/** The signed-in Google user's own row; 404 means the account never registered. */
export function getMyStaff(): Promise<StaffDto> {
  return apiGet<StaffDto>(`${STAFF_ENDPOINT}/me`)
}

export function registerStaff(payload: RegisterStaffInput): Promise<StaffDto> {
  return apiPost<StaffDto>(STAFF_ENDPOINT, {
    data: payload,
    requestSchema: registerStaffBodySchema,
  })
}

export function listStaff(): Promise<StaffDto[]> {
  return apiGet<StaffDto[]>(STAFF_ENDPOINT)
}

export function getStaff(staffId: string): Promise<StaffDto> {
  return apiGet<StaffDto>(`${STAFF_ENDPOINT}/${encodeURIComponent(staffId)}`)
}

export function updateStaff(staffId: string, payload: UpdateStaffInput): Promise<StaffDto> {
  return apiPatch<StaffDto>(`${STAFF_ENDPOINT}/${encodeURIComponent(staffId)}`, {
    data: payload,
    requestSchema: updateStaffBodySchema,
  })
}
