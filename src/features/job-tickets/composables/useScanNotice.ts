import { onScopeDispose, ref } from 'vue'
import type { ScanDisplay } from '../scan-result'

export const SCAN_NOTICE_MS = 5000

// State of the gun-read popup: one notice at a time, replaced by the next, dismissed after 5 s.
// `seq` keys the popup so a replacement restarts its animation.
export function useScanNotice() {
  const notice = ref<ScanDisplay | null>(null)
  const seq = ref(0)
  let timer: ReturnType<typeof setTimeout> | undefined

  function dismiss(): void {
    if (timer) clearTimeout(timer)
    timer = undefined
    notice.value = null
  }

  function show(result: ScanDisplay): void {
    dismiss()
    seq.value += 1
    notice.value = result
    if (result.tone !== 'loading') timer = setTimeout(dismiss, SCAN_NOTICE_MS)
  }

  onScopeDispose(dismiss)

  return { notice, seq, show, dismiss }
}
