import { onScopeDispose, readonly, ref } from 'vue'

const SOFT_KEYBOARD_THRESHOLD = 150

const open = ref(false)
let listeners = 0

function measure() {
  const visualViewport = window.visualViewport
  open.value = visualViewport
    ? window.innerHeight - visualViewport.height > SOFT_KEYBOARD_THRESHOLD
    : false
}

export function useSoftKeyboard() {
  if (typeof window !== 'undefined') {
    if (listeners === 0) {
      measure()
      window.visualViewport?.addEventListener('resize', measure)
      window.visualViewport?.addEventListener('scroll', measure)
    }

    listeners += 1

    onScopeDispose(() => {
      listeners -= 1
      if (listeners > 0) return
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
      open.value = false
    })
  }

  return readonly(open)
}
