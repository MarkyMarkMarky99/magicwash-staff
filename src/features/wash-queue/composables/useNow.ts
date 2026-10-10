import { onMounted, onUnmounted, ref } from 'vue'

export function useNow() {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | undefined

  function stop(): void {
    clearInterval(timer)
    timer = undefined
  }
  function start(): void {
    stop()
    now.value = Date.now()
    timer = setInterval(() => { now.value = Date.now() }, 1000)
  }
  function syncWithVisibility(): void {
    if (document.visibilityState === 'visible') start()
    else stop()
  }

  onMounted(() => {
    syncWithVisibility()
    document.addEventListener('visibilitychange', syncWithVisibility)
  })
  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', syncWithVisibility)
  })
  return now
}
