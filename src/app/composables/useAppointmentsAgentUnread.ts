import { computed, onScopeDispose, watch } from 'vue'
import { useAppointmentsAgentStore } from '@/data/appointments-agent/appointments-agent.store'

const BACKGROUND_POLL_MS = 60000

export function useAppointmentsAgentUnread(enabled: () => boolean) {
  const store = useAppointmentsAgentStore()
  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  watch(enabled, (on) => {
    stop()
    if (!on) return
    void store.refresh()
    timer = setInterval(() => void store.refresh(), BACKGROUND_POLL_MS)
  }, { immediate: true })
  onScopeDispose(stop)

  return computed(() => (enabled() ? store.unreadCount : 0))
}
