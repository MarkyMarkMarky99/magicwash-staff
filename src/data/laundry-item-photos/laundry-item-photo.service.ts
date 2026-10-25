import type { z } from 'zod'
import { laundryItemPhotoCreateSchema, laundryItemPhotoListQuerySchema, laundryItemPhotoResponseSchema } from '@contracts/laundry-item-photos/laundry-item-photo-api.schema'
import { apiGetList, apiPost } from '@/shared/api/api-client'
import { currentActor } from '@/shared/config/actor'
import { invalidate } from '@/shared/api/response-cache'

export type LaundryItemPhotoDto = z.infer<typeof laundryItemPhotoResponseSchema>

export async function listLaundryItemPhotos(laundryItemId: string): Promise<LaundryItemPhotoDto[]> {
  invalidate('/api/laundry-item-photos')
  const result = await apiGetList<unknown>('/api/laundry-item-photos', {
    query: { laundryItemId, perPage: 1000 }, querySchema: laundryItemPhotoListQuerySchema,
  })
  return result.items.map(row => laundryItemPhotoResponseSchema.parse(row)).filter(row => row.deletedAt === null)
}

export async function createLaundryItemPhoto(payload: Omit<z.input<typeof laundryItemPhotoCreateSchema>, 'createdBy'>): Promise<void> {
  await apiPost<unknown>('/api/laundry-item-photos', {
    data: { ...payload, createdBy: currentActor() }, requestSchema: laundryItemPhotoCreateSchema,
  })
  invalidate('/api/laundry-item-photos')
}
