import { z } from 'zod'
import {
  createCustomerPackageResponseSchema,
  createCustomerPackageRequestSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import {
  customerPackageDetailResponseSchema,
  customerPackageListQuerySchema,
  customerPackageListResponseSchema,
  packageTransactionSchema,
} from '@contracts/customer-packages/customer-package-view-api.schema'
import {
  appendPackageTransactionRequestSchema,
  appendPackageTransactionResponseSchema,
} from '@contracts/customer-packages/package-transaction-api.schema'
import { apiGet, apiGetList, ApiError } from '@/shared/api/api-client'

type CustomerPackageListItem = z.infer<typeof customerPackageListResponseSchema>
type CustomerPackageDetail = z.infer<typeof customerPackageDetailResponseSchema>
type CustomerPackageListQuery = z.infer<typeof customerPackageListQuerySchema>
type CreateCustomerPackageRequest = z.infer<typeof createCustomerPackageRequestSchema>
type CreateCustomerPackageResponse = z.infer<typeof createCustomerPackageResponseSchema>
type AppendPackageTransactionRequest = z.infer<typeof appendPackageTransactionRequestSchema>
type AppendPackageTransactionResponse = z.infer<typeof appendPackageTransactionResponseSchema>

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

  return { items, page: pagination.page, perPage: pagination.perPage }
}

export async function getCustomerPackageDetail(id: string): Promise<CustomerPackageDetail | null> {
  try {
    const detail = await apiGet<CustomerPackageDetail>('/api/customer-packages/' + encodeURIComponent(id))
    return customerPackageDetailResponseSchema.parse({
      ...detail,
      transactions: detail.transactions.map((transaction) => packageTransactionSchema.parse(transaction)),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/**
 * A fetch or invalid-body failure has unknown write outcome. The create union has
 * no generic network member, so `opening_transaction_write_failed` is used with
 * an explicit unknown package id and unknown certainty to prevent an unsafe retry.
 */
// Unknown network write outcome: retain the contract's non-retryable failure kind.
function unknownCreateOutcome(message: string): CreateCustomerPackageResponse {
  return {
    kind: 'opening_transaction_write_failed',
    customerPackageId: 'unknown',
    message,
    certainty: 'unknown',
  }
}

export async function createCustomerPackage(request: CreateCustomerPackageRequest): Promise<CreateCustomerPackageResponse> {
  // The parsed union covers: 'created', 'validation_error', 'catalog_read_failed',
  // 'opening_transaction_write_failed', and 'package_write_failed'.
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
      return unknownCreateOutcome('The server response could not be read. This package may already have been created.')
    }
    const parsed = createCustomerPackageResponseSchema.safeParse(body)
    if (!parsed.success) {
      return unknownCreateOutcome('The server response was not a recognized write outcome. This package may already have been created.')
    }
    return parsed.data
  } catch {
    return unknownCreateOutcome('Could not reach the server. This package may already have been created.')
  }
}

function unknownTransactionOutcome(request: AppendPackageTransactionRequest, message: string): AppendPackageTransactionResponse {
  return {
    kind: 'transaction_write_failed',
    customerPackageId: request.customerPackageId,
    message,
    certainty: 'unknown',
  }
}

export async function appendPackageTransaction(request: AppendPackageTransactionRequest): Promise<AppendPackageTransactionResponse> {
  // The parsed union covers: 'created', 'validation_error', 'package_not_found',
  // 'package_lookup_failed', and 'transaction_write_failed'.
  try {
    const response = await fetch('/api/package-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appendPackageTransactionRequestSchema.parse(request)),
    })
    let body: unknown
    try {
      body = await response.json()
    } catch {
      return unknownTransactionOutcome(request, 'The server response could not be read. This transaction may already have been saved.')
    }
    const parsed = appendPackageTransactionResponseSchema.safeParse(body)
    if (!parsed.success) {
      return unknownTransactionOutcome(request, 'The server response was not a recognized write outcome. This transaction may already have been saved.')
    }
    return parsed.data
  } catch {
    return unknownTransactionOutcome(request, 'Could not reach the server. This transaction may already have been saved.')
  }
}
