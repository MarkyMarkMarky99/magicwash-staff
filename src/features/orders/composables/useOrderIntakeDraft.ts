import { markRaw, onScopeDispose, reactive } from 'vue'
import { defaultOrderDates } from '@/features/orders/utils/corporate-order-draft'
import {
  ORDER_INTAKE_DEFAULT_SERVICE_TYPE,
  type OrderIntakeCategory,
  type OrderIntakeDraft,
} from '@/features/orders/utils/order-intake-draft'

export function useOrderIntakeDraft(customerId: () => string) {
  const draft = reactive<OrderIntakeDraft>({
    customerId: customerId(),
    orderName: '',
    note: '',
    serviceType: ORDER_INTAKE_DEFAULT_SERVICE_TYPE,
    ...defaultOrderDates(),
    photos: [],
  })
  let sequence = 0

  function addPhoto(category: OrderIntakeCategory, file: File, extra: { tag?: string, weight?: number } = {}): string {
    const id = `intake-${++sequence}`
    draft.photos.push({
      id,
      category,
      file: markRaw(file),
      previewUrl: URL.createObjectURL(file),
      tag: extra.tag ?? null,
      weight: extra.weight ?? null,
    })
    return id
  }

  function removePhoto(id: string): void {
    const photo = draft.photos.find((entry) => entry.id === id)
    if (!photo) return
    URL.revokeObjectURL(photo.previewUrl)
    draft.photos = draft.photos.filter((entry) => entry.id !== id)
  }

  onScopeDispose(() => {
    for (const photo of draft.photos) URL.revokeObjectURL(photo.previewUrl)
  })

  return { draft, addPhoto, removePhoto }
}
