import type { z } from 'zod'
import type { customerPackagesRowSchema } from '../../sheets/CustomerPackages/CustomerPackages.db-contract.js'
import type { packageTransactionsRowSchema } from '../../sheets/PackageTransactions/PackageTransactions.db-contract.js'
import type { packagesRowSchema } from '../../sheets/Packages/Packages.db-contract.js'

type CustomerPackagesDbRow = z.infer<typeof customerPackagesRowSchema>
type PackageTransactionsDbRow = z.infer<typeof packageTransactionsRowSchema>
type PackagesDbRow = z.infer<typeof packagesRowSchema>

export const customerPackagesFieldMap = {
  id: 'customerPackageId', customer_id: 'customerId', package_code: 'packageCode', start_date: 'startDate', expiry_date: 'expiryDate', service_day: 'serviceDay', time_slot: 'timeSlot', invoice_id: 'invoiceId', notes: 'notes', created_at: 'createdAt', created_by: 'createdBy', updated_at: 'updatedAt', updated_by: 'updatedBy', deleted_at: 'deletedAt', deleted_by: 'deletedBy',
} as const satisfies Record<keyof CustomerPackagesDbRow & string, string>

export const packageTransactionsFieldMap = {
  id: 'transactionId', customer_package_id: 'customerPackageId', customer_id: 'customerId', type: 'type', reference_source: 'referenceSource', reference_id: 'referenceId', credit_change: 'creditChange', notes: 'notes', created_at: 'createdAt', created_by: 'createdBy',
} as const satisfies Record<keyof PackageTransactionsDbRow & string, string>

export const packagesFieldMap = {
  package_code: 'packageCode', name: 'name', eligible_service: 'eligibleService', included_credit: 'includedCredit', price: 'price', notes: 'notes', created_at: 'createdAt', created_by: 'createdBy', updated_at: 'updatedAt', updated_by: 'updatedBy', deleted_at: 'deletedAt', deleted_by: 'deletedBy',
} as const satisfies Record<keyof PackagesDbRow & string, string>
