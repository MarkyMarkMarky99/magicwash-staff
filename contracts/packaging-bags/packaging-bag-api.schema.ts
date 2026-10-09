import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

export const packagingBagConfirmRequestSchema = z.object({
  orderId: z.string().trim().min(1),
  createdBy: z.string().trim().min(1),
  bags: z.array(z.object({
    orderImageId: z.string().regex(/^[0-9a-f]{8}$/).refine(id => !/^[0-9]+(e[0-9]+)?$/.test(id), 'Invalid bag ID'),
    imagePath: z.string().url().regex(/^https?:\/\//, 'Bag photo must be an http(s) URL'),
    laundryItemIds: z.array(z.string().trim().min(1)).min(1, 'Each bag needs at least one garment'),
  }).strict()).min(1).max(20),
}).strict().superRefine((request, context) => {
  const garments = new Set<string>()
  const bags = new Set<string>()
  for (const [index, bag] of request.bags.entries()) {
    if (bags.has(bag.orderImageId)) context.addIssue({ code: 'custom', path: ['bags', index, 'orderImageId'], message: 'Bag IDs must be unique' })
    bags.add(bag.orderImageId)
    for (const id of bag.laundryItemIds) {
      if (garments.has(id)) context.addIssue({ code: 'custom', path: ['bags', index, 'laundryItemIds'], message: 'A garment can appear in only one bag' })
      garments.add(id)
    }
  }
})

export const packagingBagConfirmResponseSchema = z.object({
  bags: z.array(z.object({ orderImageId: z.string(), printed: z.boolean() })),
})

export const packagingBagApiContract = {
  query: { list: z.never() },
  request: { create: packagingBagConfirmRequestSchema, update: z.never() },
  response: { list: packagingBagConfirmResponseSchema, create: packagingBagConfirmResponseSchema },
} satisfies ModuleApiContract

export type PackagingBagConfirmRequest = z.infer<typeof packagingBagConfirmRequestSchema>
export type PackagingBagConfirmResponse = z.infer<typeof packagingBagConfirmResponseSchema>
