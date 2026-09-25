<script setup lang="ts">
import { computed } from 'vue'
import type { TicketStatus } from '../department-work'

export type TicketTapState = 'saving' | 'failed'

const props = defineProps<{ status: TicketStatus; state?: TicketTapState }>()

const STATUS_ICONS: Record<TicketStatus, { icon: string; label: string; classes: string }> = {
  Pending: { icon: 'schedule', label: 'Pending', classes: 'text-surface-container-low' },
  'In Progress': { icon: 'autorenew', label: 'In Progress', classes: 'text-surface-container-low' },
  Completed: { icon: 'check_circle', label: 'Completed', classes: 'text-surface-container-low' },
  Cancelled: { icon: 'cancel', label: 'Cancelled', classes: 'text-surface-container-low' },
}

const view = computed(() => props.state === 'saving'
  ? { icon: 'progress_activity', label: 'Saving', classes: 'text-surface-container-low' }
  : props.state === 'failed'
    ? { icon: 'error', label: 'Failed', classes: 'bg-error text-on-error' }
    : STATUS_ICONS[props.status])
</script>

<template>
  <span class="flex h-5 items-center gap-1 rounded-full" :class="[view.classes, state === 'failed' ? 'px-2' : 'w-5 justify-center [filter:drop-shadow(0_1px_1.5px_rgba(0,0,0,0.45))]']" :title="view.label">
    <span class="material-symbols-outlined text-[16px] leading-none" :class="state === 'saving' ? 'animate-spin' : ''" aria-hidden="true">{{ view.icon }}</span>
    <span v-if="state === 'failed'" class="font-label text-[11px] font-bold leading-none">Failed</span>
    <span v-else class="sr-only">{{ view.label }}</span>
  </span>
</template>
