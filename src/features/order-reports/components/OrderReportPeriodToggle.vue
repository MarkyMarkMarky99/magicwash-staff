<script setup lang="ts">
import type { OrderReportPeriod } from '@/data/order-reports/order-report.service'

const OPTIONS: { key: OrderReportPeriod; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

defineProps<{ period: OrderReportPeriod }>()
const emit = defineEmits<{ select: [period: OrderReportPeriod] }>()
</script>

<template>
  <div
    class="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 grid w-[260px] -translate-x-1/2 grid-cols-3 gap-[3px] rounded-full border border-on-primary/10 bg-primary p-[5px] shadow-[0_8px_24px_color-mix(in_srgb,black_35%,transparent)]"
    role="group"
    aria-label="Report period"
  >
    <button
      v-for="option in OPTIONS"
      :key="option.key"
      type="button"
      :aria-pressed="period === option.key"
      class="min-h-11 rounded-full font-label text-[14px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
      :class="period === option.key ? 'bg-lime text-on-surface' : 'text-on-primary'"
      @click="emit('select', option.key)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
