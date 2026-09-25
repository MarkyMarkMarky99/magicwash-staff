<script setup lang="ts">
import { computed } from 'vue'
import type { TicketStatus } from '../department-work'

export type TicketTapState = 'saving' | 'failed'

const props = defineProps<{ status: TicketStatus; state?: TicketTapState }>()

const STATUS_ICONS: Record<TicketStatus, { icon: string; label: string; classes: string }> = {
  Pending: { icon: 'schedule', label: 'Pending', classes: 'bg-warning-container text-on-warning-container' },
  'In Progress': { icon: 'autorenew', label: 'In Progress', classes: 'bg-info-container text-on-info-container' },
  Completed: { icon: 'check_circle', label: 'Completed', classes: 'bg-success-container text-on-success-container' },
  Cancelled: { icon: 'cancel', label: 'Cancelled', classes: 'bg-error-container text-on-error-container' },
}

const view = computed(() => props.state === 'saving'
  ? { icon: 'progress_activity', label: 'Saving', classes: 'bg-surface-container-lowest text-primary' }
  : props.state === 'failed'
    ? { icon: 'error', label: 'Failed', classes: 'bg-error text-on-error' }
    : STATUS_ICONS[props.status])
</script>

<template>
  <span class="flex h-7 items-center gap-1 rounded-full shadow-sm" :class="[view.classes, state === 'failed' ? 'px-2' : 'w-7 justify-center']" :title="view.label">
    <span class="material-symbols-outlined text-[18px] leading-none" :class="state === 'saving' ? 'animate-spin' : ''" aria-hidden="true">{{ view.icon }}</span>
    <span v-if="state === 'failed'" class="font-label text-[11px] font-bold leading-none">Failed</span>
    <span v-else class="sr-only">{{ view.label }}</span>
  </span>
</template>
