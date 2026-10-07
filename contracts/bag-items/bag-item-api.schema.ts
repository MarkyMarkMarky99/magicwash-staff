import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const MAX_BAG_ITEMS_PER_PAGE = 500

export const bagItemListQuerySchema = z.object({
  keyword: z.string().default(''),
  bagId: z.string().trim().min(1).optional(),
  orderId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(MAX_BAG_ITEMS_PER_PAGE).default(MAX_BAG_ITEMS_PER_PAGE),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).refine((query) => query.bagId !== undefined || query.orderId !== undefined, {
  message: 'bagId or orderId is required',
})

export const bagItemResponseSchema = z.object({
  bagItemId: z.string(),
  bagId: z.string(),
  orderId: z.string(),
  laundryItemId: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
})

export const bagItemCreateSchema = z.object({
  bagId: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  laundryItemId: z.string().trim().min(1),
  createdBy: z.string().trim().min(1),
}).strict()

export const bagItemApiContract = {
  query: { list: bagItemListQuerySchema },
  request: { create: bagItemCreateSchema, update: z.never() },
  response: { list: bagItemResponseSchema, create: bagItemResponseSchema },
} satisfies ModuleApiContract
