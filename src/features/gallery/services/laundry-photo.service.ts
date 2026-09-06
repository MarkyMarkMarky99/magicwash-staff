import type { z } from 'zod'
import {
  afterPhotoResponseSchema,
  afterPhotoUpdateSchema,
} from '@contracts/after-photos/after-photo-api.schema'
import {
  laundryPhotoResponseSchema,
  laundryPhotoUpdateSchema,
} from '@contracts/laundry-photos/laundry-photo-api.schema'
import { apiPatch } from '@/shared/api/api-client'

export type GalleryPhotoType = 'BEF' | 'AFT'
export type ReassignPhotoPayload = z.infer<typeof laundryPhotoUpdateSchema>
type LaundryPhotoDto = z.infer<typeof laundryPhotoResponseSchema>
type AfterPhotoDto = z.infer<typeof afterPhotoResponseSchema>

const LAUNDRY_PHOTOS_ENDPOINT = '/api/laundry-photos'
const AFTER_PHOTOS_ENDPOINT = '/api/after-photos'

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
