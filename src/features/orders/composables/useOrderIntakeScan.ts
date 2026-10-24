import { onScopeDispose, ref } from 'vue'
import { getLaundryItem, listCustomerLaundryItems } from '@/data/laundry-items/laundry-item.service'
import { feedback } from '@/shared/utils/scan-feedback'
import { checkScannedTag, preloadedLookup, resolveScannedTag, type OrderIntakeScanBanner } from '@/features/orders/utils/order-intake-scan'
import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'

export function useOrderIntakeScan(
  customerId: () => string,
  hasTag: (tag: string) => boolean,
  onAdd: (garment: OrderIntakeGarment) => void,
) {
  // The latest scan replaces the banner; bannerSeq changes on every scan so the view can restart its pop-in.
  const banner = ref<OrderIntakeScanBanner | null>(null)
  const bannerSeq = ref(0)
  const pending = new Set<string>()
  let disposed = false
  let lookupCustomerId: string | null = null
  let lookup: ReturnType<typeof preloadedLookup> = getLaundryItem

  // Loads the customer's garments once, so a scan of their own garment needs no server call.
  function lookupFor(id: string): ReturnType<typeof preloadedLookup> {
    if (id && id !== lookupCustomerId) {
      lookupCustomerId = id
      lookup = preloadedLookup(listCustomerLaundryItems(id), getLaundryItem)
    }
    return lookup
  }

  function show(next: OrderIntakeScanBanner): void {
    banner.value = next
    bannerSeq.value += 1
    feedback(next.tone === 'success' ? 'success' : 'failure')
  }

  async function scan(code: string): Promise<void> {
    const checked = checkScannedTag(code, hasTag)
    if ('banner' in checked) {
      show(checked.banner)
      return
    }
    const { tag } = checked
    if (pending.has(tag)) return
    pending.add(tag)
    try {
      const result = await resolveScannedTag(tag, { customerId: customerId(), hasTag, lookup: lookupFor(customerId()) })
      if (disposed) return
      if (result.kind === 'refused') {
        show(result.banner)
        return
      }
      if (hasTag(tag)) return
      onAdd(result.garment)
      show(result.banner)
    } finally {
      pending.delete(tag)
    }
  }

  onScopeDispose(() => {
    disposed = true
  })

  return { banner, bannerSeq, scan, preload: () => { lookupFor(customerId()) }, dismissBanner: () => { banner.value = null } }
}
