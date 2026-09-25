import type { z } from 'zod'
import { orderItemCreateResponseSchema, orderItemCreateSchema, orderItemUpdateSchema, orderItemUpdateResponseSchema, orderItemQuantityReassignSchema, orderItemQuantityReassignResponseSchema } from '@contracts/order-items/order-item-api.schema'
import { apiPatch, apiPost } from '@/shared/api/api-client'
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

export type OrderItemUpdatePayload = z.infer<typeof orderItemUpdateSchema>
export type OrderItemQuantityReassignPayload = z.infer<typeof orderItemQuantityReassignSchema>

export async function updateOrderItem(id: string, payload: OrderItemUpdatePayload): Promise<z.infer<typeof orderItemUpdateResponseSchema>> {
  const result = await apiPatch<z.infer<typeof orderItemUpdateResponseSchema>>(`${ORDER_ITEMS_ENDPOINT}/${encodeURIComponent(id)}`, { data: payload, requestSchema: orderItemUpdateSchema })
  invalidate('/api/order-items')
  invalidate('/api/work-orders')
  return result
}

export async function reassignOrderItemQuantities(payload: OrderItemQuantityReassignPayload): Promise<z.infer<typeof orderItemQuantityReassignResponseSchema>> {
  const result = await apiPost<z.infer<typeof orderItemQuantityReassignResponseSchema>>(`${ORDER_ITEMS_ENDPOINT}/reassign-quantities`, { data: payload, requestSchema: orderItemQuantityReassignSchema })
  invalidate('/api/order-items')
  invalidate('/api/work-orders')
  return result
}
