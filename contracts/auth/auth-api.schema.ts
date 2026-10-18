import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const authMeResponseSchema = z.object({
  staffId: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'staff', 'device']),
})

export const authCardResponseSchema = z.object({ staffId: z.string(), name: z.string() })
export const authCardQuerySchema = z.object({ code: z.string().trim().min(1) })

const authResponses = { list: authMeResponseSchema, detail: authMeResponseSchema, card: authCardResponseSchema }

export const authApiContract = {
  query: { list: z.object({}) },
  response: authResponses,
} satisfies ModuleApiContract
