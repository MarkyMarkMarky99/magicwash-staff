import type { z } from 'zod'
import type { orderIntakeCreateSchema } from '@contracts/order-intakes/order-intake-api.schema'
import type { GarmentUpload } from '@/shared/composables/useGarmentPhotoUploads'
import { serviceTypeSchema } from '@contracts/shared/service-type.schema'
import { serviceTypePresentation } from '@/shared/utils/service-type-labels'
import { sheetDateDaysBetween } from '@/shared/utils/sheet-date'
import type { OrderIntakeRow } from '@/features/orders/utils/order-intake-items'

export type OrderIntakeServiceType = (typeof serviceTypeSchema.options)[number]
export type OrderIntakeCategory = 'garments' | 'document' | 'belonging'
export type OrderIntakePhotoCategory = 'document' | 'belonging'
export type OrderIntakeImageType = 'DOCUMENT' | 'BELONGING'

export const ORDER_INTAKE_DEFAULT_SERVICE_TYPE: OrderIntakeServiceType = 'WSIR'

const SERVICE_LABELS: Record<OrderIntakeServiceType, string> = {
  WSIR: 'Wash & Iron',
  IRON: 'Iron only',
  DRCL: 'Dry clean',
  WASH: 'Wash & Fold',
}

export const orderIntakeServiceOptions = serviceTypeSchema.options.map((value) => ({
  value,
  label: SERVICE_LABELS[value],
  icon: serviceTypePresentation[value].icon,
}))

export function orderIntakeServiceLabel(serviceType: OrderIntakeServiceType): string {
  return SERVICE_LABELS[serviceType]
}

export const orderIntakeCategories: readonly { key: OrderIntakeCategory, icon: string, name: string, hint: string }[] = [
  { key: 'garments', icon: 'checkroom', name: 'Garments', hint: 'Scan the tag with the camera' },
  { key: 'document', icon: 'description', name: 'Document', hint: 'Slip or customer form' },
  { key: 'belonging', icon: 'diamond', name: 'Customer assets', hint: 'Items found with the laundry' },
]

export const orderIntakePhotoCategories: readonly { key: OrderIntakePhotoCategory, icon: string, name: string }[] = [
  { key: 'document', icon: 'description', name: 'Document' },
  { key: 'belonging', icon: 'diamond', name: 'Customer assets' },
]

const IMAGE_TYPES: Record<OrderIntakePhotoCategory, OrderIntakeImageType> = {
  document: 'DOCUMENT',
  belonging: 'BELONGING',
}

export interface OrderIntakePhoto {
  id: string
  category: OrderIntakePhotoCategory
  file: File
  previewUrl: string
}

export interface OrderIntakeGarment {
  tag: string
  itemId: string | null
  imageUrl: string | null
}

export interface OrderIntakeDraft {
  customerId: string
  orderName: string
  note: string
  serviceType: OrderIntakeServiceType
  receivedDate: string
  dueDate: string
  garments: OrderIntakeGarment[]
  photos: OrderIntakePhoto[]
}

export interface OrderIntakeDetails {
  orderName: string
  note: string
  serviceType: OrderIntakeServiceType
  receivedDate: string
  dueDate: string
}

export type OrderIntakeSaveBody = z.input<typeof orderIntakeCreateSchema>

export function dueBeforeReceived(receivedDate: string, dueDate: string): boolean {
  const days = sheetDateDaysBetween(dueDate, receivedDate)
  return days !== null && days < 0
}

export function photosOf(photos: readonly OrderIntakePhoto[], category: OrderIntakePhotoCategory): OrderIntakePhoto[] {
  return photos.filter((photo) => photo.category === category)
}

export function orderIntakeSaveBody(draft: OrderIntakeDraft, rows: readonly OrderIntakeRow[], uploads: Readonly<Record<string, GarmentUpload>>): OrderIntakeSaveBody {
  if (rows.some((row) => row.uncategorized)) throw new Error('Choose a type for every Uncategorized garment before saving')
  return {
    customerId: draft.customerId,
    receivedDate: draft.receivedDate,
    dueDate: draft.dueDate,
    serviceType: draft.serviceType,
    orderName: draft.orderName.trim() || null,
    note: draft.note.trim() || null,
    items: rows.flatMap((row) => (row.itemId === null ? [] : [{ itemId: row.itemId, tags: row.garments.map((garment) => garment.tag) }])),
    images: draft.photos.map((photo) => {
      const upload = uploads[photo.id]
      if (upload?.status !== 'done' || !upload.url) throw new Error('Wait for every photo to upload before saving')
      return { imageType: IMAGE_TYPES[photo.category], imageUrl: upload.url }
    }),
  }
}
