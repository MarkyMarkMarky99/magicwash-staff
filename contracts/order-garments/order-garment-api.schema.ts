import { z } from 'zod'
import { laundryTagIdSchema } from '../laundry-tag-prints/laundry-tag-print.schema.js'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

const requiredName = z.string().trim().min(1)
export const orderGarmentStatusSchema = z.enum(['RECEIVED', 'WASHING', 'DRY_CLEANING', 'IRONING', 'PACKING', 'READY', 'DELIVERED'])
const editableFields = {
  orderitemId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: orderGarmentStatusSchema.optional(),
}

export const orderGarmentListQuerySchema = z.object({
  keyword: z.literal('').default(''),
  orderId: requiredName.optional(),
  laundryItemId: laundryTagIdSchema.optional(),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(1000).default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: z.enum(['id', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const orderGarmentResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  laundryItemId: laundryTagIdSchema,
  orderitemId: z.string().nullable(),
  notes: z.string().nullable(),
  status: orderGarmentStatusSchema,
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
})

export const orderGarmentCreateSchema = z.object({
  orderId: requiredName,
  laundryItemId: laundryTagIdSchema,
  status: orderGarmentStatusSchema,
  orderitemId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdBy: requiredName,
}).strict()

export const orderGarmentUpdateSchema = z.object({
  ...editableFields,
  updatedBy: requiredName,
}).strict().refine((patch) => patch.orderitemId !== undefined || patch.notes !== undefined || patch.status !== undefined, {
  message: 'At least one of orderitemId, notes or status is required',
})

export const orderGarmentApiContract = {
  query: { list: orderGarmentListQuerySchema },
  request: { create: orderGarmentCreateSchema, update: orderGarmentUpdateSchema },
  response: {
    list: orderGarmentResponseSchema,
    detail: orderGarmentResponseSchema,
    create: orderGarmentResponseSchema,
    update: orderGarmentResponseSchema,
  },
} satisfies ModuleApiContract
