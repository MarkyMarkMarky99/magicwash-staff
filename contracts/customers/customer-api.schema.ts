import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const customerTypeSchema = z.enum(['Member', 'Regular', 'Corporate'])
export const customerSourceSchema = z.enum(['Facebook Ads', 'Google Ads'])
export const preferredContactMethodSchema = z.enum(['Line', 'Messenger'])

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a valid YYYY-MM-DD date')

const phoneSchema = z.string()

export const customerCreateSchema = z.object({
  customerName: z.string().min(1),
  phone: phoneSchema.min(1),
  address: z.string().nullish(),
  location: z.string().nullish(),
  registeredDate: isoDateSchema.nullish(),
  facebook: z.string().nullish(),
  lineId: z.string().nullish(),
  whatsapp: z.string().nullish(),
  email: z.string().nullish(),
  customerType: customerTypeSchema.nullish(),
  source: customerSourceSchema.nullish(),
  updatedBy: z.string().min(1),
})

export const customerUpdateSchema = z
  .object({
    customerName: z.string().min(1).optional(),
    phone: phoneSchema.nullable().optional(),
    address: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    registeredDate: isoDateSchema.nullable().optional(),
    facebook: z.string().nullable().optional(),
    lineId: z.string().nullable().optional(),
    whatsapp: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    customerType: customerTypeSchema.nullable().optional(),
    source: customerSourceSchema.nullable().optional(),
    updatedBy: z.string().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

export const customerSortFieldSchema = z.enum(['customerIndex', 'registeredDate'])

export const MAX_CUSTOMERS_PER_PAGE = 2000

export const customerListQuerySchema = z.object({
  keyword: z.string().default(''),
  customerType: customerTypeSchema.nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_CUSTOMERS_PER_PAGE)
    .default(MAX_CUSTOMERS_PER_PAGE),
  sortBy: customerSortFieldSchema.default('customerIndex'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const customerListResponseSchema = z.object({
  customerId: z.string(),
  customerIndex: z.string(),
  customerName: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  location: z.string().nullable(),
  customerType: customerTypeSchema.nullable(),
})

export const customerDetailResponseSchema = customerListResponseSchema.extend({
  registeredDate: z.string().nullable(),
  facebook: z.string().nullable(),
  lineId: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
})

export const customerCreateResponseSchema = customerDetailResponseSchema
export const customerUpdateResponseSchema = customerDetailResponseSchema

export const customerApiContract = {
  query: {
    list: customerListQuerySchema,
  },
  request: {
    create: customerCreateSchema,
    update: customerUpdateSchema,
  },
  response: {
    list: customerListResponseSchema,
    detail: customerDetailResponseSchema,
    create: customerCreateResponseSchema,
    update: customerUpdateResponseSchema,
  },
} satisfies ModuleApiContract
