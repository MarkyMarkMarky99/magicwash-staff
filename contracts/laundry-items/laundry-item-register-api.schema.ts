import { z } from 'zod'
import { laundryTagIdSchema } from '../laundry-tag-prints/laundry-tag-print.schema.js'

const garmentSchema = z.object({
  tag: laundryTagIdSchema,
  imageUrl: z.string().url(),
  itemId: z.string().nullable(),
}).strict()

export const laundryItemRegisterRequestSchema = z.object({
  customerId: z.string().trim().min(1),
  garments: z.array(garmentSchema).min(1),
}).strict().superRefine((request, context) => {
  const seen = new Set<string>()
  request.garments.forEach((garment, index) => {
    if (seen.has(garment.tag)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['garments', index, 'tag'], message: 'Duplicate tag' })
    }
    seen.add(garment.tag)
  })
})
