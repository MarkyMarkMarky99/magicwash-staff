import { z } from 'zod'
import type { SheetContract } from '../../shared/contracts/sheet-contract.js'

const paymentMethodSchema = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'CREDIT_CARD',
  'QR_PROMPTPAY',
  'GIFT_VOUCHER',
  'OTHER',
])
const paymentStatusSchema = z.enum(['PENDING', 'VERIFIED', 'FAILED', 'CANCELLED'])

/** KEY ORDER = physical Payments sheet column order. */
export const paymentsRowSchema = z
  .object({
    payment_id: z.string().min(1),
    invoice_number: z.string().min(1),
    amount: z.number().nullable(),
    method: paymentMethodSchema,
    status: paymentStatusSchema,
    paid_at: z.string().nullable(),
    reference: z.string().nullable(),
    proof_url: z.string().nullable(),
    slip_data: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: z.string().nullable(),
    created_by: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().nullable(),
    deleted_at: z.string().nullable(),
    deleted_by: z.string().nullable(),
  })
  .strict()

export const paymentsDbContract = {
  row: paymentsRowSchema,
  primaryKey: 'payment_id',
  sheetName: 'Payments',
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract
