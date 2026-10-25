import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'
import { orderServiceTypeSchema } from '../order-items/order-item-api.schema.js'
import { laundryTagIdSchema } from '../laundry-tag-prints/laundry-tag-print.schema.js'

export const orderIntakeCreateSchema = z.object({
  customerId: z.string().trim().min(1),
  receivedDate: z.string().date(),
  dueDate: z.string().date(),
  serviceType: orderServiceTypeSchema,
  orderName: z.string().trim().min(1).nullable(),
  note: z.string().trim().min(1).nullable(),
  items: z.array(z.object({
    itemId: z.string().trim().min(1),
    tags: z.array(laundryTagIdSchema).min(1),
  }).strict()).min(1),
  images: z.array(z.object({
    imageType: z.enum(['DOCUMENT', 'BELONGING']),
    imageUrl: z.string(),
  }).strict()),
}).strict().superRefine((data, context) => {
  const seen = new Set<string>()
  for (const [index, item] of data.items.entries()) {
    for (const tag of item.tags) {
      if (seen.has(tag)) context.addIssue({ code: 'custom', path: ['items', index, 'tags'], message: `Duplicate tag: ${tag}` })
      seen.add(tag)
    }
  }
})

export const orderIntakeCreateResponseSchema = z.object({
  orderId: z.string(),
  status: z.enum(['APPROVED', 'PENDING']),
  ticketsCreated: z.number().int().nonnegative(),
  failed: z.array(z.string()),
})

export const orderIntakeApiContract = {
  query: { list: z.never() },
  request: { create: orderIntakeCreateSchema, update: z.never() },
  response: { list: orderIntakeCreateResponseSchema, create: orderIntakeCreateResponseSchema },
} satisfies ModuleApiContract
