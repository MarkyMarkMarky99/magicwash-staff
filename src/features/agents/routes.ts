import type { RouteRecordRaw } from 'vue-router'
import { TEAM_AGENT_IDS } from './agent-chat.types'

export const agentRoutes: RouteRecordRaw[] = [
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
    path: '/agents/:agentId',
    name: 'agent-chat',
    component: () => import('./pages/AgentChatPage.vue'),
    meta: { parent: 'agent-list' },
    props: true,
  },
]
