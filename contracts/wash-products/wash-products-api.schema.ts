import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const washProductTypeSchema = z.enum(['DETERGENT', 'SOFTENER', 'BLEACH'])
export const washProductStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])
export const washProductRowSchema = z.object({
  id: z.string(),
  type: washProductTypeSchema,
  name: z.string(),
  status: washProductStatusSchema,
  sortOrder: z.number().nullable(),
  note: z.string().nullable(),
})

export const washProductsApiContract = {
  query: { list: z.object({}) },
  response: { list: washProductRowSchema },
} satisfies ModuleApiContract
