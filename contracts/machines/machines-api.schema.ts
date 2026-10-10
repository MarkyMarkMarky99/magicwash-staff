import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const machineTypeSchema = z.enum(['WSH', 'DRY'])
export const machineStatusSchema = z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED'])
export const machineRowSchema = z.object({
  id: z.string(),
  type: machineTypeSchema,
  name: z.string(),
  capacityKg: z.number().nullable(),
  status: machineStatusSchema,
  sortOrder: z.number().nullable(),
  note: z.string().nullable(),
})

export const machinesApiContract = {
  query: { list: z.object({}) },
  response: { list: machineRowSchema },
} satisfies ModuleApiContract
