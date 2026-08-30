import type { z } from 'zod'
import { orderItemCreateResponseSchema, orderItemCreateSchema } from '@contracts/order-items/order-item-api.schema'
import { apiPost } from '@/shared/api/api-client'

const ORDER_ITEMS_ENDPOINT = '/api/order-items'

export type OrderItemCreatePayload = z.infer<typeof orderItemCreateSchema>
export type OrderItemCreateDto = z.infer<typeof orderItemCreateResponseSchema>

export function createOrderItem(payload: OrderItemCreatePayload): Promise<OrderItemCreateDto> {
  return apiPost<OrderItemCreateDto>(ORDER_ITEMS_ENDPOINT, { data: payload, requestSchema: orderItemCreateSchema })
}
