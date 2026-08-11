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
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>
export type CustomerDetailDto = z.infer<typeof customerDetailResponseSchema>

const CUSTOMERS_ENDPOINT = '/api/customers'

/** Fetch the customer list. */
export async function listCustomers(
  query: Partial<CustomerListQuery> = {},
): Promise<CustomerListDto[]> {
  const { items } = await apiGetList<CustomerListDto>(CUSTOMERS_ENDPOINT, {
    query,
    querySchema: customerListQuerySchema,
  })
  return items
}

/** Fetch one customer for direct order-history URLs. */
export async function getCustomerById(customerId: string): Promise<CustomerDetailDto> {
  return apiGet<CustomerDetailDto>(`/api/customers/${encodeURIComponent(customerId)}`)
}
