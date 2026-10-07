import { z } from 'zod'

export const deliveryTrackingBagSchema = z.object({
  orderImageId: z.string(),
  bagIndex: z.number().int().positive(),
  weightKg: z.number(),
  thumbnailUrl: z.string().nullable(),
}).strict()

export const deliveryTrackingResponseSchema = z.object({
  orderImageId: z.string(),
  weightPhoto: z.object({
    url: z.string().nullable(),
    weightKg: z.number(),
    weighedAt: z.string(),
    note: z.string().nullable(),
  }).strict(),
  bagIndex: z.number().int().positive(),
  bagCount: z.number().int().positive(),
  otherBags: z.array(deliveryTrackingBagSchema),
  customerIndex: z.string(),
  orderId: z.string(),
  receivedDate: z.string(),
  statusLabel: z.string(),
  deliveredAt: z.string().nullable(),
  proofOfDeliveryUrl: z.string().nullable(),
}).strict()
