import {
  createAfterPhoto,
  listAfterPhotos,
  reassignAfterPhoto,
} from '@/data/after-photos/after-photo.service'
import type { CreateAfterPhotoPayload } from '@/data/after-photos/after-photo.service'
import {
  createLaundryPhoto,
  listLaundryPhotos,
  reassignLaundryPhoto,
} from '@/data/laundry-photos/laundry-photo.service'
import type {
  CreateLaundryPhotoPayload,
  GalleryPhoto,
  ReassignLaundryPhotoPayload,
} from '@/data/laundry-photos/laundry-photo.service'

export type GalleryPhotoType = 'BEF' | 'AFT'
export type ReassignPhotoPayload = ReassignLaundryPhotoPayload
export type CreatePhotoPayload = CreateLaundryPhotoPayload | CreateAfterPhotoPayload
export type { GalleryPhoto }

export async function listGalleryPhotos(
  type: GalleryPhotoType,
  orderId: string,
  orderItemId: string | null = null,
  onFresh?: (photos: GalleryPhoto[]) => void,
): Promise<GalleryPhoto[]> {
  if (type === 'BEF') {
    return listLaundryPhotos(orderId, orderItemId, onFresh)
  }

  if (type === 'AFT') {
    return listAfterPhotos(orderId, orderItemId, onFresh)
  }

  throw new Error(`Unsupported gallery photo type: ${String(type)}`)
}

// `async` so every failure — an unsupported type included — reaches the caller as a rejection
// rather than a synchronous throw that a promise chain would miss.
export async function createPhoto(
  type: GalleryPhotoType,
  payload: CreatePhotoPayload,
): Promise<Awaited<ReturnType<typeof createLaundryPhoto>> | Awaited<ReturnType<typeof createAfterPhoto>>> {
  if (type === 'BEF') {
    return createLaundryPhoto(payload as CreateLaundryPhotoPayload)
  }

  if (type === 'AFT') {
    return createAfterPhoto(payload as CreateAfterPhotoPayload)
  }

  throw new Error(`Unsupported gallery photo type: ${String(type)}`)
}

// `async` so every failure — an unsupported type included — reaches the caller as a rejection
// rather than a synchronous throw that a promise chain would miss.
export async function reassignPhoto(
  type: GalleryPhotoType,
  photoId: string,
  payload: ReassignPhotoPayload,
): Promise<Awaited<ReturnType<typeof reassignLaundryPhoto>> | Awaited<ReturnType<typeof reassignAfterPhoto>>> {
  const encodedPhotoId = encodeURIComponent(photoId)

  if (type === 'BEF') {
    return reassignLaundryPhoto(encodedPhotoId, payload)
  }

  if (type === 'AFT') {
    return reassignAfterPhoto(encodedPhotoId, payload)
  }

  throw new Error(`Unsupported gallery photo type: ${String(type)}`)
}
