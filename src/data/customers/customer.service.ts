import type { z } from 'zod'
import {
  customerListQuerySchema,
  customerListResponseSchema,
  customerDetailResponseSchema,
} from '@contracts/customers/customer-api.schema'
import { apiGet, apiGetList } from '@/shared/api/api-client'

/** Returns contract-derived camelCase DTOs without local mapping. */

// DTO/query types derived from the shared contract, next to their consumer —
// not a frontend-owned copy.
export type CustomerListDto = z.infer<typeof customerListResponseSchema>
export type CustomerDetailDto = z.infer<typeof customerDetailResponseSchema>

const CUSTOMERS_ENDPOINT = '/api/customers'

export interface CustomerListResult {
  items: CustomerListDto[]
  truncated: boolean
}

function toCustomerListResult(items: CustomerListDto[]): CustomerListResult {
  return { items, truncated: items.length === 2000 }
}

export async function listCustomers(
  onFresh?: (result: CustomerListResult) => void,
): Promise<CustomerListResult> {
  const { items } = await apiGetList<CustomerListDto>(CUSTOMERS_ENDPOINT, {
    querySchema: customerListQuerySchema,
    onFresh: (result) => onFresh?.(toCustomerListResult(result.items)),
  })
  return toCustomerListResult(items)
}

export async function getCustomerById(customerId: string): Promise<CustomerDetailDto> {
  return apiGet<CustomerDetailDto>(`/api/customers/${encodeURIComponent(customerId)}`)
}
