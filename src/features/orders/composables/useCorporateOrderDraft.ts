import { computed, markRaw, onBeforeUnmount, reactive } from 'vue'
import {
  CORPORATE_ORDER_SERVICE_TYPE,
  addedLine,
  countedLineCount,
  defaultOrderDates,
  mergeListLines,
  totalCounted,
  type CorporateOrderDraft,
} from '@/features/orders/utils/corporate-order-draft'
import type { CorporateOrderItem } from '@/features/orders/utils/corporate-order-items'

export function useCorporateOrderDraft(customerId: () => string) {
  const draft = reactive<CorporateOrderDraft>({
    customerId: customerId(),
    ...defaultOrderDates(),
    note: '',
    serviceType: CORPORATE_ORDER_SERVICE_TYPE,
    lines: [],
    slipPhotos: [],
  })
  let sequence = 0

  const countedCount = computed(() => countedLineCount(draft.lines))
  const total = computed(() => totalCounted(draft.lines))

  function setListItems(items: readonly CorporateOrderItem[]): void {
    draft.lines = mergeListLines(draft.lines, items)
  }

  function setCounted(key: string, counted: number | null): void {
    const line = draft.lines.find((entry) => entry.key === key)
    if (line) line.counted = counted
  }

  function addLine(name: string, counted: number | null): void {
    draft.lines.push(addedLine(`added-${++sequence}`, name, counted))
  }

  function removeLine(key: string): void {
    draft.lines = draft.lines.filter((line) => line.key !== key)
  }

  function addSlipPhoto(file: File): string {
    const id = `slip-${++sequence}`
    draft.slipPhotos.push({ id, file: markRaw(file), url: URL.createObjectURL(file) })
    return id
  }

  function replaceSlipPhoto(id: string, file: File): void {
    const index = draft.slipPhotos.findIndex((photo) => photo.id === id)
    if (index < 0) return
    URL.revokeObjectURL(draft.slipPhotos[index]!.url)
    draft.slipPhotos[index] = { id, file: markRaw(file), url: URL.createObjectURL(file) }
  }

  function removeSlipPhoto(id: string): void {
    const index = draft.slipPhotos.findIndex((photo) => photo.id === id)
    if (index < 0) return
    URL.revokeObjectURL(draft.slipPhotos[index]!.url)
    draft.slipPhotos.splice(index, 1)
  }

  onBeforeUnmount(() => {
    for (const photo of draft.slipPhotos) URL.revokeObjectURL(photo.url)
  })

  return {
    draft,
    countedCount,
    total,
    setListItems,
    setCounted,
    addLine,
    removeLine,
    addSlipPhoto,
    replaceSlipPhoto,
    removeSlipPhoto,
  }
}
