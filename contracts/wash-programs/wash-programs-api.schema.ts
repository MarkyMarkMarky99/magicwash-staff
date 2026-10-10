import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'
import { washStepSchema } from '../wash-queue/wash-queue-api.schema.js'

export const washProgramRowSchema = z.object({
  id: z.string(), name: z.string(), status: z.enum(['ACTIVE', 'INACTIVE']),
  sortOrder: z.number().nullable(), steps: z.array(washStepSchema).min(1).max(20),
})
export const washProgramsApiContract = {
  query: { list: z.object({}) }, response: { list: washProgramRowSchema },
} satisfies ModuleApiContract
