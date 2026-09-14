import { z } from 'zod'
import {
  createCustomerPackageResponseSchema,
  createCustomerPackageRequestSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import {
  customerPackageDetailResponseSchema,
  customerPackageListQuerySchema,
  customerPackageListResponseSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import { apiGet, apiGetList, ApiError } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type CustomerPackageListItem = z.infer<typeof customerPackageListResponseSchema>
type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>
export type CustomerPackageListQuery = z.infer<typeof customerPackageListQuerySchema>
type CreateCustomerPackageRequest = z.infer<typeof createCustomerPackageRequestSchema>
type CreateCustomerPackageResponse = z.infer<typeof createCustomerPackageResponseSchema>

const customerPackageStringFields = [
  'customerPackageId',
  'customerId',
  'customerName',
  'customerPhone',
  'customerAddress',
  'packageCode',
  'packageName',
  'packageEligibleService',
  'startDate',
  'expiryDate',
  'status',
  'serviceDay',
  'timeSlot',
  'invoiceId',
  'notes',
] as const

const packageTransactionStringFields = [
  'id',
  'type',
  'referenceSource',
  'referenceId',
  'notes',
  'createdAt',
] as const

/**
 * GViz can infer numeric-looking string cells as numbers. Stringifying those
 * values restores the DTO's runtime type, but does not recover a lost leading
 * zero: String(851344035) cannot restore the 0 from a source value like
 * "0851344035". The sheet column must be Plain Text to preserve that digit.
 */
function normalizeGvizStringFields<T extends object>(value: T, fields: readonly (keyof T)[]): T {
  const normalized = { ...value } as T
  for (const field of fields) {
    const fieldValue = normalized[field]
    if (fieldValue !== null && fieldValue !== undefined && typeof fieldValue !== 'string') {
      Object.assign(normalized, { [field]: String(fieldValue) })
    }
  }
  return normalized
}

export async function getCustomerPackages(filter: CustomerPackageListQuery): Promise<{
  items: CustomerPackageListItem[]
  page: number
  perPage: number
}> {
  const { items, pagination } = await apiGetList<CustomerPackageListItem>('/api/customer-packages', {
    query: {
      keyword: filter.keyword,
      customerId: filter.customerId,
      status: filter.status,
      packageCode: filter.packageCode,
      page: filter.page,
      perPage: filter.perPage,
      sortBy: filter.sortBy,
      sortOrder: filter.sortOrder,
    },
    querySchema: customerPackageListQuerySchema,
  })

  return {
    items: items.map((item) => normalizeGvizStringFields(item, customerPackageStringFields)),
    page: pagination.page,
    perPage: pagination.perPage,
  }
}

export async function getCustomerPackageDetail(id: string): Promise<CustomerPackageDetail | null> {
  try {
    const detail = await apiGet<CustomerPackageDetail>('/api/customer-packages/' + encodeURIComponent(id))
    const transactions = detail.transactions.map((transaction) => normalizeGvizStringFields(transaction, packageTransactionStringFields))
    return normalizeGvizStringFields({
      ...detail,
      transactions,
    }, customerPackageStringFields)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

// Unknown create outcomes must prevent unsafe retries.
function unknownCreateOutcome(message: string): CreateCustomerPackageResponse {
  return {
    kind: 'opening_transaction_write_failed',
    customerPackageId: 'unknown',
    message,
    certainty: 'unknown',
  }
}

function invalidateCreateCaches(): void {
  invalidate('/api/customer-packages')
  invalidate('/api/package-transactions')
}

export async function createCustomerPackage(request: CreateCustomerPackageRequest): Promise<CreateCustomerPackageResponse> {
  try {
    const response = await fetch('/api/customer-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createCustomerPackageRequestSchema.parse(request)),
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      invalidateCreateCaches()
      return unknownCreateOutcome('The server response could not be read. This package may already have been created.')
    }
    const parsed = createCustomerPackageResponseSchema.safeParse(body)
    if (!parsed.success) {
      invalidateCreateCaches()
      return unknownCreateOutcome('The server response was not a recognized write outcome. This package may already have been created.')
    }
    if (
      parsed.data.kind === 'created'
      || parsed.data.kind === 'package_write_failed'
      || (parsed.data.kind === 'opening_transaction_write_failed' && parsed.data.certainty === 'unknown')
    ) {
      invalidateCreateCaches()
    }
    return parsed.data
  } catch {
    invalidateCreateCaches()
    return unknownCreateOutcome('Could not reach the server. This package may already have been created.')
  }
}

