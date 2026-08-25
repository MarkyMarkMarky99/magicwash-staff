import type { z } from 'zod'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import type { customerPackagesRowSchema } from '../../sheets/CustomerPackages/CustomerPackages.db-contract.js'
import type { packagesRowSchema } from '../../sheets/Packages/Packages.db-contract.js'
import type { createCustomerPackageResponseSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { createCustomerPackageRequestSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { PackageTransactionService, packageTransactionService } from './package-transaction.service.js'
import { getCustomerPackagesRepository } from '../../sheets/CustomerPackages/CustomerPackages.repository.js'
import { getPackagesRepository } from '../../sheets/Packages/Packages.repository.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { generateShortId } from '../../shared/utils/id.js'
import { WriteCommittedUnreadableError, WriteRejectedError, WriteTransportError } from '../../shared/repositories/sheets-api.client.js'
import { DuplicateRowKeyError } from '../../shared/repositories/sheet-row-lookup.js'
import { WriteRowIdentityMismatchError } from '../../shared/repositories/sheet-row-identity.js'

type CustomerPackagesDbRow = z.infer<typeof customerPackagesRowSchema>
type PackagesDbRow = z.infer<typeof packagesRowSchema>
type CreateCustomerPackageResponse = z.infer<typeof createCustomerPackageResponseSchema>

interface WriteFailure { certainty: 'rejected' | 'unknown'; message: string }
function classifyWriteFailure(error: unknown): WriteFailure {
  if (error instanceof WriteRejectedError || error instanceof DuplicateRowKeyError) return { certainty: 'rejected', message: error.message }
  if (error instanceof WriteCommittedUnreadableError) return { certainty: 'unknown', message: `Write committed but the persisted row could not be read back; do not retry: ${error.message}` }
  if (error instanceof WriteTransportError || error instanceof WriteRowIdentityMismatchError) return { certainty: 'unknown', message: `Write outcome unknown: ${error.message}` }
  return { certainty: 'unknown', message: error instanceof Error ? error.message : String(error) }
}
function issues(error: z.ZodError): Array<{ path: string; message: string }> { return error.issues.map((issue) => ({ path: issue.path.join('.') || '(root)', message: issue.message })) }

export interface CustomerPackagePurchaseServiceOptions {
  packageRepository: () => SheetRepositoryContract<CustomerPackagesDbRow>
  catalogRepository: () => SheetRepositoryContract<PackagesDbRow>
  transactionService: PackageTransactionService
  generateCustomerPackageId?: () => string
}

export class CustomerPackagePurchaseService {
  private readonly packageRepository: () => SheetRepositoryContract<CustomerPackagesDbRow>
  private readonly catalogRepository: () => SheetRepositoryContract<PackagesDbRow>
  private readonly transactionService: PackageTransactionService
  private readonly generateCustomerPackageId: () => string
  constructor(input: CustomerPackagePurchaseServiceOptions) { this.packageRepository = input.packageRepository; this.catalogRepository = input.catalogRepository; this.transactionService = input.transactionService; this.generateCustomerPackageId = input.generateCustomerPackageId ?? generateShortId }

  async create(payload: unknown): Promise<CreateCustomerPackageResponse> {
    const parsed = createCustomerPackageRequestSchema.safeParse(payload)
    if (!parsed.success) return { kind: 'validation_error', issues: issues(parsed.error) }
    const request = parsed.data
    let catalogRows: Array<Partial<PackagesDbRow>>
    try { catalogRows = await this.catalogRepository().read(ReadQueryDTO.fromId(request.packageCode)) }
    catch (error) { return { kind: 'catalog_read_failed', packageCode: request.packageCode, message: error instanceof Error ? error.message : String(error) } }
    if (catalogRows.length === 0) return { kind: 'validation_error', issues: [{ path: 'packageCode', message: 'unknown package code' }] }
    if (catalogRows.length > 1) return { kind: 'catalog_read_failed', packageCode: request.packageCode, message: 'duplicate package_code in catalog' }
    const catalog = catalogRows[0]
    if (typeof catalog.deleted_at === 'string' && catalog.deleted_at.trim() !== '') return { kind: 'validation_error', issues: [{ path: 'packageCode', message: 'package is retired from sale' }] }
    const raw = catalog.included_credit
    const isEmpty = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')
    const openingCredit = isEmpty ? Number.NaN : typeof raw === 'number' ? raw : Number(raw)
    if (isEmpty) return { kind: 'catalog_read_failed', packageCode: request.packageCode, message: 'catalog row has no included_credit' }
    if (!Number.isFinite(openingCredit)) return { kind: 'catalog_read_failed', packageCode: request.packageCode, message: 'catalog included_credit is not a number' }
    if (openingCredit < 0) return { kind: 'catalog_read_failed', packageCode: request.packageCode, message: 'catalog included_credit is negative' }
    const customerPackageId = this.generateCustomerPackageId()
    let transactionId: string
    try { ({ transactionId } = await this.transactionService.appendOpeningPurchase({ customerPackageId, customerId: request.customerId, creditChange: openingCredit, createdBy: request.createdBy })) }
    catch (error) { const failure = classifyWriteFailure(error); return { kind: 'opening_transaction_write_failed', customerPackageId, message: failure.message, certainty: failure.certainty } }
    try {
      const row = await this.packageRepository().append({ id: customerPackageId, customer_id: request.customerId, package_code: request.packageCode, start_date: request.startDate, expiry_date: request.expiryDate, service_day: request.serviceDay, time_slot: request.timeSlot, invoice_id: request.invoiceId, notes: request.notes, created_by: request.createdBy })
      return { kind: 'created', customerPackageId, customerId: request.customerId, packageCode: request.packageCode, openingCredit, transactionId, createdAt: row.created_at }
    } catch (error) { const failure = classifyWriteFailure(error); return { kind: 'package_write_failed', customerPackageId, transactionId, openingCredit, message: failure.message, certainty: failure.certainty } }
  }
}

export const customerPackagePurchaseService = new CustomerPackagePurchaseService({ packageRepository: getCustomerPackagesRepository, catalogRepository: getPackagesRepository, transactionService: packageTransactionService })
