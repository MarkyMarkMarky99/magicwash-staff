<script setup lang="ts">
import type { AgentInfo } from '../agents'
import AgentAvatar from './AgentAvatar.vue'

defineProps<{ agent: AgentInfo }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <button type="button" class="grid min-h-[76px] w-full grid-cols-[56px_minmax(0,1fr)_20px] items-center gap-3 rounded-[14px] bg-white py-2.5 pl-3 pr-2 text-left shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_5%,transparent)] transition-transform active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-lime" @click="$emit('open')">
    <AgentAvatar :agent-id="agent.id" :size="56" />
    <span class="min-w-0">
      <span class="block font-body text-sm font-extrabold leading-snug">{{ agent.name }}</span>
      <span class="mt-1 block font-label text-[10px] font-extrabold uppercase text-warning">{{ agent.role }}</span>
      <span class="mt-1 line-clamp-2 font-label text-[11px] leading-snug text-on-surface-variant">{{ agent.description }}</span>
    </span>
    <span class="material-symbols-outlined text-[22px] text-primary opacity-35" aria-hidden="true">chevron_right</span>
  </button>
</template>
