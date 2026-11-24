import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/data/auth/auth.store'
import { PERSONAL_AGENT_TARGET_ROUTE_NAME } from '@/shared/navigation/form-routes'
import { TEAM_AGENT_IDS } from './agent-chat.types'

async function adminOnly() {
  const authStore = useAuthStore()
  await authStore.ready()
  return authStore.isAdmin ? true : { name: 'team-agent-chat', params: { agentId: 'personal' }, replace: true }
}

export const agentRoutes: RouteRecordRaw[] = [
  {
    path: '/agents/dm/:conversationId',
    name: 'direct-chat',
    component: () => import('./pages/DirectChatPage.vue'),
    meta: { parent: 'agent-list' },
    props: true,
    beforeEnter: async () => {
      const auth = useAuthStore()
      await auth.ready()
      return auth.role === 'admin' || auth.role === 'staff' ? true : { name: 'agent-list', replace: true }
    },
  },
  {
    path: '/agents',
    name: 'agent-list',
    component: () => import('./pages/AgentListPage.vue'),
  },
  {
    path: `/agents/:agentId(${TEAM_AGENT_IDS.join('|')})`,
    name: 'team-agent-chat',
    component: () => import('./pages/TeamAgentChatRoute.vue'),
    meta: { parent: 'agent-list' },
    props: true,
  },
  {
    path: '/agents/personal/:staffId',
    name: PERSONAL_AGENT_TARGET_ROUTE_NAME,
    component: () => import('./pages/TeamAgentChatRoute.vue'),
    meta: { parent: 'agent-list' },
    props: route => ({ agentId: 'personal', staffId: String(route.params.staffId) }),
    beforeEnter: adminOnly,
  },
  {
    path: '/agents/personal-assignments',
    name: 'personal-assignments',
    component: () => import('./pages/PersonalAssignmentsPage.vue'),
    meta: { parent: 'agent-list' },
    beforeEnter: adminOnly,
  },
  {
    path: '/agents/:agentId',
    name: 'agent-chat',
    component: () => import('./pages/AgentChatPage.vue'),
    meta: { parent: 'agent-list' },
    props: true,
  },
]
