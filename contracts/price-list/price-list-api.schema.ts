import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const priceListSortFieldSchema = z.enum([
  'itemCode',
  'category',
  'subcategory',
  'itemType',
  'displayNameTh',
  'effectiveFrom',
])

export const priceListListQuerySchema = z.object({
  keyword: z.string().default(''),
  itemCode: z.string().trim().min(1).nullable().optional().default(null),
  category: z.string().trim().min(1).nullable().optional().default(null),
  subcategory: z.string().trim().min(1).nullable().optional().default(null),
  itemType: z.string().trim().min(1).nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(100).default(API_PAGINATION_DEFAULTS.perPage),
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
  washDryIronPrice: z.number().nullable(),
  ironOnlyPrice: z.number().nullable(),
  dryCleanPrice: z.number().nullable(),
  creditEligible: z.boolean(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  active: z.boolean(),
})

export const priceListApiContract = {
  query: { list: priceListListQuerySchema },
  response: { list: priceListListResponseSchema },
} satisfies ModuleApiContract
