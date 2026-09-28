import type { z } from 'zod'
import {
  customerListQuerySchema,
  customerListResponseSchema,
  customerDetailResponseSchema,
  customerCreateSchema,
  customerCreateResponseSchema,
} from '@contracts/customers/customer-api.schema'
import { apiGet, apiGetList, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type CustomerListDto = z.infer<typeof customerListResponseSchema>
export type CustomerDetailDto = z.infer<typeof customerDetailResponseSchema>
export type CustomerCreateDto = z.infer<typeof customerCreateResponseSchema>
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>

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

export async function createCustomer(payload: CustomerCreateInput): Promise<CustomerCreateDto> {
  const customer = await apiPost<CustomerCreateDto>(CUSTOMERS_ENDPOINT, {
    data: payload,
    requestSchema: customerCreateSchema,
  })
  invalidate(CUSTOMERS_ENDPOINT)
  return customer
}
