import { z } from 'zod'
import { workOrderListResponseSchema } from '../work-orders/work-order-api.schema.js'

export const orderSnapshotRowSchema = workOrderListResponseSchema.extend({
  createdAt: z.string().nullable(),
})
