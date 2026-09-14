import type { z } from 'zod'
import { orderListQuerySchema, orderListResponseSchema } from '@contracts/orders/order-api.schema'
import { apiGetList } from '@/shared/api/api-client'

export type OrderListDto = z.infer<typeof orderListResponseSchema>
export type OrderListQuery = z.infer<typeof orderListQuerySchema>

const ORDERS_ENDPOINT = '/api/orders'

export async function listOrdersByCustomer(customerId: string): Promise<OrderListDto[]> {
  const { items } = await apiGetList<OrderListDto>(ORDERS_ENDPOINT, {
    query: { customerId },
    querySchema: orderListQuerySchema,
  })
  return items
}
