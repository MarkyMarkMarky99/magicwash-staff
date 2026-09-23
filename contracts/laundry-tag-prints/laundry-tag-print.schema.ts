import { z } from 'zod'

export const laundryTagIdSchema = z.string().regex(/^[0-9A-Za-z]{8}$/)

const tagSchema = z.object({
  sequence: z.number().int().positive().max(999),
  tagId: laundryTagIdSchema,
}).strict()

export const laundryTagPrintRequestSchema = z.object({
  customerIndex: z.string().trim().regex(/^[A-Za-z0-9_-]{1,8}$/),
  totalCount: z.number().int().positive().max(999),
  tags: z.array(tagSchema).min(1).max(999),
}).strict().superRefine((request, context) => {
  if (request.tags.length !== request.totalCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tags'], message: 'Tag count must match totalCount' })
  }

  const seenIds = new Set<string>()
  request.tags.forEach((tag, index) => {
    if (tag.sequence !== index + 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tags', index, 'sequence'], message: 'Tags must be sequential' })
    }
    if (seenIds.has(tag.tagId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['tags', index, 'tagId'], message: 'Tag IDs must be unique' })
    }
    seenIds.add(tag.tagId)
  })
})

export const laundryTagPrintResponseSchema = z.object({
  success: z.literal(true),
  accepted: z.literal(true),
  printerName: z.string().min(1),
  totalCount: z.number().int().positive().max(999),
}).strict()

export type LaundryTagPrintRequest = z.infer<typeof laundryTagPrintRequestSchema>
export type LaundryTagPrintResponse = z.infer<typeof laundryTagPrintResponseSchema>
