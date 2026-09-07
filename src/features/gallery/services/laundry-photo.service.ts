import type { z } from 'zod'
import {
  afterPhotoCreateSchema,
  afterPhotoResponseSchema,
  afterPhotoUpdateSchema,
} from '@contracts/after-photos/after-photo-api.schema'
import {
  laundryPhotoCreateSchema,
  laundryPhotoResponseSchema,
  laundryPhotoUpdateSchema,
} from '@contracts/laundry-photos/laundry-photo-api.schema'
import { apiPatch, apiPost } from '@/shared/api/api-client'

export type GalleryPhotoType = 'BEF' | 'AFT'
export type ReassignPhotoPayload = z.infer<typeof laundryPhotoUpdateSchema>
type LaundryPhotoCreatePayload = z.infer<typeof laundryPhotoCreateSchema>
type AfterPhotoCreatePayload = z.infer<typeof afterPhotoCreateSchema>
export type CreatePhotoPayload = LaundryPhotoCreatePayload | AfterPhotoCreatePayload
type LaundryPhotoDto = z.infer<typeof laundryPhotoResponseSchema>
type AfterPhotoDto = z.infer<typeof afterPhotoResponseSchema>

const LAUNDRY_PHOTOS_ENDPOINT = '/api/laundry-photos'
const AFTER_PHOTOS_ENDPOINT = '/api/after-photos'

// `async` so every failure — an unsupported type included — reaches the caller as a rejection
// rather than a synchronous throw that a promise chain would miss.
export async function createPhoto(
  type: GalleryPhotoType,
  payload: CreatePhotoPayload,
): Promise<LaundryPhotoDto | AfterPhotoDto> {
  if (type === 'BEF') {
    return apiPost<LaundryPhotoDto>(LAUNDRY_PHOTOS_ENDPOINT, {
      data: payload,
      requestSchema: laundryPhotoCreateSchema,
    })
  }

  if (type === 'AFT') {
    return apiPost<AfterPhotoDto>(AFTER_PHOTOS_ENDPOINT, {
      data: payload,
      requestSchema: afterPhotoCreateSchema,
    })
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
    return apiPatch<LaundryPhotoDto>(`${LAUNDRY_PHOTOS_ENDPOINT}/${encodedPhotoId}`, {
      data: payload,
      requestSchema: laundryPhotoUpdateSchema,
    })
  }

  if (type === 'AFT') {
    return apiPatch<AfterPhotoDto>(`${AFTER_PHOTOS_ENDPOINT}/${encodedPhotoId}`, {
      data: payload,
      requestSchema: afterPhotoUpdateSchema,
    })
  }

  throw new Error(`Unsupported gallery photo type: ${String(type)}`)
}
