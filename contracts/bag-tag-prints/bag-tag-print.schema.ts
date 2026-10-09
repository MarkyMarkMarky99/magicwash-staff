import { z } from 'zod'

export const bagTagCustomerIndexSchema = z.string().regex(/^[A-Za-z0-9 ._:\-]*$/)

export const bagTagPrintRequestSchema = z.object({
  qrValue: z.string().min(1).max(64).regex(/^[\x20-\x7e]+$/),
  barcodeValue: z.string().min(1).max(32).regex(/^[\x20-\x7e]+$/),
  customerIndex: bagTagCustomerIndexSchema.nullable(),
  weightKg: z.number().finite().gt(0).lt(1000).nullable(),
  itemCount: z.number().int().positive().nullable(),
  packedAt: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
}).strict()

export const bagTagPrintResponseSchema = z.object({
  success: z.literal(true),
  accepted: z.literal(true),
  printerName: z.string().min(1),
  totalCount: z.literal(1),
}).strict()

export type BagTagPrintRequest = z.infer<typeof bagTagPrintRequestSchema>
export type BagTagPrintResponse = z.infer<typeof bagTagPrintResponseSchema>
