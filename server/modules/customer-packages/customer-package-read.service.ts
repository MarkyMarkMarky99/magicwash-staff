import type { z } from 'zod'
import { customerPackageApiContract } from '../../../contracts/customer-packages/customer-package-api.schema.js'
import { bangkokToday, toRequiredString } from '../../../shared/utils/bangkok-datetime.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import type { ServiceListResult } from '../../shared/services/base-crud.service.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { ApiError } from '../../shared/http/api-error.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import type { customersRowSchema } from '../../sheets/Customers/Customers.db-contract.js'
import { getCustomersRepository } from '../../sheets/Customers/Customers.repository.js'
import type { customerPackagesRowSchema } from '../../sheets/CustomerPackages/CustomerPackages.db-contract.js'
import { getCustomerPackagesRepository } from '../../sheets/CustomerPackages/CustomerPackages.repository.js'
import type { packageTransactionsRowSchema } from '../../sheets/PackageTransactions/PackageTransactions.db-contract.js'
import { getPackageTransactionsRepository } from '../../sheets/PackageTransactions/PackageTransactions.repository.js'
import type { packagesRowSchema } from '../../sheets/Packages/Packages.db-contract.js'
import { getPackagesRepository } from '../../sheets/Packages/Packages.repository.js'
import { assembleCustomerPackageRows, compareRows, matchesKeyword } from './customer-package-assembly.js'

type CustomerPackagesDbRow = z.infer<typeof customerPackagesRowSchema>
type PackageTransactionsDbRow = z.infer<typeof packageTransactionsRowSchema>
type PackagesDbRow = z.infer<typeof packagesRowSchema>
type CustomersDbRow = z.infer<typeof customersRowSchema>
type CustomerPackageListResponse = z.infer<typeof customerPackageApiContract.response.list>
type CustomerPackageDetailResponse = z.infer<typeof customerPackageApiContract.response.detail>

export interface CustomerPackageReadServiceOptions {
  packageRepository: () => SheetRepositoryContract<CustomerPackagesDbRow>
  transactionRepository: () => SheetRepositoryContract<PackageTransactionsDbRow>
  catalogRepository: () => SheetRepositoryContract<PackagesDbRow>
  customerRepository: () => SheetRepositoryContract<CustomersDbRow>
  now?: () => Date
}

export class CustomerPackageReadService {
  private readonly packageRepository: () => SheetRepositoryContract<CustomerPackagesDbRow>
  private readonly transactionRepository: () => SheetRepositoryContract<PackageTransactionsDbRow>
  private readonly catalogRepository: () => SheetRepositoryContract<PackagesDbRow>
  private readonly customerRepository: () => SheetRepositoryContract<CustomersDbRow>
  private readonly now: () => Date

  constructor(input: CustomerPackageReadServiceOptions) {
    this.packageRepository = input.packageRepository
    this.transactionRepository = input.transactionRepository
    this.catalogRepository = input.catalogRepository
    this.customerRepository = input.customerRepository
    this.now = input.now ?? (() => new Date())
  }

  async list(query: unknown): Promise<ServiceListResult<CustomerPackageListResponse>> {
    const validQuery = parseOrThrow(customerPackageApiContract.query.list, query)
    const today = bangkokToday(this.now())
    const [packages, transactions, catalog, customers] = await Promise.all([
      this.packageRepository().read(new ReadQueryDTO<Partial<CustomerPackagesDbRow>>({ where: dropEmpty({ customer_id: validQuery.customerId, package_code: validQuery.packageCode }) })),
      this.transactionRepository().read(new ReadQueryDTO<Partial<PackageTransactionsDbRow>>({})),
      this.catalogRepository().read(new ReadQueryDTO<Partial<PackagesDbRow>>({ where: dropEmpty({ package_code: validQuery.packageCode }) })),
      this.customerRepository().read(new ReadQueryDTO<Partial<CustomersDbRow>>({ where: dropEmpty({ CustomerID: validQuery.customerId }) })),
    ])
    let filtered = assembleCustomerPackageRows({ packages, transactions, catalog, customers, today }).filter((row) => matchesKeyword(row, validQuery.keyword))
    if (validQuery.status !== null) filtered = filtered.filter((row) => row.status === validQuery.status)
    const sorted = filtered.slice().sort((a, b) => compareRows(a, b, validQuery.sortBy, validQuery.sortOrder))
    const start = (validQuery.page - 1) * validQuery.perPage
    return { items: sorted.slice(start, start + validQuery.perPage).map((row) => projectRow(row, customerPackageApiContract.response.list)), pagination: { page: validQuery.page, perPage: validQuery.perPage } }
  }

  async getById(id: string): Promise<CustomerPackageDetailResponse> {
    const safeId = id.trim()
    if (safeId === '') throw ApiError.badRequest('id is required')
    const packages = await this.packageRepository().read(ReadQueryDTO.fromId<Partial<CustomerPackagesDbRow>>(safeId))
    if (packages.length === 0) throw ApiError.notFound(`Resource '${safeId}' not found`)
    if (packages.length > 1) throw ApiError.conflict(`Resource '${safeId}' resolved to multiple rows`)
    const pkg = packages[0]!
    const today = bangkokToday(this.now())
    const [transactions, catalog, customers] = await Promise.all([
      this.transactionRepository().read(new ReadQueryDTO<Partial<PackageTransactionsDbRow>>({ where: dropEmpty({ customer_package_id: toRequiredString(pkg.id) }) })),
      this.catalogRepository().read(new ReadQueryDTO<Partial<PackagesDbRow>>({ where: dropEmpty({ package_code: toRequiredString(pkg.package_code) }) })),
      this.customerRepository().read(new ReadQueryDTO<Partial<CustomersDbRow>>({ where: dropEmpty({ CustomerID: toRequiredString(pkg.customer_id) }) })),
    ])
    const rows = assembleCustomerPackageRows({ packages: [pkg], transactions, catalog, customers, today })
    return projectRow(rows[0]!, customerPackageApiContract.response.detail)
  }
}

function dropEmpty(where: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(where).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

function projectRow<TResponse>(row: Record<string, unknown>, schema: { shape: Record<string, unknown> }): TResponse {
  const output: Record<string, unknown> = {}
  for (const field of Object.keys(schema.shape)) output[field] = row[field]
  return output as TResponse
}

export const customerPackageReadService = new CustomerPackageReadService({
  packageRepository: getCustomerPackagesRepository,
  transactionRepository: getPackageTransactionsRepository,
  catalogRepository: getPackagesRepository,
  customerRepository: getCustomersRepository,
})
