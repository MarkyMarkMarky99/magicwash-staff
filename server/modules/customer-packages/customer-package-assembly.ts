import type { z } from 'zod'
import type {
  customerPackagePortalRowSchema,
  packageTransactionSchema,
} from '../../../contracts/customer-packages/customer-package-api.schema.js'
import type { customersRowSchema } from '../../sheets/Customers/Customers.db-contract.js'
import type { customerPackagesRowSchema } from '../../sheets/CustomerPackages/CustomerPackages.db-contract.js'
import type { packageTransactionsRowSchema } from '../../sheets/PackageTransactions/PackageTransactions.db-contract.js'
import type { packagesRowSchema } from '../../sheets/Packages/Packages.db-contract.js'
import {
  normalizeSheetDate,
  normalizeSheetTimestamp,
  toNullableString,
  toNumber,
  toRequiredString,
} from '../../../shared/utils/bangkok-datetime.js'

type CustomersDbRow = z.infer<typeof customersRowSchema>
type CustomerPackagesDbRow = z.infer<typeof customerPackagesRowSchema>
type PackageTransactionsDbRow = z.infer<typeof packageTransactionsRowSchema>
type PackagesDbRow = z.infer<typeof packagesRowSchema>
type CustomerPackagePortalRow = z.infer<typeof customerPackagePortalRowSchema>
type PackageTransactionApiRow = z.infer<typeof packageTransactionSchema>

export const CUSTOMER_PACKAGE_SEARCH_FIELDS = ['customerPackageId', 'customerId', 'customerName', 'packageCode'] as const

export interface CustomerPackageLedger {
  entries: PackageTransactionApiRow[]
  remainingCredit: number
  usedCredit: number
  totalCredit: number
}

export interface CustomerPackageSources {
  packages: Array<Partial<CustomerPackagesDbRow>>
  transactions: Array<Partial<PackageTransactionsDbRow>>
  catalog: Array<Partial<PackagesDbRow>>
  customers: Array<Partial<CustomersDbRow>>
  today: string
}

export function groupTransactionsByPackage(rows: Array<Partial<PackageTransactionsDbRow>>): Map<string, Array<Partial<PackageTransactionsDbRow>>> {
  const grouped = new Map<string, Array<Partial<PackageTransactionsDbRow>>>()
  for (const row of rows) {
    const key = toRequiredString(row.customer_package_id)
    if (key === '') continue
    const entries = grouped.get(key)
    if (entries === undefined) grouped.set(key, [row])
    else entries.push(row)
  }
  return grouped
}

export function buildLedger(rows: Array<Partial<PackageTransactionsDbRow>>): CustomerPackageLedger {
  const sorted = rows.map((row) => ({ row, stamp: normalizeSheetTimestamp(row.created_at), id: toRequiredString(row.id) }))
  sorted.sort((a, b) => a.stamp < b.stamp ? -1 : a.stamp > b.stamp ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

  let running = 0
  let used = 0
  const entries: PackageTransactionApiRow[] = []
  for (const item of sorted) {
    const change = toNumber(item.row.credit_change)
    running += change
    if (change < 0) used += -change
    entries.push({
      id: toRequiredString(item.row.id),
      type: item.row.type!,
      creditChange: change,
      remainingCredit: running,
      referenceSource: toNullableString(item.row.reference_source),
      referenceId: toNullableString(item.row.reference_id),
      notes: toNullableString(item.row.notes),
      createdAt: item.stamp,
    })
  }
  return { entries, remainingCredit: running, usedCredit: used, totalCredit: running + used }
}

export function resolveStatus(input: { deletedAt: unknown; startDate: string | null; expiryDate: string | null; today: string }): 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' {
  if (toNullableString(input.deletedAt) !== null) return 'CANCELLED'
  if (input.startDate !== null && input.today < input.startDate) return 'INACTIVE'
  if (input.expiryDate !== null && input.today > input.expiryDate) return 'EXPIRED'
  return 'ACTIVE'
}

export function assembleCustomerPackageRow(input: { pkg: Partial<CustomerPackagesDbRow>; ledger: CustomerPackageLedger; catalogRow: Partial<PackagesDbRow> | undefined; customerRow: Partial<CustomersDbRow> | undefined; today: string }): CustomerPackagePortalRow {
  const startDate = normalizeSheetDate(input.pkg.start_date)
  const expiryDate = normalizeSheetDate(input.pkg.expiry_date)
  return {
    customerPackageId: toRequiredString(input.pkg.id), customerId: toRequiredString(input.pkg.customer_id), customerName: toRequiredString(input.customerRow?.CustomerName), customerPhone: toNullableString(input.customerRow?.Phone), customerAddress: toNullableString(input.customerRow?.Address), packageCode: toRequiredString(input.pkg.package_code), packageName: toRequiredString(input.catalogRow?.name), packageEligibleService: toRequiredString(input.catalogRow?.eligible_service), startDate, expiryDate,
    status: resolveStatus({ deletedAt: input.pkg.deleted_at, startDate, expiryDate, today: input.today }), serviceDay: toNullableString(input.pkg.service_day), timeSlot: toNullableString(input.pkg.time_slot), invoiceId: toNullableString(input.pkg.invoice_id), notes: toNullableString(input.pkg.notes), remainingCredit: input.ledger.remainingCredit, usedCredit: input.ledger.usedCredit, totalCredit: input.ledger.totalCredit, transactions: input.ledger.entries,
  }
}

export function assembleCustomerPackageRows(sources: CustomerPackageSources): CustomerPackagePortalRow[] {
  const byPackage = groupTransactionsByPackage(sources.transactions)
  const catalogByCode = firstByKey(sources.catalog, (row) => toRequiredString(row.package_code))
  const customersById = firstByKey(sources.customers, (row) => toRequiredString(row.CustomerID))
  return sources.packages.map((pkg) => assembleCustomerPackageRow({ pkg, ledger: buildLedger(byPackage.get(toRequiredString(pkg.id)) ?? []), catalogRow: catalogByCode.get(toRequiredString(pkg.package_code)), customerRow: customersById.get(toRequiredString(pkg.customer_id)), today: sources.today }))
}

function firstByKey<T>(rows: T[], keyOf: (row: T) => string): Map<string, T> {
  const mapped = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key !== '' && !mapped.has(key)) mapped.set(key, row)
  }
  return mapped
}

export function matchesKeyword(row: CustomerPackagePortalRow, keyword: string): boolean {
  const needle = keyword.replace(/'/g, '')
  return needle === '' || CUSTOMER_PACKAGE_SEARCH_FIELDS.some((field) => String(row[field] ?? '').includes(needle))
}

export function compareRows(a: CustomerPackagePortalRow, b: CustomerPackagePortalRow, sortBy: string, sortOrder: 'asc' | 'desc'): number {
  const av = a[sortBy as keyof CustomerPackagePortalRow]
  const bv = b[sortBy as keyof CustomerPackagePortalRow]
  const aEmpty = av == null || av === ''
  const bEmpty = bv == null || bv === ''
  const comparison = aEmpty && bEmpty ? 0 : aEmpty ? -1 : bEmpty ? 1 : typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0
  return sortOrder === 'desc' ? -comparison : comparison
}
