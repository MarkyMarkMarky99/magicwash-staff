import { z } from 'zod'

export const packageTransactionTypeSchema = z.enum(['PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT', 'EXPIRE', 'VOID', 'TRANSFER'])
export const packageCreditMovementTypeSchema = packageTransactionTypeSchema.exclude(['PURCHASE'])
export const packageWriteFailureCertaintySchema = z.enum(['rejected', 'unknown'])

export const appendPackageTransactionRequestSchema = z.object({
  customerPackageId: z.string().trim().min(1),
  type: packageCreditMovementTypeSchema,
  creditChange: z.number().finite().refine((value) => value !== 0, { message: 'creditChange must not be zero' }),
  referenceSource: z.string().trim().min(1).nullable().optional().default(null),
  referenceId: z.string().trim().min(1).nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
  createdBy: z.string().trim().min(1),
}).strict().refine((data) => data.type !== 'USAGE' || data.creditChange < 0, {
  message: 'USAGE creditChange must be negative', path: ['creditChange'],
}).refine((data) => data.type !== 'REFUND' || data.creditChange > 0, {
  message: 'REFUND creditChange must be positive', path: ['creditChange'],
})

export const appendPackageTransactionSuccessSchema = z.object({ kind: z.literal('created'), transactionId: z.string(), customerPackageId: z.string(), customerId: z.string(), type: packageCreditMovementTypeSchema, creditChange: z.number(), createdAt: z.string() })
export const appendPackageTransactionValidationErrorSchema = z.object({ kind: z.literal('validation_error'), issues: z.array(z.object({ path: z.string(), message: z.string() })) })
export const appendPackageTransactionPackageNotFoundSchema = z.object({ kind: z.literal('package_not_found'), customerPackageId: z.string() })
export const appendPackageTransactionLookupFailedSchema = z.object({ kind: z.literal('package_lookup_failed'), customerPackageId: z.string(), message: z.string() })
export const appendPackageTransactionWriteFailedSchema = z.object({ kind: z.literal('transaction_write_failed'), customerPackageId: z.string(), message: z.string(), certainty: packageWriteFailureCertaintySchema })
export const appendPackageTransactionResponseSchema = z.discriminatedUnion('kind', [appendPackageTransactionSuccessSchema, appendPackageTransactionValidationErrorSchema, appendPackageTransactionPackageNotFoundSchema, appendPackageTransactionLookupFailedSchema, appendPackageTransactionWriteFailedSchema])
