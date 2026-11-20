import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

const id = z.string().trim().min(1).refine(value => !value.startsWith('='), 'A cell formula is not allowed')
export const stockTakeStatusSchema = z.enum(['OPEN', 'CLOSED', 'APPLIED', 'CANCELLED'])
export const stockTakeDepartmentSchema = z.enum(['Washing', 'DryCleaning', 'Ironing', 'Packaging'])
export const stockTakeResolutionSchema = z.enum(['RETURNED', 'OFF_SITE', 'LOST', 'KEEP_LOOKING', 'LINK_CONFIRMED', 'TASK_PICK'])

export const stockTakeSessionSchema = z.object({
  id,
  status: stockTakeStatusSchema,
  openedAt: z.string(),
  openedBy: id,
  closedAt: z.string().nullable(),
  closedBy: id.nullable(),
  appliedAt: z.string().nullable(),
  appliedBy: id.nullable(),
  notes: z.string().nullable(),
})

export const stockTakeOpenSchema = z.object({ notes: id.nullable().optional() }).strict()
export const stockTakeSessionRequestSchema = z.object({ sessionId: id }).strict()
export const stockTakeReportQuerySchema = stockTakeSessionRequestSchema

export const stockTakeScanSchema = z.object({
  tag: z.string().min(1),
  department: stockTakeDepartmentSchema.nullable(),
  status: z.enum(['Pending', 'In Progress', 'Packed']),
  bagId: id.nullable(),
}).strict().refine(scan => scan.status === 'Packed' ? scan.department === null : scan.department !== null && scan.bagId === null, {
  message: 'Use a department for pending or in-progress scans and a bag only for packed scans.',
})

export const stockTakeScansSchema = stockTakeSessionRequestSchema.extend({ scans: z.array(stockTakeScanSchema).min(1) })
export const stockTakeScansResponseSchema = z.object({ scans: z.array(stockTakeScanSchema), added: z.number().int().nonnegative() })

const claim = z.object({ orderId: id, tag: id })
export const stockTakeResolutionEntrySchema = claim.extend({
  resolution: stockTakeResolutionSchema,
  reason: id.nullable().optional(),
  jobTicketId: id.nullable().optional(),
}).strict().refine(row => (row.resolution !== 'RETURNED' && row.resolution !== 'OFF_SITE') || !!row.reason, {
  message: 'Returned and off-site resolutions require a reason.',
}).refine(row => row.resolution === 'TASK_PICK' ? !!row.jobTicketId : row.jobTicketId == null, {
  message: 'Only a task pick requires a job ticket.',
})

export const stockTakeResolutionsSchema = stockTakeSessionRequestSchema.extend({
  resolutions: z.array(stockTakeResolutionEntrySchema).min(1),
})
export const stockTakeResolutionsResponseSchema = z.object({ recorded: z.number().int().nonnegative() })

const ticket = z.object({
  id,
  department: z.string(),
  taskCode: z.string().nullable(),
  stepNo: z.number(),
  status: z.string(),
})
const garment = claim.extend({
  garmentType: z.string().nullable(),
  registrationPhoto: z.string().nullable(),
  lastTicket: ticket.nullable(),
  logistics: z.array(z.object({ bagId: id, status: z.string().nullable() })),
  resolution: stockTakeResolutionSchema.nullable(),
  reason: z.string().nullable(),
  disposition: z.enum(['FOUND', 'RETURNED', 'OFF_SITE', 'MISSING']),
})
const order = z.object({
  orderId: id,
  status: z.string().nullable(),
  found: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  offSite: z.number().int().nonnegative(),
  expected: z.number().int().nonnegative(),
  accounted: z.boolean(),
  garments: z.array(garment),
})
const issue = claim.extend({ code: z.string(), ticketIds: z.array(id) })
export const stockTakeReportSchema = z.object({
  session: stockTakeSessionSchema,
  orders: z.array(order),
  missing: z.array(garment),
  membershipGaps: z.array(z.object({ orderId: id, tag: id.nullable(), code: z.string(), confirmed: z.boolean() })),
  conflicts: z.array(z.object({ orderId: id.nullable(), tag: id, code: z.string(), ticketIds: z.array(id) })),
  unexpected: z.array(z.object({ tag: id, code: z.string() })),
  backward: z.array(issue),
  blocked: z.array(issue),
  packingExceptions: z.array(issue),
  dispatchExceptions: z.array(issue),
  skipped: z.array(claim),
})
export const stockTakePreviewResponseSchema = z.object({
  report: stockTakeReportSchema,
  planned: z.array(claim.extend({ ticketCount: z.number().int().positive(), changeCount: z.number().int().nonnegative() })),
})
export const stockTakeApplyResponseSchema = z.object({ applied: z.array(claim), skipped: z.array(claim) })

export const stockTakeApiContract = {
  query: { list: z.never(), report: stockTakeReportQuerySchema },
  request: {
    create: stockTakeOpenSchema,
    update: z.never(),
    scans: stockTakeScansSchema,
    resolutions: stockTakeResolutionsSchema,
    close: stockTakeSessionRequestSchema,
    cancel: stockTakeSessionRequestSchema,
    preview: stockTakeSessionRequestSchema,
    apply: stockTakeSessionRequestSchema,
    finish: stockTakeSessionRequestSchema,
  },
  response: {
    list: stockTakeSessionSchema,
    create: stockTakeSessionSchema,
    active: stockTakeSessionSchema.nullable(),
    close: stockTakeSessionSchema,
    cancel: stockTakeSessionSchema,
    scans: stockTakeScansResponseSchema,
    resolutions: stockTakeResolutionsResponseSchema,
    report: stockTakeReportSchema,
    preview: stockTakePreviewResponseSchema,
    apply: stockTakeApplyResponseSchema,
    finish: stockTakeSessionSchema,
  },
} satisfies ModuleApiContract & {
  query: { report: typeof stockTakeReportQuerySchema }
  request: Record<string, z.ZodTypeAny>
  response: Record<string, z.ZodTypeAny>
}
