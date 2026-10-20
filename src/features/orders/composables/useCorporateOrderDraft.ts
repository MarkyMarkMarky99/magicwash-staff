import { computed, markRaw, onScopeDispose, reactive } from 'vue'
import {
  CORPORATE_ORDER_SERVICE_TYPE,
  addedLine,
  countedLineCount,
  defaultOrderDates,
  mergeListLines,
  totalCounted,
  type CorporateOrderDraft,
  type CorporateOrderLine,
} from '@/features/orders/utils/corporate-order-draft'
import type { CorporateOrderItem } from '@/features/orders/utils/corporate-order-items'

export function useCorporateOrderDraft(customerId: () => string) {
  const draft = reactive<CorporateOrderDraft>({
    customerId: customerId(),
    ...defaultOrderDates(),
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

  function setStartingValues(lines: CorporateOrderLine[], receivedDate: string | null): void {
    draft.lines = lines
    if (receivedDate !== null) draft.receivedDate = receivedDate
  }

  function setSlipPhoto(file: File): string {
    removeSlipPhoto()
    const id = `slip-${++sequence}`
    draft.slipPhotos = [{ id, file: markRaw(file), url: URL.createObjectURL(file) }]
    return id
  }

  function removeSlipPhoto(): void {
    for (const photo of draft.slipPhotos) URL.revokeObjectURL(photo.url)
    draft.slipPhotos = []
  }

  onScopeDispose(() => {
    for (const photo of draft.slipPhotos) URL.revokeObjectURL(photo.url)
  })

  return {
    draft,
    countedCount,
    total,
    setListItems,
    setStartingValues,
    setCounted,
    addLine,
    removeLine,
    setSlipPhoto,
    removeSlipPhoto,
  }
}
