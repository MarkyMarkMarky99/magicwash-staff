import type { z } from 'zod'
import { orderItemCreateResponseSchema, orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import { apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

const ORDER_ITEMS_ENDPOINT = '/api/order-items'

export type OrderItemCreatePayload = z.infer<typeof orderItemCreateSchema>
export type OrderItemCreateDto = z.infer<typeof orderItemCreateResponseSchema>

export async function createOrderItem(payload: OrderItemCreatePayload): Promise<OrderItemCreateDto> {
  const result = await apiPost<OrderItemCreateDto>(ORDER_ITEMS_ENDPOINT, { data: payload, requestSchema: orderItemCreateSchema })
  invalidate('/api/order-items')
  invalidate('/api/work-orders')
  return result
}
