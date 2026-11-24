import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const preferredLanguageSchema = z.enum(['th', 'my', 'en'])
export const staffPreferencesSchema = z.object({ staffId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), language: preferredLanguageSchema })

export const staffPreferencesQuerySchema = staffPreferencesSchema.pick({ staffId: true }).strict()
export const updateStaffPreferencesSchema = staffPreferencesSchema.strict()
export const preferencesApiContract = {
  query: { list: staffPreferencesQuerySchema },
  request: { create: z.never(), update: updateStaffPreferencesSchema },
  response: { list: staffPreferencesSchema, detail: staffPreferencesSchema, update: staffPreferencesSchema },
} satisfies ModuleApiContract
