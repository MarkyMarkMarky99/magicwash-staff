import { z } from 'zod'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { getCustomerPackagesRepository } from '../../sheets/CustomerPackages/CustomerPackages.repository.js'
import { getPackageTransactionsRepository } from '../../sheets/PackageTransactions/PackageTransactions.repository.js'
import { buildLedger } from './customer-package-assembly.js'
import { generateShortId } from '../../shared/utils/id.js'
import { normalizeSheetDate } from '../../../shared/utils/bangkok-datetime.js'

const transferRequest = z.object({ oldPackageId: z.string().min(1), newPackageId: z.string().min(1), createdBy: z.string().min(1) }).strict()

export class PackageRenewalService {
  constructor(private readonly repositories = { packages: getCustomerPackagesRepository, transactions: getPackageTransactionsRepository }) {}
  async status(oldPackageId: string) {
    const old = (await this.repositories.packages().read({ where: { id: oldPackageId } })).find((pkg) => pkg.id === oldPackageId)
    if (!old) throw ApiError.notFound('Original package not found')
    const transactions = await this.repositories.transactions().read({ where: { customer_id: old.customer_id } })
    const references = new Set(transactions.filter((row) => row.type === 'TRANSFER'
      && String(row.reference_id ?? '').startsWith(`${oldPackageId}:`)).map((row) => String(row.reference_id)))
    const transfers = [...references].map((referenceId) => {
      const newPackageId = referenceId.slice(oldPackageId.length + 1)
      const outgoing = transactions.find((row) => row.customer_package_id === oldPackageId && row.type === 'TRANSFER'
        && row.reference_id === referenceId && toNumber(row.credit_change) < 0)
      const incoming = transactions.find((row) => row.customer_package_id === newPackageId && row.type === 'TRANSFER'
        && row.reference_id === referenceId && toNumber(row.credit_change) > 0)
      return { newPackageId, referenceId, credits: outgoing ? -toNumber(outgoing.credit_change) : toNumber(incoming?.credit_change), pending: !outgoing || !incoming }
    })
    return { transfers }
  }

  async transfer(input: unknown) {
    const request = parseOrThrow(transferRequest, input)
    if (request.oldPackageId === request.newPackageId) throw ApiError.validation('Renewal needs two different packages')
    const [oldRows, nextRows, oldTransactions, newTransactions] = await Promise.all([
      this.repositories.packages().read({ where: { id: request.oldPackageId } }),
      this.repositories.packages().read({ where: { id: request.newPackageId } }),
      this.repositories.transactions().read({ where: { customer_package_id: request.oldPackageId } }),
      this.repositories.transactions().read({ where: { customer_package_id: request.newPackageId } }),
    ])
    const old = oldRows.find((pkg) => pkg.id === request.oldPackageId)
    const next = nextRows.find((pkg) => pkg.id === request.newPackageId)
    const transactions = [...oldTransactions, ...newTransactions]
    if (!old || !next || old.customer_id !== next.customer_id || old.package_code !== next.package_code) throw ApiError.validation('Renewal packages must share customer and package code')
    const oldExpiry = normalizeSheetDate(old.expiry_date)
    const nextStart = normalizeSheetDate(next.start_date)
    if (!oldExpiry || !nextStart || new Date(`${oldExpiry}T00:00:00Z`).getTime() + 86400000 !== new Date(`${nextStart}T00:00:00Z`).getTime()) {
      throw ApiError.validation('New package must start the day after old expiry')
    }
    const referenceId = `${request.oldPackageId}:${request.newPackageId}`
    const oldSide = transactions.find((row) => row.customer_package_id === request.oldPackageId && row.type === 'TRANSFER' && row.reference_id === referenceId && toNumber(row.credit_change) < 0)
    if (transactions.some((row) => row.customer_package_id === request.oldPackageId && row.type === 'TRANSFER' && toNumber(row.credit_change) < 0 && row.reference_id !== referenceId)) throw ApiError.conflict('Old package already transferred to another renewal')
    const newSide = transactions.find((row) => row.customer_package_id === request.newPackageId && row.type === 'TRANSFER' && row.reference_id === referenceId && toNumber(row.credit_change) > 0)
    if (oldSide && newSide) throw ApiError.conflict('Renewal transfer already complete')
    const balance = buildLedger(transactions.filter((row) => row.customer_package_id === request.oldPackageId)).remainingCredit
    const credits = oldSide ? -toNumber(oldSide.credit_change) : newSide ? toNumber(newSide.credit_change) : balance
    if (credits <= 0) throw ApiError.validation('Only a positive old-package balance can transfer')
    if (!oldSide && balance < credits) throw ApiError.validation('Old package has insufficient positive credits for the missing outgoing transfer')
    if (!oldSide) await this.repositories.transactions().append({ id: generateShortId(), customer_package_id: request.oldPackageId,
      customer_id: old.customer_id, type: 'TRANSFER', credit_change: -credits, reference_source: 'CustomerPackages', reference_id: referenceId,
      notes: 'Renewal carry-over out', created_by: request.createdBy })
    if (!newSide) await this.repositories.transactions().append({ id: generateShortId(), customer_package_id: request.newPackageId,
      customer_id: next.customer_id, type: 'TRANSFER', credit_change: credits, reference_source: 'CustomerPackages', reference_id: referenceId,
      notes: 'Renewal carry-over in', created_by: request.createdBy })
    return { referenceId, credits }
  }
}

function toNumber(value: unknown): number { return Number(value) || 0 }

export const packageRenewalService = new PackageRenewalService()
