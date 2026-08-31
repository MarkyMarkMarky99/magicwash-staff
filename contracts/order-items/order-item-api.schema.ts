import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

// Exported for the orders contract's header serviceType in a later task.
export const orderServiceTypeSchema = z.enum(['WSIR', 'IRON', 'DRCL', 'WASH'])

export const MAX_ORDER_ITEMS_PER_PAGE = 500

export const orderItemListQuerySchema = z.object({
  keyword: z.string().default(''),
  orderId: z.string().trim().min(1),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(MAX_ORDER_ITEMS_PER_PAGE).default(MAX_ORDER_ITEMS_PER_PAGE),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const orderItemResponseSchema = z.object({
  orderItemId: z.string(),
  orderId: z.string().nullable(),
  itemId: z.string().nullable(),
  description: z.string().nullable(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  creditsUsed: z.number().nullable(),
  serviceType: z.string().nullable(),
  specialInstructions: z.string().nullable(),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
})

export const orderItemCreateSchema = z.object({
  orderId: z.string().trim().min(1),
  itemId: z.string().trim().min(1).nullable().default(null),
  description: z.string().trim().min(1).nullable().default(null),
  quantity: z.number().positive(),
  price: z.number().nonnegative().nullable().default(null),
  specialInstructions: z.string().trim().min(1).nullable().default(null),
  createdBy: z.string().trim().min(1),
})

export const orderItemUpdateSchema = z.never()

export const orderItemDetailResponseSchema = orderItemResponseSchema
export const orderItemCreateResponseSchema = orderItemResponseSchema

export const orderItemApiContract = {
  query: { list: orderItemListQuerySchema },
  request: { create: orderItemCreateSchema, update: orderItemUpdateSchema },
  response: {
    list: orderItemResponseSchema,
    detail: orderItemDetailResponseSchema,
    create: orderItemCreateResponseSchema,
  },
} satisfies ModuleApiContract
