import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const authMeResponseSchema = z.object({
  staffId: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'staff']),
})

export const authApiContract = {
  query: { list: z.object({}) },
  response: { list: authMeResponseSchema, detail: authMeResponseSchema },
} satisfies ModuleApiContract
