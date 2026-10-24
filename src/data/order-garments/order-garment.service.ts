import type { z } from 'zod'
import { orderGarmentListQuerySchema, orderGarmentResponseSchema } from '@contracts/order-garments/order-garment-api.schema'
import { apiGetList } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type OrderGarmentDto = z.infer<typeof orderGarmentResponseSchema>

export async function listGarmentOrders(laundryItemId: string): Promise<OrderGarmentDto[]> {
  invalidate('/api/order-garments')
  const result = await apiGetList<unknown>('/api/order-garments', {
    query: { laundryItemId, perPage: 1000 }, querySchema: orderGarmentListQuerySchema,
  })
  return result.items.map(row => orderGarmentResponseSchema.parse(row)).filter(row => row.deletedAt === null)
}
