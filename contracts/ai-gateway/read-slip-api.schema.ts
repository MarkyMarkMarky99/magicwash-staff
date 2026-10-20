import { z } from 'zod'

export const readSlipInputSchema = z.object({ priceGroup: z.string() })

const slipDateSchema = z.object({ text: z.string().nullable(), date: z.string().nullable() })
const countSchema = z.number().int().min(0).nullable()

export const readSlipResultSchema = z.object({
  priceGroup: z.string(),
  header: z.object({
    senderName: z.string().nullable(),
    collectionDate: slipDateSchema,
    deliveryDate: slipDateSchema,
    receiverName: z.string().nullable(),
    totalWeight: z.string().nullable(),
  }),
  items: z.array(z.object({
    itemCode: z.string(), nameTh: z.string(), nameEn: z.string().nullable(), count: countSchema,
  })),
  unlisted: z.array(z.object({ name: z.string(), count: countSchema })),
  warnings: z.array(z.object({ field: z.string(), source: z.enum(['ai', 'rule']), message: z.string() })),
})
