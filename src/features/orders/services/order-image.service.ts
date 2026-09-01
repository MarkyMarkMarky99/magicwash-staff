import type { z } from 'zod'
import { orderImageCreateResponseSchema, orderImageCreateSchema, orderImageListQuerySchema, orderImageResponseSchema } from '@contracts/order-images/order-image-api.schema'
import { apiGetList, apiPost, type ListResult } from '@/shared/api/api-client'

const ORDER_IMAGES_ENDPOINT = '/api/order-images'

export type OrderImageDto = z.infer<typeof orderImageResponseSchema>
export type OrderImageCreatePayload = z.infer<typeof orderImageCreateSchema>
export type OrderImageCreateDto = z.infer<typeof orderImageCreateResponseSchema>

export function listOrderImages(orderId: string): Promise<ListResult<OrderImageDto>> {
  return apiGetList<OrderImageDto>(ORDER_IMAGES_ENDPOINT, { query: { orderId }, querySchema: orderImageListQuerySchema })
}

export function createOrderImage(payload: OrderImageCreatePayload): Promise<OrderImageCreateDto> {
  return apiPost<OrderImageCreateDto>(ORDER_IMAGES_ENDPOINT, { data: payload, requestSchema: orderImageCreateSchema })
}
