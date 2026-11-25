import { z } from 'zod'

const billingCitationSchema = z.object({
  invoiceItemId: z.string(),
  invoiceNumber: z.string(),
  issuedDate: z.string(),
  customerId: z.string(),
  orderId: z.string().nullable(),
  tagId: z.string().nullable(),
  photoUrl: z.string().nullable(),
  unitPrice: z.number(),
})

const billingPriceListRowSchema = z.object({
  itemCode: z.string(),
  serviceType: z.string(),
  priceGroup: z.string(),
  price: z.number(),
})

const billingDraftLineSchema = z.object({
  orderItemId: z.string(),
  description: z.string(),
  unit: z.string(),
  quantity: z.number(),
  unitPrice: z.number().nullable(),
  source: z.enum(['customer-history', 'other-history', 'price-list', 'needs-price']),
  photoMatch: z.enum(['exact', 'probable', 'none']).nullable(),
  citations: z.array(billingCitationSchema),
  priceListRow: billingPriceListRowSchema.nullable(),
  priceListPrice: z.number().nullable(),
  otherPrices: z.array(z.number()),
  note: z.string(),
})

export const billingDraftSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  lines: z.array(billingDraftLineSchema),
  warnings: z.array(z.object({ message: z.string(), orderItemId: z.string().nullable() })),
})

export type BillingDraft = z.infer<typeof billingDraftSchema>
export type BillingDraftLine = BillingDraft['lines'][number]
