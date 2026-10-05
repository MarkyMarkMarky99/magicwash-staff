import type { z } from 'zod'
import type { orderSnapshotRowSchema } from '@contracts/order-snapshots/order-snapshot-api.schema'
import { apiGet } from '@/shared/api/api-client'

export type OrderSnapshotDto = z.infer<typeof orderSnapshotRowSchema>

// The API client joins concurrent GETs of one URL, so a reload after a write would
// otherwise reuse a request that started before the write. The server ignores `request`.
export function getOrderSnapshot(request: number): Promise<OrderSnapshotDto[]> {
  return apiGet<OrderSnapshotDto[]>(`/api/order-snapshots?request=${request}`)
}
