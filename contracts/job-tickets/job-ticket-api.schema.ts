import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const jobTicketScopeSchema = z.enum(['ITEM', 'ORDER'])
export const jobTicketDepartmentSchema = z.enum([
  'Tagging',
  'Washing',
  'DryCleaning',
  'Ironing',
  'Packaging',
  'Logistics',
])
export const jobTicketStatusSchema = z.enum(['Pending', 'In Progress', 'Completed', 'Cancelled'])

export const jobTicketListQuerySchema = z.object({
  keyword: z.string().default(''),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(10_000).default(500),
  sortBy: z.enum(['createdAt', 'stepNo', 'dueDate', 'completedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  orderId: z.string().trim().min(1).optional(),
  laundryItemId: z.string().trim().min(1).optional(),
  department: jobTicketDepartmentSchema.optional(),
  status: jobTicketStatusSchema.optional(),
})

export const jobTicketUpdateSchema = z.object({
  status: jobTicketStatusSchema,
  updatedBy: z.string().trim().min(1),
})

export const jobTicketResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  laundryItemId: z.string().nullable(),
  scope: jobTicketScopeSchema,
  taskCode: z.string().nullable(),
  department: jobTicketDepartmentSchema,
  stepNo: z.number().int().min(0),
  customerId: z.string().nullable(),
  orderName: z.string().nullable(),
  dueDate: z.string().nullable(),
  specialInstructions: z.string().nullable(),
  notes: z.string().nullable(),
  status: jobTicketStatusSchema,
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  scannedBy: z.string().nullable(),
  photoEvidenceUrl: z.string().nullable(),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
  workMinutes: z.number().nullable(),
})

export const jobTicketScanRequestSchema = z.object({
  laundryItemId: z.string().trim().min(1),
  department: jobTicketDepartmentSchema,
  taskCode: z.string().trim().min(1).optional(),
  scannedBy: z.string().trim().min(1),
})

export const jobTicketStartOrderRequestSchema = z.object({
  orderId: z.string().trim().min(1),
  department: jobTicketDepartmentSchema,
  scannedBy: z.string().trim().min(1),
})

export const jobTicketAdvanceRequestSchema = z.object({
  department: jobTicketDepartmentSchema,
  fromStatus: z.enum(['Pending', 'In Progress']),
  tickets: z.array(z.object({
    ticketId: z.string().trim().min(1),
    orderId: z.string().trim().min(1),
  })).min(1).max(200),
  scannedBy: z.string().trim().min(1),
})

const jobTicketAdvanceBlockedSchema = z.object({
  ticketId: z.string(),
  laundryItemId: z.string().nullable(),
  blockedByDepartment: jobTicketDepartmentSchema,
})

const jobTicketAdvanceSkippedSchema = z.object({
  ticketId: z.string(),
  reason: z.enum(['not_found', 'status_changed']),
})

export const jobTicketAdvanceResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('completed'),
    advanced: z.array(z.object({
      ticketId: z.string(),
      laundryItemId: z.string().nullable(),
      status: z.enum(['In Progress', 'Completed']),
      startedAt: z.string().nullable(),
      completedAt: z.string().nullable(),
    })),
    blocked: z.array(jobTicketAdvanceBlockedSchema),
    skipped: z.array(jobTicketAdvanceSkippedSchema),
    scoreFailed: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal('write_failed'),
    certainty: z.enum(['rejected', 'unknown']),
    blocked: z.array(jobTicketAdvanceBlockedSchema),
    skipped: z.array(jobTicketAdvanceSkippedSchema),
  }),
])

const jobTicketStartOrderBlockedSchema = z.object({
  ticketId: z.string(),
  laundryItemId: z.string(),
  blockedByDepartment: jobTicketDepartmentSchema,
})

export const jobTicketStartOrderResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('completed'),
    advanced: z.array(z.object({
      ticketId: z.string(),
      laundryItemId: z.string(),
      status: z.literal('In Progress'),
      startedAt: z.string().nullable(),
    })),
    blocked: z.array(jobTicketStartOrderBlockedSchema),
    skippedWithoutTag: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal('write_failed'),
    certainty: z.enum(['rejected', 'unknown']),
    blocked: z.array(jobTicketStartOrderBlockedSchema),
    skippedWithoutTag: z.number().int().min(0),
  }),
])

export const jobTicketScanResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('advanced'),
    ticketId: z.string(),
    status: z.enum(['In Progress', 'Completed']),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
  }),
  z.object({
    kind: z.literal('not_found'),
    laundryItemId: z.string(),
    department: jobTicketDepartmentSchema,
  }),
  z.object({
    kind: z.literal('ambiguous'),
    laundryItemId: z.string(),
    department: jobTicketDepartmentSchema,
    taskCodes: z.array(z.string().nullable()).min(2),
  }),
  z.object({
    kind: z.literal('not_advanceable'),
    ticketId: z.string(),
    status: jobTicketStatusSchema,
  }),
  z.object({
    kind: z.literal('blocked'),
    laundryItemId: z.string(),
    department: jobTicketDepartmentSchema,
    blockedByDepartment: jobTicketDepartmentSchema,
  }),
  z.object({
    kind: z.literal('already_completed'),
    ticketId: z.string(),
  }),
  z.object({
    kind: z.literal('write_failed'),
    ticketId: z.string(),
    certainty: z.enum(['rejected', 'unknown']),
  }),
])

export const jobTicketApiContract = {
  query: { list: jobTicketListQuerySchema },
  request: { create: z.never(), update: jobTicketUpdateSchema },
  response: {
    list: jobTicketResponseSchema,
    detail: jobTicketResponseSchema,
    update: jobTicketResponseSchema,
  },
} satisfies ModuleApiContract
