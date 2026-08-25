import { z } from 'zod'
import { packageWriteFailureCertaintySchema } from './package-transaction-api.schema.js'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
export const customerPackageServiceDaySchema = z.enum(['SUN', 'MON', 'WED', 'THU', 'FRI', 'SAT'])
export const customerPackageTimeSlotSchema = z.enum(['10:00-12:00', '13:00-15:00', '15:00-17:00', '18:00-20:00'])
export const createCustomerPackageRequestSchema = z.object({
  customerId: z.string().trim().min(1), packageCode: z.string().trim().min(1), invoiceId: z.string().trim().min(1).nullable().optional().default(null), startDate: isoDateSchema.nullable().optional().default(null), expiryDate: isoDateSchema.nullable().optional().default(null), serviceDay: customerPackageServiceDaySchema.nullable().optional().default(null), timeSlot: customerPackageTimeSlotSchema.nullable().optional().default(null), notes: z.string().nullable().optional().default(null), createdBy: z.string().trim().min(1),
}).strict()
export const createCustomerPackageSuccessSchema = z.object({ kind: z.literal('created'), customerPackageId: z.string(), customerId: z.string(), packageCode: z.string(), openingCredit: z.number(), transactionId: z.string(), createdAt: z.string() })
export const createCustomerPackageValidationErrorSchema = z.object({ kind: z.literal('validation_error'), issues: z.array(z.object({ path: z.string(), message: z.string() })) })
export const createCustomerPackageCatalogReadFailedSchema = z.object({ kind: z.literal('catalog_read_failed'), packageCode: z.string(), message: z.string() })
export const createCustomerPackageOpeningTransactionFailedSchema = z.object({ kind: z.literal('opening_transaction_write_failed'), customerPackageId: z.string(), message: z.string(), certainty: packageWriteFailureCertaintySchema })
export const createCustomerPackagePackageWriteFailedSchema = z.object({ kind: z.literal('package_write_failed'), customerPackageId: z.string(), transactionId: z.string(), openingCredit: z.number(), message: z.string(), certainty: packageWriteFailureCertaintySchema })
export const createCustomerPackageResponseSchema = z.discriminatedUnion('kind', [createCustomerPackageSuccessSchema, createCustomerPackageValidationErrorSchema, createCustomerPackageCatalogReadFailedSchema, createCustomerPackageOpeningTransactionFailedSchema, createCustomerPackagePackageWriteFailedSchema])
