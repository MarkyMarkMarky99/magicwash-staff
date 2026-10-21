<script setup lang="ts">
import type { TrackingProposal } from '../agent-chat.types'
import AgentCardFrame from './AgentCardFrame.vue'
import BaseBadge from '@/shared/components/BaseBadge.vue'

defineProps<{ proposal: TrackingProposal }>()
</script>

<template>
  <AgentCardFrame :title="proposal.orderId">
    <div class="mb-2.5 flex items-center gap-2 border-b border-dashed border-outline-variant pb-2">
      <b class="font-headline text-[15px] font-extrabold text-primary">{{ proposal.customerName }}</b>
      <BaseBadge :label="proposal.statusLabel" tone="lime" uppercase />
    </div>
    <ol class="list-none pl-1.5 pr-1">
      <li v-for="(step, index) in proposal.steps" :key="step.label" class="relative pb-3.5 pl-[26px] last:pb-0">
        <span v-if="index < proposal.steps.length - 1" class="absolute left-1 top-2.5 h-full w-0.5" :class="step.state === 'done' ? 'bg-primary' : 'bg-outline-variant'" />
        <span
          class="absolute left-0 top-1.5 z-[1] h-2.5 w-2.5 rounded-full"
          :class="step.state === 'current' ? 'bg-lime shadow-[0_0_0_2px_var(--color-primary)_inset,0_0_0_4px_white]' : step.state === 'done' ? 'bg-primary shadow-[0_0_0_4px_white]' : 'bg-outline-variant shadow-[0_0_0_4px_white]'"
        />
        <div class="font-headline text-sm leading-[21px]" :class="step.state === 'upcoming' ? 'font-bold text-on-surface-variant' : 'font-extrabold text-primary'">{{ step.label }}</div>
        <div class="font-body text-xs font-semibold leading-[18px] text-on-surface-variant">{{ step.detail }}</div>
      </li>
    </ol>
  </AgentCardFrame>
</template>
