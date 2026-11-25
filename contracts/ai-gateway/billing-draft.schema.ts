import { z } from 'zod'

const billingCitationSchema = z.object({
  invoiceItemId: z.string(),
  invoiceNumber: z.string(),
  issuedDate: z.string(),
  customerId: z.string(),
  orderId: z.string().nullable(),
  tagId: z.string().nullable(),
  photoUrl: z.string().nullable(),
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number(),
})

const billingPriceListRowSchema = z.object({
  itemCode: z.string(),
  serviceType: z.string(),
  priceGroup: z.string(),
  unit: z.string(),
  price: z.number(),
})

const billingDraftLineSchema = z.object({
  orderId: z.string().optional(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitPrice: z.number().nullable(),
  orderItemIds: z.array(z.string()),
  source: z.enum(['customer-history', 'other-history', 'price-list', 'chat', 'needs-price']),
  photoMatch: z.enum(['exact', 'probable', 'none']).nullable(),
  reason: z.string(),
  citations: z.array(billingCitationSchema),
  priceListRow: billingPriceListRowSchema.nullable(),
})

export const billingDraftSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  lines: z.array(billingDraftLineSchema),
  warnings: z.array(z.object({ message: z.string(), lineIndex: z.number().int().nullable() })),
})

export type BillingDraft = z.infer<typeof billingDraftSchema>
export type BillingDraftLine = BillingDraft['lines'][number]
