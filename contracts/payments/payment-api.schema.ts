import { z } from 'zod'
import { API_PAGINATION_DEFAULTS } from '../shared/api.schema.js'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const paymentMethodSchema = z.enum([
  'CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'QR_PROMPTPAY', 'GIFT_VOUCHER', 'OTHER',
])

// Accepts null as well: the client sends this schema's own parsed output, so it must re-parse.
const optionalTextSchema = z.string().trim().nullish().transform((value) => value || null)

const paidAtSchema = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'must use yyyy-MM-dd HH:mm:ss')

export const paymentCreateSchema = z.object({
  invoiceNumber: z.string().trim().min(1),
  amount: z.number().finite().refine((value) => value !== 0, 'amount must not be zero'),
  method: paymentMethodSchema,
  paidAt: paidAtSchema.optional(),
  reference: optionalTextSchema,
  proofUrl: optionalTextSchema,
  notes: optionalTextSchema,
}).strict()

export const paymentResponseSchema = z.object({
  paymentId: z.string(),
  invoiceNumber: z.string(),
  amount: z.number(),
  method: paymentMethodSchema,
  status: z.literal('VERIFIED'),
  paidAt: z.string(),
  reference: z.string().nullable(),
  proofUrl: z.string().nullable(),
  notes: z.string().nullable(),
})

// Staff review of a PENDING payment (e.g. a slip the verifier could not read).
// REJECT requires a note so the reason is recorded.
export const paymentReviewSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('VERIFY'),
    amount: z.number().finite().refine((value) => value !== 0, 'amount must not be zero'),
    paidAt: paidAtSchema.optional(),
    notes: optionalTextSchema,
  }).strict(),
  z.object({
    action: z.literal('REJECT'),
    notes: z.string().trim().min(1, 'a rejection note is required'),
  }).strict(),
])

export const paymentReviewResponseSchema = z.object({
  paymentId: z.string(),
  invoiceNumber: z.string(),
  amount: z.number().nullable(),
  method: paymentMethodSchema,
  status: z.enum(['VERIFIED', 'FAILED']),
  paidAt: z.string().nullable(),
  reference: z.string().nullable(),
  proofUrl: z.string().nullable(),
  notes: z.string().nullable(),
})

export const paymentListQuerySchema = z.object({
  keyword: z.string().default(''),
  page: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.page),
  perPage: z.coerce.number().int().positive().default(API_PAGINATION_DEFAULTS.perPage),
  sortBy: z.enum(['paidAt']).default('paidAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const paymentApiContract = {
  query: { list: paymentListQuerySchema },
  request: { create: paymentCreateSchema, update: paymentReviewSchema },
  response: {
    list: paymentResponseSchema,
    create: paymentResponseSchema,
    update: paymentReviewResponseSchema,
  },
} satisfies ModuleApiContract
