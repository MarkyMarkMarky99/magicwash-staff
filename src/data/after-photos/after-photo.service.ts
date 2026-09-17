import type { z } from 'zod'
import {
  afterPhotoCreateSchema,
  afterPhotoListQuerySchema,
  afterPhotoResponseSchema,
  afterPhotoUpdateSchema,
} from '@contracts/after-photos/after-photo-api.schema'
import { apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'
import type { GalleryPhoto } from '@/data/laundry-photos/laundry-photo.service'

export type CreateAfterPhotoPayload = z.infer<typeof afterPhotoCreateSchema>
type AfterPhotoDto = z.infer<typeof afterPhotoResponseSchema>

const AFTER_PHOTOS_ENDPOINT = '/api/after-photos'

function normalizePhotos<T extends { orderItemId: string | null; imageUrl: string | null; notes: string | null }>(
  photos: T[],
  getId: (photo: T) => string,
): GalleryPhoto[] {
  return photos.flatMap(photo => (
    photo.imageUrl
      ? [{ id: getId(photo), orderItemId: photo.orderItemId, imageUrl: photo.imageUrl, notes: photo.notes }]
      : []
  ))
}

export async function listAfterPhotos(
  orderId: string,
  onFresh?: (photos: GalleryPhoto[]) => void,
): Promise<GalleryPhoto[]> {
  const { items } = await apiGetList<AfterPhotoDto>(AFTER_PHOTOS_ENDPOINT, {
    query: { orderId },
    querySchema: afterPhotoListQuerySchema,
    onFresh: onFresh
      ? ({ items: freshItems }) => onFresh(
          normalizePhotos(freshItems, photo => photo.afterPhotoId),
        )
      : undefined,
  })
  return normalizePhotos(items, photo => photo.afterPhotoId)
}

export async function createAfterPhoto(payload: CreateAfterPhotoPayload): Promise<AfterPhotoDto> {
  const result = await apiPost<AfterPhotoDto>(AFTER_PHOTOS_ENDPOINT, {
    data: payload,
    requestSchema: afterPhotoCreateSchema,
  })
  invalidate(AFTER_PHOTOS_ENDPOINT)
  return result
}

export async function reassignAfterPhoto(
  encodedPhotoId: string,
  payload: z.infer<typeof afterPhotoUpdateSchema>,
): Promise<AfterPhotoDto> {
  const result = await apiPatch<AfterPhotoDto>(`${AFTER_PHOTOS_ENDPOINT}/${encodedPhotoId}`, {
    data: payload,
    requestSchema: afterPhotoUpdateSchema,
  })
  invalidate(AFTER_PHOTOS_ENDPOINT)
  return result
}
