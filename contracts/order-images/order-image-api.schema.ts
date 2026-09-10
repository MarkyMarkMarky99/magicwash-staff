import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'
import { isValidOrderImageWeight } from '../../shared/utils/item-quantity.js'

export const orderImageTypeSchema = z.enum(['WEIGHT', 'BELONGING', 'DOCUMENT'])

export const MAX_ORDER_IMAGES_PER_PAGE = 500

export const orderImageListQuerySchema = z.object({
  keyword: z.string().default(''),
  orderId: z.string().trim().min(1),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(MAX_ORDER_IMAGES_PER_PAGE).default(MAX_ORDER_IMAGES_PER_PAGE),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const orderImageResponseSchema = z.object({
  orderImageId: z.string(),
  orderId: z.string(),
  customerId: z.string().nullable(),
  deliveryId: z.string().nullable(),
  imageType: z.string().nullable(),
  imagePath: z.string().nullable(),
  notes: z.string().nullable(),
  quantity: z.number().nullable(),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
})

const imagePathSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'imagePath must start with http:// or https://',
  })

export const orderImageCreateSchema = z.object({
  orderId: z.string().trim().min(1),
  customerId: z.string().trim().min(1).nullable().default(null),
  deliveryId: z.string().trim().min(1).nullable().default(null),
  imageType: orderImageTypeSchema,
  imagePath: imagePathSchema,
  notes: z.string().trim().min(1).nullable().default(null),
  quantity: z.number().nonnegative().nullable().default(null),
  createdBy: z.string().trim().min(1),
}).superRefine((image, context) => {
  if (image.imageType === 'WEIGHT') {
    if (image.quantity === null || !isValidOrderImageWeight(image.quantity)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'WEIGHT quantity must be greater than 0, at most 200, and use at most one decimal place',
        path: ['quantity'],
      })
    }
    return
  }

  if (image.quantity !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'quantity is only allowed for WEIGHT images',
      path: ['quantity'],
    })
  }
})

export const orderImageUpdateSchema = z.never()

export const orderImageDetailResponseSchema = orderImageResponseSchema
export const orderImageCreateResponseSchema = orderImageResponseSchema

export const orderImageApiContract = {
  query: { list: orderImageListQuerySchema },
  request: { create: orderImageCreateSchema, update: orderImageUpdateSchema },
  response: {
    list: orderImageResponseSchema,
    detail: orderImageDetailResponseSchema,
    create: orderImageCreateResponseSchema,
  },
} satisfies ModuleApiContract
