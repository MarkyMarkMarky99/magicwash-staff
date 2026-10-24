import { serviceTypeSchema } from '@contracts/shared/service-type.schema'
import { serviceTypePresentation } from '@/shared/utils/service-type-labels'
import { sheetDateDaysBetween } from '@/shared/utils/sheet-date'
import type { OrderIntakeRow } from '@/features/orders/utils/order-intake-items'

export type OrderIntakeServiceType = (typeof serviceTypeSchema.options)[number]
export type OrderIntakeCategory = 'garments' | 'document' | 'weight' | 'belonging'
export type OrderIntakePhotoCategory = 'document' | 'weight' | 'belonging' | 'defect'
export type OrderIntakeImageType = 'DOCUMENT' | 'WEIGHT' | 'BELONGING'

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
  { key: 'weight', icon: 'scale', name: 'Weight', hint: 'Bag on the scale' },
  { key: 'belonging', icon: 'diamond', name: 'Customer assets', hint: 'Items found with the laundry' },
]

export const orderIntakePhotoCategories: readonly { key: OrderIntakePhotoCategory, icon: string, name: string }[] = [
  { key: 'document', icon: 'description', name: 'Document' },
  { key: 'weight', icon: 'scale', name: 'Weight' },
  { key: 'belonging', icon: 'diamond', name: 'Customer assets' },
  { key: 'defect', icon: 'report', name: 'Defects' },
]

const IMAGE_TYPES: Record<Exclude<OrderIntakePhotoCategory, 'defect'>, OrderIntakeImageType> = {
  document: 'DOCUMENT',
  weight: 'WEIGHT',
  belonging: 'BELONGING',
}

export interface OrderIntakePhoto {
  id: string
  category: OrderIntakePhotoCategory
  file: File
  previewUrl: string
  tag: string | null
  weight: number | null
}

export interface OrderIntakeGarment {
  tag: string
  itemId: string | null
  imageUrl: string | null
  note: string | null
  defectPhotos: OrderIntakePhoto[]
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

export interface OrderIntakeSaveBody {
  customerId: string
  receivedDate: string
  dueDate: string
  serviceType: OrderIntakeServiceType
  orderName: string | null
  note: string | null
  items: { itemId: string, tags: string[] }[]
  garments: { tag: string, note: string | null, defectImageUrls: string[], registrationImageUrl: string | null }[]
  images: { imageType: OrderIntakeImageType, imageUrl: string, quantity: number | null }[]
}

export function dueBeforeReceived(receivedDate: string, dueDate: string): boolean {
  const days = sheetDateDaysBetween(dueDate, receivedDate)
  return days !== null && days < 0
}

export function photosOf(photos: readonly OrderIntakePhoto[], category: OrderIntakePhotoCategory): OrderIntakePhoto[] {
  return photos.filter((photo) => photo.category === category)
}

export function allIntakePhotos(draft: Pick<OrderIntakeDraft, 'photos' | 'garments'>): OrderIntakePhoto[] {
  return [...draft.photos, ...draft.garments.flatMap((garment) => garment.defectPhotos)]
}

export function orderIntakeSaveBody(draft: OrderIntakeDraft, rows: readonly OrderIntakeRow[]): OrderIntakeSaveBody {
  if (rows.some((row) => row.uncategorized)) throw new Error('Move every Uncategorized garment to a type before saving')
  return {
    customerId: draft.customerId,
    receivedDate: draft.receivedDate,
    dueDate: draft.dueDate,
    serviceType: draft.serviceType,
    orderName: draft.orderName.trim() || null,
    note: draft.note.trim() || null,
    items: rows.flatMap((row) => (row.itemId === null ? [] : [{ itemId: row.itemId, tags: row.garments.map((garment) => garment.tag) }])),
    garments: draft.garments.map((garment) => ({
      tag: garment.tag,
      note: garment.note?.trim() || null,
      defectImageUrls: [],
      registrationImageUrl: null,
    })),
    images: draft.photos.flatMap((photo) => (photo.category === 'defect'
      ? []
      : [{ imageType: IMAGE_TYPES[photo.category], imageUrl: '', quantity: photo.category === 'weight' ? photo.weight : null }])),
  }
}
