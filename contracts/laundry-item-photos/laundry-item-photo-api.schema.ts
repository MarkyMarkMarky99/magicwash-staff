import { z } from 'zod'
import { laundryTagIdSchema } from '../laundry-tag-prints/laundry-tag-print.schema.js'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

const requiredName = z.string().trim().min(1)
export const laundryItemPhotoTypeSchema = z.enum(['BEFORE', 'AFTER', 'DEFECT'])
const editableFields = {
  orderId: z.string().nullable().optional(),
  photoType: laundryItemPhotoTypeSchema.optional(),
  notes: z.string().nullable().optional(),
}

export const laundryItemPhotoListQuerySchema = z.object({
  keyword: z.literal('').default(''),
  laundryItemId: laundryTagIdSchema.optional(),
  orderId: requiredName.optional(),
  photoType: laundryItemPhotoTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(1000).default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: z.enum(['id', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const laundryItemPhotoResponseSchema = z.object({
  id: z.string(),
  laundryItemId: laundryTagIdSchema,
  orderId: z.string().nullable(),
  photoType: laundryItemPhotoTypeSchema,
  imageUrl: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
})

export const laundryItemPhotoCreateSchema = z.object({
  laundryItemId: laundryTagIdSchema,
  photoType: laundryItemPhotoTypeSchema,
  imageUrl: requiredName,
  orderId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdBy: requiredName,
}).strict()

export const laundryItemPhotoUpdateSchema = z.object({
  ...editableFields,
  updatedBy: requiredName,
}).strict().refine((patch) => patch.orderId !== undefined || patch.photoType !== undefined || patch.notes !== undefined, {
  message: 'At least one of orderId, photoType or notes is required',
})

export const laundryItemPhotoApiContract = {
  query: { list: laundryItemPhotoListQuerySchema },
  request: { create: laundryItemPhotoCreateSchema, update: laundryItemPhotoUpdateSchema },
  response: {
    list: laundryItemPhotoResponseSchema,
    detail: laundryItemPhotoResponseSchema,
    create: laundryItemPhotoResponseSchema,
    update: laundryItemPhotoResponseSchema,
  },
} satisfies ModuleApiContract
