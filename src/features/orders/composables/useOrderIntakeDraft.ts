import { markRaw, onScopeDispose, reactive } from 'vue'
import { defaultOrderDates } from '@/features/orders/utils/corporate-order-draft'
import {
  ORDER_INTAKE_DEFAULT_SERVICE_TYPE,
  allIntakePhotos,
  type OrderIntakeDraft,
  type OrderIntakeGarment,
  type OrderIntakePhotoCategory,
} from '@/features/orders/utils/order-intake-draft'

export function useOrderIntakeDraft(customerId: () => string) {
  const draft = reactive<OrderIntakeDraft>({
    customerId: customerId(),
    orderName: '',
    note: '',
    serviceType: ORDER_INTAKE_DEFAULT_SERVICE_TYPE,
    ...defaultOrderDates(),
    garments: [],
    photos: [],
  })
  let sequence = 0

  function garmentOf(tag: string): OrderIntakeGarment | undefined {
    return draft.garments.find((garment) => garment.tag === tag)
  }

  function addGarment(garment: OrderIntakeGarment): void {
    if (!garmentOf(garment.tag)) draft.garments.push(garment)
  }

  function removeGarment(tag: string): void {
    const garment = garmentOf(tag)
    if (!garment) return
    for (const photo of garment.defectPhotos) URL.revokeObjectURL(photo.previewUrl)
    draft.garments = draft.garments.filter((entry) => entry.tag !== tag)
  }

  function setGarmentItem(tag: string, itemId: string | null): void {
    const garment = garmentOf(tag)
    if (garment) garment.itemId = itemId
  }

  function setGarmentNote(tag: string, note: string): void {
    const garment = garmentOf(tag)
    if (garment) garment.note = note
  }

  function addPhoto(category: OrderIntakePhotoCategory, file: File, extra: { tag?: string, weight?: number } = {}): string | null {
    const photo = {
      id: `intake-${++sequence}`,
      category,
      file: markRaw(file),
      previewUrl: URL.createObjectURL(file),
      tag: extra.tag ?? null,
      weight: extra.weight ?? null,
    }
    if (category === 'defect') {
      const garment = extra.tag ? garmentOf(extra.tag) : undefined
      if (!garment) {
        URL.revokeObjectURL(photo.previewUrl)
        return null
      }
      garment.defectPhotos.push(photo)
    } else {
      draft.photos.push(photo)
    }
    return photo.id
  }

  function removePhoto(id: string): void {
    const photo = allIntakePhotos(draft).find((entry) => entry.id === id)
    if (!photo) return
    URL.revokeObjectURL(photo.previewUrl)
    draft.photos = draft.photos.filter((entry) => entry.id !== id)
    for (const garment of draft.garments) garment.defectPhotos = garment.defectPhotos.filter((entry) => entry.id !== id)
  }

  onScopeDispose(() => {
    for (const photo of allIntakePhotos(draft)) URL.revokeObjectURL(photo.previewUrl)
  })

  return { draft, addGarment, removeGarment, setGarmentItem, setGarmentNote, addPhoto, removePhoto }
}
