import { z } from 'zod'
import { jobTicketDepartmentSchema } from '../job-tickets/job-ticket-api.schema.js'

const MAX_PERIOD_DAYS = 62
const DAY_MS = 24 * 60 * 60 * 1000

export const workTransactionTypeSchema = z.enum(['EARN', 'ADJUSTMENT', 'VOID'])

export const workTransactionListQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
}).refine((query) => query.from <= query.to, { message: 'from must not be after to' })
  .refine(
    (query) => (Date.parse(query.to) - Date.parse(query.from)) / DAY_MS < MAX_PERIOD_DAYS,
    { message: `period must be shorter than ${MAX_PERIOD_DAYS} days` },
  )

export const workTransactionSchema = z.object({
  id: z.string(),
  jobTicketId: z.string(),
  department: jobTicketDepartmentSchema.nullable(),
  type: workTransactionTypeSchema,
  minutes: z.number(),
  staffId: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
})

export const workTransactionListResponseSchema = z.array(workTransactionSchema)
