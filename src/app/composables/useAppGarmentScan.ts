import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { getLaundryItem } from '@/data/laundry-items/laundry-item.service'
import { laundryTagIdSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import { anyPageGarmentScan } from '@/shared/utils/scan-code'

export function useAppGarmentScan(signedIn: () => boolean) {
  const route = useRoute()
  const router = useRouter()
  const enabled = computed(() => signedIn() && route.meta.public !== true && route.meta.ownsWorkScan !== true)
  const tagId = computed(() => {
    const raw = route.query.scannedGarment
    return enabled.value && laundryTagIdSchema.safeParse(raw).success ? raw as string : null
  })
  const notice = ref<string | null>(null)
  let pushedByUs = false
  let sequence = 0
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  watch(() => route.fullPath, () => {
    sequence += 1
    notice.value = null
    if (!tagId.value) pushedByUs = false
  }, { flush: 'sync' })
  watch(enabled, () => { sequence += 1 }, { flush: 'sync' })

  function showNotice(message: string): void {
    notice.value = message
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => { notice.value = null }, 5000)
  }

  async function scan(value: string): Promise<void> {
    const id = anyPageGarmentScan(value, signedIn(), route.meta)
    if (id === null) return
    const current = ++sequence
    notice.value = null
    if (!laundryTagIdSchema.safeParse(id).success) {
      showNotice('Tag not registered')
      return
    }
    try {
      const garment = await getLaundryItem(id)
      if (current !== sequence || !enabled.value) return
      if (!garment || garment.deletedAt) {
        showNotice('Tag not registered')
        return
      }
      if (tagId.value === id) return
      const query: LocationQueryRaw = { ...route.query, scannedGarment: id }
      delete query.garmentDetail
      if (tagId.value) {
        await router.replace({ query })
      } else {
        await router.push({ query })
        pushedByUs = tagId.value === id
      }
    } catch {
      if (current === sequence) showNotice('Could not check tag. Try again.')
    }
  }

  function close(): void {
    if (!tagId.value) return
    if (pushedByUs) {
      pushedByUs = false
      router.back()
      return
    }
    const query = { ...route.query }
    delete query.scannedGarment
    delete query.garmentDetail
    void router.replace({ query })
  }

  const removeGuard = router.beforeEach((to, from) => {
    if (!from.query.scannedGarment || to.path === from.path || to.redirectedFrom) return
    return { ...to, replace: true }
  })

  onScopeDispose(() => {
    sequence += 1
    removeGuard()
    if (noticeTimer) clearTimeout(noticeTimer)
  })

  return { enabled, tagId, notice, scan, close }
}
