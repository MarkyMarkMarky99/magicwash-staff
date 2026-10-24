import { serviceTypeSchema } from '@contracts/shared/service-type.schema'
import { serviceTypePresentation } from '@/shared/utils/service-type-labels'
import { sheetDateDaysBetween } from '@/shared/utils/sheet-date'
import type { WorkOrderCreatePayload } from '@/data/work-orders/work-order.service'

export type OrderIntakeServiceType = (typeof serviceTypeSchema.options)[number]
export type OrderIntakeCategory = 'garments' | 'document' | 'weight' | 'belonging'

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
  { key: 'garments', icon: 'checkroom', name: 'Garments', hint: 'Scan tag, then photograph' },
  { key: 'document', icon: 'description', name: 'Document', hint: 'Slip or customer form' },
  { key: 'weight', icon: 'scale', name: 'Weight', hint: 'Bag on the scale' },
  { key: 'belonging', icon: 'diamond', name: 'Customer assets', hint: 'Items found with the laundry' },
]

export interface OrderIntakePhoto {
  id: string
  category: OrderIntakeCategory
  file: File
  previewUrl: string
  tag: string | null
  weight: number | null
}

export interface OrderIntakeDraft {
  customerId: string
  orderName: string
  note: string
  serviceType: OrderIntakeServiceType
  receivedDate: string
  dueDate: string
  photos: OrderIntakePhoto[]
}

export interface OrderIntakeDetails {
  orderName: string
  note: string
  serviceType: OrderIntakeServiceType
  receivedDate: string
  dueDate: string
}

export function dueBeforeReceived(receivedDate: string, dueDate: string): boolean {
  const days = sheetDateDaysBetween(dueDate, receivedDate)
  return days !== null && days < 0
}

export function photosOf(photos: readonly OrderIntakePhoto[], category: OrderIntakeCategory): OrderIntakePhoto[] {
  return photos.filter((photo) => photo.category === category)
}

export function orderIntakeCreatePayload(draft: OrderIntakeDraft, createdBy: string): WorkOrderCreatePayload {
  const garments = photosOf(draft.photos, 'garments').length
  return {
    customerId: draft.customerId,
    receivedDate: draft.receivedDate,
    dueDate: draft.dueDate,
    serviceType: draft.serviceType,
    quantity: garments > 0 ? garments : null,
    orderName: draft.orderName.trim() || null,
    note: draft.note.trim() || null,
    orderDescription: null,
    createdBy,
    items: [],
  }
}
