import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const issueReportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

const screenshotUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'screenshotUrl must start with http:// or https://',
  })

export const issueReportCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  screenshotUrl: screenshotUrlSchema.nullish(),
  createdBy: z.string().trim().min(1),
})

export const issueReportUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    status: issueReportStatusSchema.optional(),
    screenshotUrl: screenshotUrlSchema.nullable().optional(),
    updatedBy: z.string().trim().min(1),
  })
  .refine(
    (data) => Object.entries(data).some(([key, value]) => key !== 'updatedBy' && value !== undefined),
    { message: 'At least one updatable field is required' },
  )

export const issueReportSortFieldSchema = z.enum(['createdAt'])

export const MAX_ISSUE_REPORTS_PER_PAGE = 500

export const issueReportListQuerySchema = z.object({
  keyword: z.string().default(''),
  status: issueReportStatusSchema.nullable().optional().default(null),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().max(MAX_ISSUE_REPORTS_PER_PAGE).default(MAX_ISSUE_REPORTS_PER_PAGE),
  sortBy: issueReportSortFieldSchema.default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Key order = DTO key order. Every column is exposed, so detail/create/update reuse this shape.
export const issueReportListResponseSchema = z.object({
  issueReportId: z.string(),
  title: z.string(),
  description: z.string(),
  status: issueReportStatusSchema,
  screenshotUrl: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
})

export const issueReportDetailResponseSchema = issueReportListResponseSchema
export const issueReportCreateResponseSchema = issueReportListResponseSchema
export const issueReportUpdateResponseSchema = issueReportListResponseSchema

export const issueReportApiContract = {
  query: { list: issueReportListQuerySchema },
  request: { create: issueReportCreateSchema, update: issueReportUpdateSchema },
  response: {
    list: issueReportListResponseSchema,
    detail: issueReportDetailResponseSchema,
    create: issueReportCreateResponseSchema,
    update: issueReportUpdateResponseSchema,
  },
} satisfies ModuleApiContract
