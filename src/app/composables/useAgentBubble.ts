import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { agentById } from '@/features/agents/agents'
import { isDismissed, parseDismissed, plainBubbleText, readStored, writeStored, type DismissedBubble } from '@/features/agents/utils/agent-bubble'
import type { AgentUnreadMessage } from './useAgentsUnread'

const dismissedKey = (viewer: string) => `agent-bubble-dismissed:${viewer}`

/** Which unread agent message the floating bubble shows, if any. */
export function useAgentBubble(latest: () => AgentUnreadMessage | null, total: () => number, viewerStaffId: () => string | null) {
  const route = useRoute()
  const dismissed = ref<DismissedBubble | null>(null)

  watch(viewerStaffId, (viewer) => {
    dismissed.value = viewer === null ? null : parseDismissed(readStored(dismissedKey(viewer)))
  }, { immediate: true })

  const bubble = computed(() => {
    const message = latest()
    if (message === null || route.meta.public === true || isDismissed(message, dismissed.value)) return null
    if (route.name === 'team-agent-chat' && route.params.agentId === message.agentId) return null
    return {
      agentId: message.agentId,
      name: agentById(message.agentId).name,
      text: plainBubbleText(message.text),
      count: total(),
    }
  })

  function dismiss(): void {
    const message = latest()
    const viewer = viewerStaffId()
    if (message === null) return
    dismissed.value = { id: message.eventId, at: message.at }
    if (viewer !== null) writeStored(dismissedKey(viewer), JSON.stringify(dismissed.value))
  }

  return { bubble, dismiss }
}
