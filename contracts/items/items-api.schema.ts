import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

const requiredName = z.string().trim().min(1)
const nullableName = requiredName.nullable().optional()

export const itemsListQuerySchema = z.object({
  keyword: z.string().default(''),
  itemCode: requiredName.nullable().optional().default(null),
  category: requiredName.nullable().optional().default(null),
  subcategory: requiredName.nullable().optional().default(null),
  itemType: requiredName.nullable().optional().default(null),
  active: z.enum(['true', 'false']).transform((value) => value === 'true').nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(1000).default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: z.enum(['itemCode', 'category', 'subcategory', 'itemType', 'displayNameTh', 'displayNameEn', 'active']).default('itemCode'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export const itemsResponseSchema = z.object({
  id: z.string(),
  itemCode: z.string(),
  category: z.string(),
  subcategory: z.string(),
  itemType: z.string(),
  variant: z.string().nullable(),
  displayNameTh: z.string(),
  displayNameEn: z.string().nullable(),
  active: z.boolean(),
  imageUrl: z.string().nullable(),
})

export const itemsCreateSchema = z.object({
  category: requiredName,
  subcategory: requiredName,
  itemType: requiredName,
  variant: nullableName,
  displayNameTh: requiredName,
  displayNameEn: nullableName,
  active: z.boolean().default(true),
  imageUrl: nullableName,
}).strict()

export const itemsUpdateSchema = itemsCreateSchema.partial().strict()

export const itemsApiContract = {
  query: { list: itemsListQuerySchema },
  request: { create: itemsCreateSchema, update: itemsUpdateSchema },
  response: {
    list: itemsResponseSchema,
    detail: itemsResponseSchema,
    create: itemsResponseSchema,
    update: itemsResponseSchema,
  },
} satisfies ModuleApiContract
