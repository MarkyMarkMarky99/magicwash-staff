import type { z } from 'zod'
import {
  customerListQuerySchema,
  customerListResponseSchema,
} from '@contracts/customers/customer-api.schema'
import { apiGetList } from '@/shared/api/api-client'

/**
 * Customer API communication. Returns contract DTOs verbatim — no mapping,
 * renaming, or reshaping (the API already emits frontend-ready camelCase).
 *
 * List-only for now: the endpoint returns every customer in one request, so the
 * store loads once and filters in memory. Add create/update/detail calls here
 * when a UI flow needs them.
 */

// DTO/query types derived from the shared contract, next to their consumer —
// not a frontend-owned copy.
export type CustomerListDto = z.infer<typeof customerListResponseSchema>
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>

const CUSTOMERS_ENDPOINT = '/api/customers'

/** Fetch the full customer list (server `perPage` defaults to the max). */
export async function listCustomers(
  query: Partial<CustomerListQuery> = {},
): Promise<CustomerListDto[]> {
  const { items } = await apiGetList<CustomerListDto>(CUSTOMERS_ENDPOINT, {
    query,
    querySchema: customerListQuerySchema,
  })
  return items
}
