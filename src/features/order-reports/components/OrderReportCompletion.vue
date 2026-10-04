<script setup lang="ts">
import { computed } from 'vue'
import CompletionRing from '@/shared/components/CompletionRing.vue'
import { completionNote, percentOf, type ReportFocus } from '../utils/order-report'

const props = defineProps<{ report: ReportFocus }>()

const completed = computed(() => props.report.status.completed)
const orders = computed(() => props.report.totals.orders)
const cards = computed(() => [
  {
    key: 'pending',
    label: 'Pending',
    icon: 'schedule',
    count: props.report.status.pending,
    surface: 'bg-warning-container/20',
    fill: 'bg-warning-container/15',
    badge: 'bg-warning-container/30',
  },
  {
    key: 'in-progress',
    label: 'In progress',
    icon: 'autorenew',
    count: props.report.status.inProgress,
    surface: 'bg-secondary-container/20',
    fill: 'bg-secondary-container/15',
    badge: 'bg-secondary-container/30',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: 'check_circle',
    count: props.report.status.completed,
    surface: 'bg-lime/20',
    fill: 'bg-lime/25',
    badge: 'bg-lime/30',
  },
].map((card) => ({ ...card, share: percentOf(card.count, orders.value) })))
</script>

<template>
  <section class="px-4 pt-4" aria-label="Order status">
    <div class="grid grid-cols-[164px_minmax(0,1fr)] items-center gap-4">
      <CompletionRing tone="onDark" :percentage="percentOf(completed, orders)" :completed="completed" :total="orders" :label="String(orders)" />
      <div class="flex min-w-0 flex-col gap-1.5">
        <div v-for="card in cards" :key="card.key" class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3" :class="card.surface">
          <span class="absolute inset-y-0 left-0" :class="card.fill" :style="{ width: `${card.share}%` }" />
          <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-on-primary" :class="card.badge">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ card.icon }}</span>
          </span>
          <span class="relative flex min-w-0 flex-col justify-center">
            <span class="truncate font-label text-[12px] font-medium leading-4 text-on-primary/60">{{ card.label }}</span>
            <strong class="font-headline text-[22px] font-semibold leading-6 text-on-primary">{{ card.count }}</strong>
          </span>
        </div>
      </div>
    </div>
    <p class="mt-2.5 text-center text-[13px] text-on-primary/60">{{ completionNote(report) }}</p>
  </section>
</template>
