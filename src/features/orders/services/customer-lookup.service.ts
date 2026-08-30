import type { z } from 'zod'
import {
  customerListQuerySchema,
  customerListResponseSchema,
} from '@contracts/customers/customer-api.schema'
import { apiGetList } from '@/shared/api/api-client'

export type CustomerLookupDto = z.infer<typeof customerListResponseSchema>

const CUSTOMERS_ENDPOINT = '/api/customers'

export async function listCustomersForOrder(): Promise<CustomerLookupDto[]> {
  const { items } = await apiGetList<CustomerLookupDto>(CUSTOMERS_ENDPOINT, {
    querySchema: customerListQuerySchema,
  })
  return items
}
