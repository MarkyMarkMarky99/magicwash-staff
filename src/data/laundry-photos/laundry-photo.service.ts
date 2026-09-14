import type { z } from 'zod'
import {
  laundryPhotoCreateSchema,
  laundryPhotoListQuerySchema,
  laundryPhotoResponseSchema,
  laundryPhotoUpdateSchema,
} from '@contracts/laundry-photos/laundry-photo-api.schema'
import { apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type ReassignLaundryPhotoPayload = z.infer<typeof laundryPhotoUpdateSchema>
export type CreateLaundryPhotoPayload = z.infer<typeof laundryPhotoCreateSchema>
type LaundryPhotoDto = z.infer<typeof laundryPhotoResponseSchema>
export interface GalleryPhoto {
  id: string
  imageUrl: string
  notes: string | null
}

const LAUNDRY_PHOTOS_ENDPOINT = '/api/laundry-photos'

function normalizePhotos<T extends { imageUrl: string | null; notes: string | null }>(
  photos: T[],
  getId: (photo: T) => string,
): GalleryPhoto[] {
  return photos.flatMap(photo => (
    photo.imageUrl
      ? [{ id: getId(photo), imageUrl: photo.imageUrl, notes: photo.notes }]
      : []
  ))
}

export async function listLaundryPhotos(
  orderId: string,
  orderItemId: string | null = null,
  onFresh?: (photos: GalleryPhoto[]) => void,
): Promise<GalleryPhoto[]> {
  const query = orderItemId ? { orderId, orderItemId } : { orderId }
  const { items } = await apiGetList<LaundryPhotoDto>(LAUNDRY_PHOTOS_ENDPOINT, {
    query,
    querySchema: laundryPhotoListQuerySchema,
    onFresh: onFresh
      ? ({ items: freshItems }) => onFresh(
          normalizePhotos(freshItems, photo => photo.laundryPhotoId),
        )
      : undefined,
  })
  return normalizePhotos(items, photo => photo.laundryPhotoId)
}

export async function createLaundryPhoto(
  payload: CreateLaundryPhotoPayload,
): Promise<LaundryPhotoDto> {
  const result = await apiPost<LaundryPhotoDto>(LAUNDRY_PHOTOS_ENDPOINT, {
    data: payload,
    requestSchema: laundryPhotoCreateSchema,
  })
  invalidate(LAUNDRY_PHOTOS_ENDPOINT)
  return result
}

export async function reassignLaundryPhoto(
  encodedPhotoId: string,
  payload: ReassignLaundryPhotoPayload,
): Promise<LaundryPhotoDto> {
  const result = await apiPatch<LaundryPhotoDto>(`${LAUNDRY_PHOTOS_ENDPOINT}/${encodedPhotoId}`, {
    data: payload,
    requestSchema: laundryPhotoUpdateSchema,
  })
  invalidate(LAUNDRY_PHOTOS_ENDPOINT)
  return result
}
