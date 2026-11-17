import { computed, onScopeDispose, watch } from 'vue'
import { useTeamAgentStore } from '@/data/team-agent/team-agent.store'
import { TEAM_AGENT_IDS, type TeamAgentId } from '@/features/agents/agent-chat.types'
import { agentById, agentVisibleToRole } from '@/features/agents/agents'
import type { StaffSession } from '@/data/auth/auth.service'

const BACKGROUND_POLL_MS = 60000

export function useAgentsUnread(role: () => StaffSession['role'] | null, viewerStaffId: () => string | null) {
  const stores = Object.fromEntries(TEAM_AGENT_IDS.map(id => [id, useTeamAgentStore(id)])) as Record<TeamAgentId, ReturnType<typeof useTeamAgentStore>>
  const visibleIds = computed(() => TEAM_AGENT_IDS.filter(id => agentVisibleToRole(agentById(id), role())))
  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  watch([visibleIds, viewerStaffId], ([ids, viewer]) => {
    stop()
    stores.personal.bindViewer(viewer)
    if (!ids.length) return
    const refreshAll = () => ids.forEach(id => void stores[id].refresh())
    refreshAll()
    timer = setInterval(refreshAll, BACKGROUND_POLL_MS)
  }, { immediate: true })
  onScopeDispose(stop)

  return computed(() => visibleIds.value.reduce((total, id) => total + stores[id].unreadCount, 0))
}
