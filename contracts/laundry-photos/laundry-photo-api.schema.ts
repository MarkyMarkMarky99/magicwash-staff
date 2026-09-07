import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const MAX_LAUNDRY_PHOTOS_PER_PAGE = 500

export const laundryPhotoListQuerySchema = z.object({
  keyword: z.string().default(''),
  orderId: z.string().trim().min(1),
  orderItemId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(MAX_LAUNDRY_PHOTOS_PER_PAGE).default(MAX_LAUNDRY_PHOTOS_PER_PAGE),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const laundryPhotoResponseSchema = z.object({
  laundryPhotoId: z.string(),
  orderId: z.string().nullable(),
  orderItemId: z.string().nullable(),
  itemId: z.string().nullable(),
  imagePath: z.string().nullable(),
  imageUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
  checked: z.boolean().nullable(),
  isActive: z.boolean().nullable(),
  fileId: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
})

export const laundryPhotoCreateSchema = z
  .object({
    orderId: z.string().trim().min(1),
    imageUrl: z.string().trim().min(1),
    createdBy: z.string().trim().min(1),
    orderItemId: z.string().trim().min(1).nullish(),
    itemId: z.string().trim().min(1).nullish(),
  })
  .strict()

export const laundryPhotoUpdateSchema = z
  .object({
    orderItemId: z.string().trim().min(1),
    updatedBy: z.string().trim().min(1),
  })
  .strict()

export const laundryPhotoDetailResponseSchema = laundryPhotoResponseSchema
export const laundryPhotoCreateResponseSchema = laundryPhotoResponseSchema
export const laundryPhotoUpdateResponseSchema = laundryPhotoResponseSchema

export const laundryPhotoApiContract = {
  query: { list: laundryPhotoListQuerySchema },
  request: { create: laundryPhotoCreateSchema, update: laundryPhotoUpdateSchema },
  response: {
    list: laundryPhotoResponseSchema,
    detail: laundryPhotoDetailResponseSchema,
    create: laundryPhotoCreateResponseSchema,
    update: laundryPhotoUpdateResponseSchema,
  },
} satisfies ModuleApiContract
