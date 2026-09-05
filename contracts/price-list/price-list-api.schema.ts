import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'
import { serviceTypeSchema } from '../shared/service-type.schema.js'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

export const priceListSortFieldSchema = z.enum([
  'itemCode',
  'category',
  'subcategory',
  'itemType',
  'displayNameTh',
  'serviceType',
  'priceGroup',
  'price',
  'effectiveFrom',
])

export const priceListListQuerySchema = z.object({
  keyword: z.string().default(''),
  itemCode: z.string().trim().min(1).nullable().optional().default(null),
  category: z.string().trim().min(1).nullable().optional().default(null),
  subcategory: z.string().trim().min(1).nullable().optional().default(null),
  itemType: z.string().trim().min(1).nullable().optional().default(null),
  serviceType: serviceTypeSchema.nullable().optional().default(null),
  priceGroup: z.string().trim().min(1).nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(1000).default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: priceListSortFieldSchema.default('itemCode'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const priceListListResponseSchema = z.object({
  id: z.string(),
  itemCode: z.string(),
  category: z.string(),
  subcategory: z.string(),
  itemType: z.string(),
  variant: z.string().nullable(),
  displayNameTh: z.string(),
  displayNameEn: z.string().nullable(),
  serviceType: serviceTypeSchema,
  priceGroup: z.string(),
  unit: z.string().nullable(),
  price: z.number().nonnegative(),
  creditEligible: z.boolean(),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable(),
  active: z.boolean(),
})

const priceListBusinessFields = {
  itemCode: z.string().regex(/^ITM-[0-9]{4,}$/),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  itemType: z.string().min(1),
  variant: z.string().min(1).nullable().optional(),
  displayNameTh: z.string().min(1),
  displayNameEn: z.string().min(1).nullable().optional(),
  serviceType: serviceTypeSchema,
  priceGroup: z.string().min(1),
  unit: z.string().min(1).nullable().optional(),
  price: z.number().nonnegative(),
  creditEligible: z.boolean(),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable().optional(),
  active: z.boolean(),
}

export const priceListCreateSchema = z.object(priceListBusinessFields).extend({
  itemCode: priceListBusinessFields.itemCode.optional(),
}).strict()

export const priceListUpdateSchema = z.object(priceListBusinessFields).omit({ itemCode: true }).partial().strict()

export const priceListCreateResponseSchema = priceListListResponseSchema
export const priceListUpdateResponseSchema = priceListListResponseSchema

export const priceListApiContract = {
  query: { list: priceListListQuerySchema },
  request: {
    create: priceListCreateSchema,
    update: priceListUpdateSchema,
  },
  response: {
    list: priceListListResponseSchema,
    create: priceListCreateResponseSchema,
    update: priceListUpdateResponseSchema,
  },
} satisfies ModuleApiContract
