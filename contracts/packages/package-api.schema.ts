import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

/** Sortable API fields. Each must map to a physical Packages column. */
export const packageSortFieldSchema = z.enum([
  'packageCode',
  'name',
  'eligibleService',
  'includedCredit',
  'price',
])

/**
 * Every non-reserved key here becomes a GViz equality `where` on the mapped
 * column, so no key may exist that the field map cannot resolve.
 */
export const packageListQuerySchema = z.object({
  keyword: z.string().default(''),
  packageCode: z.string().trim().min(1).nullable().optional().default(null),
  eligibleService: z.string().trim().min(1).nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(200).default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: packageSortFieldSchema.default('packageCode'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

/**
 * One response shape for list, detail, create and update. `deletedAt` non-null
 * means the catalog entry is retired from sale; the row is never removed.
 */
export const packageResponseSchema = z.object({
  packageCode: z.string(),
  name: z.string(),
  eligibleService: z.string(),
  includedCredit: z.number(),
  price: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
})

/** `packageCode` is the primary key: supplied here, immutable afterwards. */
export const packageCreateRequestSchema = z.object({
  packageCode: z.string().trim().min(1).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1),
  eligibleService: z.string().trim().min(1),
  includedCredit: z.number().int().nonnegative(),
  price: z.number().nonnegative(),
  notes: z.string().trim().min(1).nullable().default(null),
  createdBy: z.string().trim().min(1),
}).strict()

/**
 * `active: false` deactivates, `true` reactivates; the server owns the
 * `deletedAt` timestamp. `packageCode` is deliberately absent.
 */
export const packageUpdateRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  eligibleService: z.string().trim().min(1).optional(),
  includedCredit: z.number().int().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional(),
  updatedBy: z.string().trim().min(1),
}).strict()

export const packageApiContract = {
  query: { list: packageListQuerySchema },
  request: { create: packageCreateRequestSchema, update: packageUpdateRequestSchema },
  response: {
    list: packageResponseSchema,
    detail: packageResponseSchema,
    create: packageResponseSchema,
    update: packageResponseSchema,
  },
} satisfies ModuleApiContract
