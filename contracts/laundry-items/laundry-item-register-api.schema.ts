import { z } from 'zod'
import { laundryTagIdSchema } from '../laundry-tag-prints/laundry-tag-print.schema.js'

const garmentSchema = z.object({
  tag: laundryTagIdSchema,
  imageUrl: z.string().url(),
  itemId: z.string().nullable(),
}).strict()

export const laundryItemRegisterRequestSchema = z.object({
  customerId: z.string().trim().min(1),
  garments: z.array(garmentSchema).min(1).superRefine((garments, context) => {
    const seen = new Set<string>()
    garments.forEach((garment, index) => {
      if (seen.has(garment.tag)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'tag'], message: 'Duplicate tag' })
      }
      seen.add(garment.tag)
    })
  }),
}).strict()

export const laundryItemRegisterResponseSchema = z.object({
  registered: z.array(laundryTagIdSchema),
  alreadyRegistered: z.array(laundryTagIdSchema),
  failed: z.array(laundryTagIdSchema),
  aiTriggered: z.boolean(),
})
