<script setup lang="ts">
import { useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import AgentRow from '../components/AgentRow.vue'
import { AGENTS } from '../agents'
import type { AgentId } from '../agent-chat.types'

const router = useRouter()

function openAgent(agentId: AgentId): void {
  void router.push({ name: 'agent-chat', params: { agentId } })
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
        <li v-for="agent in AGENTS" :key="agent.id">
          <AgentRow :agent="agent" @open="openAgent(agent.id)" />
        </li>
      </ul>
    </section>
  </ListPageLayout>
</template>
