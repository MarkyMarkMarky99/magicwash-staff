import type { z } from 'zod'
import type { authMeResponseSchema } from '@contracts/auth/auth-api.schema'
import { apiGet } from '@/shared/api/api-client'

export type StaffSession = z.infer<typeof authMeResponseSchema>

export function getCurrentStaff(): Promise<StaffSession> {
  return apiGet<StaffSession>('/api/auth/me')
}
