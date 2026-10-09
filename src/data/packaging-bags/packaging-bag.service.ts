import { packagingBagConfirmRequestSchema, type PackagingBagConfirmRequest, type PackagingBagConfirmResponse } from '@contracts/packaging-bags/packaging-bag-api.schema'
import { apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export async function confirmPackagingBags(payload: PackagingBagConfirmRequest): Promise<PackagingBagConfirmResponse> {
  try {
    return await apiPost<PackagingBagConfirmResponse>('/api/packaging-bags/confirm', {
      data: payload, requestSchema: packagingBagConfirmRequestSchema,
    })
  } finally {
    for (const path of ['/api/job-tickets', '/api/bag-items', '/api/order-images']) invalidate(path)
  }
}
