import { z } from 'zod'
import { laundryTagIdSchema } from '../laundry-tag-prints/laundry-tag-print.schema.js'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

const requiredName = z.string().trim().min(1)
const editableFields = {
  itemId: z.string().nullable().optional(),
  washProgram: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}

export const laundryItemListQuerySchema = z.object({
  keyword: z.string().default(''),
  customerId: requiredName.optional(),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(1000).default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: z.enum(['id', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const laundryItemResponseSchema = z.object({
  id: laundryTagIdSchema,
  customerId: z.string(),
  itemId: z.string().nullable(),
  washProgram: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
})

export const laundryItemCreateSchema = z.object({
  id: laundryTagIdSchema,
  customerId: requiredName,
  ...editableFields,
  createdBy: requiredName,
}).strict()

export const laundryItemUpdateSchema = z.object({
  ...editableFields,
  updatedBy: requiredName,
}).strict().refine((patch) => patch.itemId !== undefined || patch.washProgram !== undefined || patch.notes !== undefined, {
  message: 'At least one of itemId, washProgram or notes is required',
})

export const laundryItemApiContract = {
  query: { list: laundryItemListQuerySchema },
  request: { create: laundryItemCreateSchema, update: laundryItemUpdateSchema },
  response: {
    list: laundryItemResponseSchema,
    detail: laundryItemResponseSchema,
    create: laundryItemResponseSchema,
    update: laundryItemResponseSchema,
  },
} satisfies ModuleApiContract
