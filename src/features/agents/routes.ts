import type { RouteRecordRaw } from 'vue-router'

export const agentRoutes: RouteRecordRaw[] = [
  {
    path: '/agents',
    name: 'agent-list',
    component: () => import('./pages/AgentListPage.vue'),
  },
  {
    path: '/agents/:agentId',
    name: 'agent-chat',
    component: () => import('./pages/AgentChatPage.vue'),
    meta: { parent: 'agent-list' },
    props: true,
  },
]
