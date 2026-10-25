import type { z } from 'zod'
import { orderIntakeCreateSchema, orderIntakeCreateResponseSchema } from '@contracts/order-intakes/order-intake-api.schema'
import { apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export async function createOrderIntake(payload: z.input<typeof orderIntakeCreateSchema>) {
  try {
    return orderIntakeCreateResponseSchema.parse(await apiPost<unknown>('/api/order-intakes', {
      data: payload, requestSchema: orderIntakeCreateSchema,
    }))
  } finally {
    for (const path of ['/api/work-orders', '/api/order-items', '/api/order-garments', '/api/order-images', '/api/job-tickets', '/api/work-transactions', '/api/laundry-items', '/api/orders', '/api/order-snapshots', '/api/order-reports']) invalidate(path)
  }
}
