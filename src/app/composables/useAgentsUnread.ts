import { computed, onScopeDispose, watch } from 'vue'
import { useDirectChatStore } from '@/data/direct-chat/direct-chat.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { useTeamAgentStore } from '@/data/team-agent/team-agent.store'
import { TEAM_AGENT_IDS, type TeamAgentId } from '@/features/agents/agent-chat.types'
import { agentById, agentVisibleToViewer } from '@/features/agents/agents'
import type { StaffSession } from '@/data/auth/auth.service'

const BACKGROUND_POLL_MS = 60000

export interface AgentUnreadMessage {
  agentId: TeamAgentId
  eventId: string
  at: string
  text: string
}

export function useAgentsUnread(role: () => StaffSession['role'] | null, viewerStaffId: () => string | null) {
  const staffStore = useStaffStore()
  const directChat = useDirectChatStore()
  const stores = Object.fromEntries(TEAM_AGENT_IDS.map(id => [id, useTeamAgentStore(id)])) as Record<TeamAgentId, ReturnType<typeof useTeamAgentStore>>
  const visibleIds = computed(() => TEAM_AGENT_IDS.filter(id => agentVisibleToViewer(agentById(id), role(), staffStore.hasActiveSecretary(viewerStaffId()))))
  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  watch([visibleIds, viewerStaffId, role], ([ids, viewer, viewerRole]) => {
    stop()
    TEAM_AGENT_IDS.forEach(id => stores[id].bindViewer(viewer))
    const canChat = !!viewer && (viewerRole === 'admin' || viewerRole === 'staff')
    const refreshAll = () => {
      ids.forEach(id => void stores[id].refresh())
      if (canChat) void directChat.refreshInbox()
    }
    refreshAll()
    timer = setInterval(refreshAll, BACKGROUND_POLL_MS)
  }, { immediate: true })
  onScopeDispose(stop)

  const byAgent = computed(() => Object.fromEntries(visibleIds.value.map(id => [id, stores[id].unreadCount])) as Record<string, number>)
  const aiTotal = computed(() => visibleIds.value.reduce((sum, id) => sum + stores[id].unreadCount, 0))
  const total = computed(() => aiTotal.value + directChat.unreadTotal)
  /** The newest unread agent or system message across the chats the viewer can see. */
  const latest = computed<AgentUnreadMessage | null>(() => {
    let newest: AgentUnreadMessage | null = null
    for (const id of visibleIds.value) {
      const event = stores[id].latestUnreadAi
      if (event && stores[id].unreadCount > 0 && (newest === null || event.at >= newest.at)) {
        newest = { agentId: id, eventId: event.id, at: event.at, text: event.text }
      }
    }
    return newest
  })

  return { total, aiTotal, byAgent, latest }
}
