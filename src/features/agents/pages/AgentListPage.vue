<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/data/auth/auth.store'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import AgentRow from '../components/AgentRow.vue'
import { AGENTS, agentVisibleToRole } from '../agents'
import { agentsUnreadByAgentKey } from '@/shared/agents-unread'
import { isTeamAgentId, type AgentId } from '../agent-chat.types'

const router = useRouter()
const { role, isAdmin } = storeToRefs(useAuthStore())
const unreadByAgent = inject(agentsUnreadByAgentKey, ref<Record<string, number>>({}))
const visibleAgents = computed(() => AGENTS.filter(agent => agentVisibleToRole(agent, role.value)))

function openAgent(agentId: AgentId): void {
  void router.push({ name: isTeamAgentId(agentId) ? 'team-agent-chat' : 'agent-chat', params: { agentId } })
}
</script>

<template>
  <ListPageLayout>
    <section>
      <div class="px-4 pb-2 pt-4">
        <div class="min-w-0 border-l-4 border-lime pl-2">
          <h2 class="font-headline text-xl font-bold leading-tight text-primary">Agents</h2>
          <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">Chat with AI helpers</span>
        </div>
      </div>
      <ul class="grid gap-2.5 px-3">
        <li v-for="agent in visibleAgents" :key="agent.id">
          <AgentRow :agent="agent" :unread="unreadByAgent[agent.id] ?? 0" @open="openAgent(agent.id)" />
        </li>
      </ul>
      <button v-if="isAdmin" type="button" class="mx-3 mt-2.5 grid min-h-[56px] w-[calc(100%-1.5rem)] grid-cols-[56px_minmax(0,1fr)_20px] items-center gap-3 rounded-[14px] bg-white py-2 pl-3 pr-2 text-left shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)] transition-transform active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-lime" @click="router.push({ name: 'personal-assignments' })">
        <span class="material-symbols-outlined justify-self-center text-[28px] text-primary" aria-hidden="true">assignment</span>
        <span class="min-w-0">
          <span class="block font-body text-sm font-extrabold leading-snug">Assignments</span>
          <span class="block font-label text-[11px] leading-snug text-on-surface-variant">Work assigned to employees through their assistants</span>
        </span>
        <span class="material-symbols-outlined text-[22px] text-primary opacity-35" aria-hidden="true">chevron_right</span>
      </button>
    </section>
  </ListPageLayout>
</template>
