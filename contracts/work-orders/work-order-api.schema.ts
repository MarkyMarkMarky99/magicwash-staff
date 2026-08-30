import { z } from 'zod'
import { orderItemCreateSchema, orderItemResponseSchema, orderServiceTypeSchema } from '../order-items/order-item-api.schema.js'
import { API_PAGINATION_DEFAULTS as apiPaginationDefaults } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const MAX_WORK_ORDERS_PER_PAGE = 500

export const workOrderListQuerySchema = z.object({
  keyword: z.string().default(''),
  customerId: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(apiPaginationDefaults.page),
  perPage: z.coerce.number().int().positive().max(MAX_WORK_ORDERS_PER_PAGE).default(MAX_WORK_ORDERS_PER_PAGE),
  sortBy: z.enum(['receivedDate']).default('receivedDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const workOrderListResponseSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  orderNumber: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  receivedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  serviceType: z.string().nullable(),
  status: z.string().nullable(),
  quantity: z.number().nullable(),
  hangers: z.number().nullable(),
  bags: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().nullable(),
})

export const workOrderDetailResponseSchema = workOrderListResponseSchema.extend({
  orderName: z.string().nullable(),
  orderDescription: z.string().nullable(),
  formImage: z.string().nullable(),
  hangersImage: z.string().nullable(),
  bagsImage: z.string().nullable(),
  createdBy: z.string().nullable(),
  items: z.array(orderItemResponseSchema),
})

export const workOrderCreateItemSchema = orderItemCreateSchema.omit({ orderId: true, createdBy: true })

export const workOrderCreateSchema = z.object({
  customerId: z.string().trim().min(1),
  receivedDate: z.string().trim().min(1),
  dueDate: z.string().trim().min(1),
  serviceType: orderServiceTypeSchema,
  quantity: z.number().nonnegative().nullable().default(null),
  hangers: z.number().int().nonnegative().nullable().default(null),
  bags: z.number().int().nonnegative().nullable().default(null),
  note: z.string().trim().min(1).nullable().default(null),
  orderName: z.string().trim().min(1).nullable().default(null),
  orderDescription: z.string().trim().min(1).nullable().default(null),
  createdBy: z.string().trim().min(1),
  items: z.array(workOrderCreateItemSchema).default([]),
})

export const workOrderCreateResponseSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string().nullable(),
  customerId: z.string(),
  receivedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  serviceType: z.string().nullable(),
  status: z.string().nullable(),
  quantity: z.number().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  itemsRequested: z.number(),
  itemsCreated: z.number(),
  itemsFailed: z.boolean(),
  itemsError: z.string().nullable(),
})

export const workOrderUpdateSchema = z.never()

export const workOrderApiContract = {
  query: { list: workOrderListQuerySchema },
  request: { create: workOrderCreateSchema, update: workOrderUpdateSchema },
  response: {
    list: workOrderListResponseSchema,
    detail: workOrderDetailResponseSchema,
    create: workOrderCreateResponseSchema,
  },
} satisfies ModuleApiContract
