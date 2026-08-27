import type { z } from 'zod'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import type { packageTransactionsRowSchema } from '../../sheets/PackageTransactions/PackageTransactions.db-contract.js'
import type { customerPackagesRowSchema } from '../../sheets/CustomerPackages/CustomerPackages.db-contract.js'
import type { appendPackageTransactionResponseSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { appendPackageTransactionRequestSchema } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { getPackageTransactionsRepository } from '../../sheets/PackageTransactions/PackageTransactions.repository.js'
import { getCustomerPackagesRepository } from '../../sheets/CustomerPackages/CustomerPackages.repository.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { generateShortId } from '../../shared/utils/id.js'
import { WriteCommittedUnreadableError, WriteRejectedError, WriteTransportError } from '../../shared/repositories/sheets-api.client.js'
import { DuplicateRowKeyError } from '../../shared/repositories/sheet-row-lookup.js'
import { WriteRowIdentityMismatchError } from '../../shared/repositories/sheet-row-identity.js'

type PackageTransactionsDbRow = z.infer<typeof packageTransactionsRowSchema>
type CustomerPackagesDbRow = z.infer<typeof customerPackagesRowSchema>
type AppendPackageTransactionResponse = z.infer<typeof appendPackageTransactionResponseSchema>

interface WriteFailure { certainty: 'rejected' | 'unknown'; message: string }

function classifyWriteFailure(error: unknown): WriteFailure {
  if (error instanceof WriteRejectedError || error instanceof DuplicateRowKeyError) return { certainty: 'rejected', message: error.message }
  if (error instanceof WriteCommittedUnreadableError) return { certainty: 'unknown', message: `Write committed but the persisted row could not be read back; do not retry: ${error.message}` }
  if (error instanceof WriteTransportError || error instanceof WriteRowIdentityMismatchError) return { certainty: 'unknown', message: `Write outcome unknown: ${error.message}` }
  return { certainty: 'unknown', message: error instanceof Error ? error.message : String(error) }
}

function issues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({ path: issue.path.join('.') || '(root)', message: issue.message }))
}

export interface PackageTransactionServiceOptions {
  transactionRepository: () => SheetRepositoryContract<PackageTransactionsDbRow>
  packageRepository: () => SheetRepositoryContract<CustomerPackagesDbRow>
  generateTransactionId?: () => string
}

export interface ResolvedParentPackage { customerPackageId: string; customerId: string }

export class PackageTransactionService {
  private readonly transactionRepository: () => SheetRepositoryContract<PackageTransactionsDbRow>
  private readonly packageRepository: () => SheetRepositoryContract<CustomerPackagesDbRow>
  private readonly generateTransactionId: () => string

  constructor(input: PackageTransactionServiceOptions) {
    this.transactionRepository = input.transactionRepository
    this.packageRepository = input.packageRepository
    this.generateTransactionId = input.generateTransactionId ?? generateShortId
  }

  async append(payload: unknown): Promise<AppendPackageTransactionResponse> {
    const parsed = appendPackageTransactionRequestSchema.safeParse(payload)
    if (!parsed.success) return { kind: 'validation_error', issues: issues(parsed.error) }
    const request = parsed.data
    let rows: Array<Partial<CustomerPackagesDbRow>>
    try { rows = await this.packageRepository().read(ReadQueryDTO.fromId(request.customerPackageId)) }
    catch (error) { return { kind: 'package_lookup_failed', customerPackageId: request.customerPackageId, message: error instanceof Error ? error.message : String(error) } }
    if (rows.length === 0) return { kind: 'package_not_found', customerPackageId: request.customerPackageId }
    if (rows.length > 1) return { kind: 'package_lookup_failed', customerPackageId: request.customerPackageId, message: 'duplicate customer package id' }
    const rawCustomerId = rows[0].customer_id
    if (typeof rawCustomerId !== 'string' || rawCustomerId.trim() === '') return { kind: 'package_lookup_failed', customerPackageId: request.customerPackageId, message: 'parent package row has no customer_id' }
    const customerId = rawCustomerId.trim()
    const transactionId = this.generateTransactionId()
    try {
      const row = await this.transactionRepository().append({ id: transactionId, customer_package_id: request.customerPackageId, customer_id: customerId, type: request.type, reference_source: request.referenceSource, reference_id: request.referenceId, credit_change: request.creditChange, notes: request.notes, created_by: request.createdBy })
      return { kind: 'created', transactionId, customerPackageId: request.customerPackageId, customerId, type: request.type, creditChange: request.creditChange, createdAt: row.created_at }
    } catch (error) {
      const failure = classifyWriteFailure(error)
      return { kind: 'transaction_write_failed', customerPackageId: request.customerPackageId, message: failure.message, certainty: failure.certainty }
    }
  }

  async appendOpeningPurchase(input: { customerPackageId: string; customerId: string; creditChange: number; createdBy: string }): Promise<{ transactionId: string }> {
    const transactionId = this.generateTransactionId()
    await this.transactionRepository().append({ id: transactionId, customer_package_id: input.customerPackageId, customer_id: input.customerId, type: 'PURCHASE', reference_source: 'CustomerPackages', reference_id: input.customerPackageId, credit_change: input.creditChange, notes: 'Initial package credit', created_by: input.createdBy })
    return { transactionId }
  }
}

export const packageTransactionService = new PackageTransactionService({ transactionRepository: getPackageTransactionsRepository, packageRepository: getCustomerPackagesRepository })
