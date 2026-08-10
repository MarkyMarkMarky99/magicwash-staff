import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const orderItemSchema = z.object({
  id: z.string().nullable(),
  description: z.string().nullable(),
  serviceType: z.string().nullable(),
  quantity: z.number().nullable(),
})

export const MAX_ORDERS_PER_PAGE = 500

export const orderListQuerySchema = z.object({
  // Required by ReadQueryDTO.fromQuery / GenericListQuery. Empty default is a
  // no-op: GViz ignores an empty keyword.
  keyword: z.string().default(''),
  customerId: z.string().trim().min(1),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_ORDERS_PER_PAGE)
    .default(MAX_ORDERS_PER_PAGE),
  sortBy: z.enum(['receivedDate']).default('receivedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const orderListResponseSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  orderNumber: z.string().nullable(),
  receivedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  serviceType: z.string().nullable(),
  status: z.string().nullable(),
  quantity: z.number().nullable(),
  note: z.string().nullable(),
  items: z.array(orderItemSchema),
})

export const orderApiContract = {
  query: { list: orderListQuerySchema },
  response: { list: orderListResponseSchema },
} satisfies ModuleApiContract
