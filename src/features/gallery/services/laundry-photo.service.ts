import type { z } from 'zod'
import {
  afterPhotoCreateSchema,
  afterPhotoListQuerySchema,
  afterPhotoResponseSchema,
  afterPhotoUpdateSchema,
} from '@contracts/after-photos/after-photo-api.schema'
import {
  laundryPhotoCreateSchema,
  laundryPhotoListQuerySchema,
  laundryPhotoResponseSchema,
  laundryPhotoUpdateSchema,
} from '@contracts/laundry-photos/laundry-photo-api.schema'
import { apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type GalleryPhotoType = 'BEF' | 'AFT'
export type ReassignPhotoPayload = z.infer<typeof laundryPhotoUpdateSchema>
type LaundryPhotoCreatePayload = z.infer<typeof laundryPhotoCreateSchema>
type AfterPhotoCreatePayload = z.infer<typeof afterPhotoCreateSchema>
export type CreatePhotoPayload = LaundryPhotoCreatePayload | AfterPhotoCreatePayload
type LaundryPhotoDto = z.infer<typeof laundryPhotoResponseSchema>
type AfterPhotoDto = z.infer<typeof afterPhotoResponseSchema>
export interface GalleryPhoto {
  id: string
  imageUrl: string
  notes: string | null
}

const LAUNDRY_PHOTOS_ENDPOINT = '/api/laundry-photos'
const AFTER_PHOTOS_ENDPOINT = '/api/after-photos'

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

export async function listGalleryPhotos(
  type: GalleryPhotoType,
  orderId: string,
  orderItemId: string | null = null,
  onFresh?: (photos: GalleryPhoto[]) => void,
): Promise<GalleryPhoto[]> {
  const query = orderItemId ? { orderId, orderItemId } : { orderId }

  if (type === 'BEF') {
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

  if (type === 'AFT') {
    const { items } = await apiGetList<AfterPhotoDto>(AFTER_PHOTOS_ENDPOINT, {
      query,
      querySchema: afterPhotoListQuerySchema,
      onFresh: onFresh
        ? ({ items: freshItems }) => onFresh(
            normalizePhotos(freshItems, photo => photo.afterPhotoId),
          )
        : undefined,
    })
    return normalizePhotos(items, photo => photo.afterPhotoId)
  }

  throw new Error(`Unsupported gallery photo type: ${String(type)}`)
}

// `async` so every failure — an unsupported type included — reaches the caller as a rejection
// rather than a synchronous throw that a promise chain would miss.
export async function createPhoto(
  type: GalleryPhotoType,
  payload: CreatePhotoPayload,
): Promise<LaundryPhotoDto | AfterPhotoDto> {
  if (type === 'BEF') {
    const result = await apiPost<LaundryPhotoDto>(LAUNDRY_PHOTOS_ENDPOINT, {
      data: payload,
      requestSchema: laundryPhotoCreateSchema,
    })
    invalidate(LAUNDRY_PHOTOS_ENDPOINT)
    return result
  }

  if (type === 'AFT') {
    const result = await apiPost<AfterPhotoDto>(AFTER_PHOTOS_ENDPOINT, {
      data: payload,
      requestSchema: afterPhotoCreateSchema,
    })
    invalidate(AFTER_PHOTOS_ENDPOINT)
    return result
  }

  throw new Error(`Unsupported gallery photo type: ${String(type)}`)
}

// `async` so every failure — an unsupported type included — reaches the caller as a rejection
// rather than a synchronous throw that a promise chain would miss.
export async function reassignPhoto(
  type: GalleryPhotoType,
  photoId: string,
  payload: ReassignPhotoPayload,
): Promise<LaundryPhotoDto | AfterPhotoDto> {
  const encodedPhotoId = encodeURIComponent(photoId)

  if (type === 'BEF') {
    const result = await apiPatch<LaundryPhotoDto>(`${LAUNDRY_PHOTOS_ENDPOINT}/${encodedPhotoId}`, {
      data: payload,
      requestSchema: laundryPhotoUpdateSchema,
    })
    invalidate(LAUNDRY_PHOTOS_ENDPOINT)
    return result
  }

  if (type === 'AFT') {
    const result = await apiPatch<AfterPhotoDto>(`${AFTER_PHOTOS_ENDPOINT}/${encodedPhotoId}`, {
      data: payload,
      requestSchema: afterPhotoUpdateSchema,
    })
    invalidate(AFTER_PHOTOS_ENDPOINT)
    return result
  }

  throw new Error(`Unsupported gallery photo type: ${String(type)}`)
}
